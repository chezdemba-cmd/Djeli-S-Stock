"use server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "../../types/database.types";
import { z } from "zod";

const SaleItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
});

const ProcessSaleSchema = z.object({
  store_id: z.string().uuid(),
  items: z.array(SaleItemSchema).min(1),
  total_amount: z.number().nonnegative(),
  paid_amount: z.number().nonnegative(),
  payment_method: z.enum(['cash', 'mobile_money', 'card', 'bank_transfer']),
  customer_id: z.string().uuid().optional(),
  due_date: z.string().optional(),
  idempotency_key: z.string().min(1),
});

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveOrgId(supabase: any, user: any, passedOrgId?: string): Promise<string | null> {
  if (passedOrgId && passedOrgId.trim() !== '') return passedOrgId;
  try {
    const { data: orgs } = await supabase.rpc('current_orgs');
    if (orgs && orgs.length > 0) return orgs[0];
  } catch {}
  try {
    const { data: mem } = await supabase.from('memberships').select('organization_id').eq('user_id', user.id).limit(1).single();
    if (mem && mem.organization_id) return mem.organization_id;
  } catch {}
  try {
    const { data: firstOrg } = await supabase.from('organizations').select('id').limit(1).single();
    if (firstOrg && firstOrg.id) return firstOrg.id;
  } catch {}
  return null;
}

export type SaleItemInput = { product_id: string; quantity: number; unit_price: number; };

export async function processSale(data: {
  store_id: string;
  items: SaleItemInput[];
  total_amount: number;
  paid_amount: number;
  payment_method: string;
  customer_id?: string;
  due_date?: string;
  idempotency_key: string;
  organization_id: string;
}) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Non autorisé" };

  let parsedData;
  try {
    parsedData = ProcessSaleSchema.parse(data);
  } catch (e: any) {
    return { error: "Données invalides : " + e.message };
  }

  const orgId = await resolveOrgId(supabase, user.user, data.organization_id);
  if (!orgId) return { error: "Aucune organisation trouvée pour ce compte." };

  const payload = {
    ...parsedData,
    organization_id: orgId,
    user_id: user.user.id
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: result, error } = await (supabase.rpc as any)('create_sale', { payload });
  if (error) {
    if (error.message.includes('insuffisant')) return { error: "Stock insuffisant pour valider cette vente." };
    if (error.message.includes('obligatoire pour une vente à crédit')) return { error: "Un client est obligatoire pour un crédit." };
    return { error: error.message };
  }
  return { data: result };
}

export async function payReceivable(data: {
  receivable_id: string;
  amount: number;
  payment_method: string;
  idempotency_key: string;
  organization_id: string;
}) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Non autorisé" };

  const orgId = await resolveOrgId(supabase, user.user, data.organization_id);
  if (!orgId) return { error: "Aucune organisation trouvée pour ce compte." };

  const payload = {
    ...data,
    organization_id: orgId,
    user_id: user.user.id
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: result, error } = await (supabase.rpc as any)('pay_receivable', { payload });
  if (error) return { error: error.message };
  return { data: result };
}

const CreateCustomerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  city: z.string().optional(),
});

export async function createCustomer(data: {
  name: string;
  phone?: string;
  city?: string;
  organization_id: string;
}) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Non autorisé (session expirée ou absente)" };

  const orgId = await resolveOrgId(supabase, user.user, data.organization_id);
  if (!orgId) return { error: "Aucune organisation trouvée pour ce compte." };

  let parsedData;
  try {
    parsedData = CreateCustomerSchema.parse(data);
  } catch (e: any) {
    return { error: "Données invalides : " + e.message };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: result, error } = await (supabase as any).from('customers').insert({
    organization_id: orgId,
    name: parsedData.name,
    phone: parsedData.phone,
    city: parsedData.city,
    active: true
  }).select().single();

  if (error) return { error: error.message };
  return { data: result };
}

const CreateStoreSchema = z.object({
  name: z.string().min(1),
  city: z.string().optional(),
  allow_negative_stock: z.boolean().default(false),
});

export async function createStore(data: {
  name: string;
  city?: string;
  allow_negative_stock?: boolean;
  organization_id: string;
}) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Non autorisé" };

  const orgId = await resolveOrgId(supabase, user.user, data.organization_id);
  if (!orgId) return { error: "Aucune organisation trouvée pour ce compte." };

  let parsedData;
  try {
    parsedData = CreateStoreSchema.parse(data);
  } catch (e: any) {
    return { error: "Données invalides : " + e.message };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: result, error } = await (supabase as any).from('stores').insert({
    organization_id: orgId,
    name: parsedData.name,
    city: parsedData.city,
    allow_negative_stock: parsedData.allow_negative_stock,
    active: true
  }).select().single();

  if (error) return { error: error.message };
  return { data: result };
}

export async function createClientWorkspace(data: { name: string }) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { success: false, error: "Non autorisé" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: org, error: orgErr } = await (supabase as any).from('organizations').insert({ name: data.name }).select().single();
  if (orgErr) return { success: false, error: "Erreur Supabase (organizations): " + orgErr.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: storeErr } = await (supabase as any).from('stores').insert({ 
    organization_id: org.id, 
    name: 'Dépôt Principal',
    active: true 
  });
  if (storeErr) return { success: false, error: "Erreur Supabase (stores): " + storeErr.message };

  return { success: true, org };
}

const CreateProductSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  unit: z.string().default('unité'),
  purchase_price: z.number().nonnegative(),
  sale_price: z.number().nonnegative(),
  min_stock: z.number().nonnegative().default(0),
  sku: z.string().optional(),
  initial_quantity: z.number().nonnegative().default(0),
  store_id: z.string().optional(),
});

export async function createProduct(data: {
  name: string;
  category?: string;
  unit?: string;
  purchase_price: number;
  sale_price: number;
  min_stock?: number;
  sku?: string;
  initial_quantity?: number;
  store_id?: string;
  organization_id: string;
}) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Non autorisé" };

  const orgId = await resolveOrgId(supabase, user.user, data.organization_id);
  if (!orgId) return { error: "Aucune organisation trouvée pour ce compte." };

  let parsedData;
  try {
    parsedData = CreateProductSchema.parse(data);
  } catch (e: any) {
    return { error: "Données invalides : " + e.message };
  }

  const sku = parsedData.sku || `PRD-${Date.now().toString().slice(-6)}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: product, error: prdErr } = await (supabase as any).from('products').insert({
    organization_id: orgId,
    name: parsedData.name,
    category: parsedData.category || 'Général',
    unit: parsedData.unit || 'unité',
    purchase_price: parsedData.purchase_price,
    sale_price: parsedData.sale_price,
    min_stock: parsedData.min_stock || 0,
    sku: sku,
    active: true
  }).select().single();

  if (prdErr) return { error: prdErr.message };

  // Si une quantité initiale est fournie et qu'un dépôt est sélectionné, créer le mouvement initial
  if (parsedData.initial_quantity > 0 && parsedData.store_id) {
    const idempotency = `init_prod_${product.id}_${Date.now()}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('inventory_movements').insert({
      organization_id: orgId,
      store_id: parsedData.store_id,
      product_id: product.id,
      movement_type: 'purchase',
      quantity: parsedData.initial_quantity,
      reference_type: 'correction',
      reference_id: product.id,
      created_by: user.user.id,
      idempotency_key: idempotency
    });
  }

  return { data: product };
}

const AddStockMovementSchema = z.object({
  store_id: z.string().uuid(),
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
  movement_type: z.enum(['purchase', 'adjustment', 'correction']),
  organization_id: z.string().uuid(),
});

export async function addStockMovement(data: {
  store_id: string;
  product_id: string;
  quantity: number;
  movement_type: 'purchase' | 'adjustment' | 'correction';
  organization_id: string;
}) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Non autorisé" };

  const orgId = await resolveOrgId(supabase, user.user, data.organization_id);
  if (!orgId) return { error: "Aucune organisation trouvée pour ce compte." };

  let parsedData;
  try {
    parsedData = AddStockMovementSchema.parse({ ...data, organization_id: orgId });
  } catch (e: any) {
    return { error: "Données invalides : " + e.message };
  }

  const idempotency = `mvt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: mvt, error: mvtErr } = await (supabase as any).from('inventory_movements').insert({
    organization_id: orgId,
    store_id: parsedData.store_id,
    product_id: parsedData.product_id,
    movement_type: parsedData.movement_type,
    quantity: parsedData.quantity,
    reference_type: 'adjustment',
    reference_id: parsedData.product_id,
    created_by: user.user.id,
    idempotency_key: idempotency
  }).select().single();

  if (mvtErr) return { error: mvtErr.message };
  return { data: mvt };
}

