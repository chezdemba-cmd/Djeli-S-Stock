"use server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
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

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getOrCreateUserOrg(userId: string, email?: string, passedOrgId?: string): Promise<{ orgId: string; storeId: string }> {
  const admin = getAdmin();

  // 1. Si un passedOrgId valide existe dans la table organizations, l'utiliser
  if (passedOrgId && passedOrgId.trim() !== '' && passedOrgId !== 'mock-org-id' && passedOrgId !== 'null') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: checkOrg } = await (admin as any).from('organizations').select('id').eq('id', passedOrgId).maybeSingle();
    if (checkOrg && checkOrg.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: store } = await (admin as any).from('stores').select('id').eq('organization_id', checkOrg.id).limit(1).maybeSingle();
      return { orgId: checkOrg.id, storeId: store?.id || '' };
    }
  }

  // 2. Vérifier les memberships
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: mem } = await (admin as any).from('memberships').select('organization_id, store_id').eq('user_id', userId).limit(1).maybeSingle();
  if (mem && mem.organization_id) {
    let storeId = mem.store_id;
    if (!storeId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: store } = await (admin as any).from('stores').select('id').eq('organization_id', mem.organization_id).limit(1).maybeSingle();
      storeId = store?.id || '';
    }
    return { orgId: mem.organization_id, storeId: storeId || '' };
  }

  // 3. Vérifier n'importe quelle organisation existante
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: firstOrg } = await (admin as any).from('organizations').select('id').limit(1).maybeSingle();
  if (firstOrg && firstOrg.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: store } = await (admin as any).from('stores').select('id').eq('organization_id', firstOrg.id).limit(1).maybeSingle();
    const storeId = store?.id || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('memberships').upsert({
      user_id: userId,
      organization_id: firstOrg.id,
      store_id: storeId || null,
      role: 'owner'
    }, { onConflict: 'user_id,organization_id' });
    return { orgId: firstOrg.id, storeId };
  }

  // 4. Auto-création complète (Organisation + Dépôt Principal + Membership owner)
  const name = email ? `${email.split('@')[0]} Boutique` : "Ma Boutique Principale";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newOrg, error: orgErr } = await (admin as any).from('organizations').insert({ name }).select().single();
  if (orgErr || !newOrg) {
    throw new Error("Impossible de créer l'entreprise : " + (orgErr?.message || "Erreur Supabase"));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newStore } = await (admin as any).from('stores').insert({
    organization_id: newOrg.id,
    name: 'Dépôt Principal',
    active: true
  }).select().single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('memberships').upsert({
    user_id: userId,
    organization_id: newOrg.id,
    store_id: newStore?.id || null,
    role: 'owner'
  }, { onConflict: 'user_id,organization_id' });

  return { orgId: newOrg.id, storeId: newStore?.id || '' };
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
  organization_id?: string;
}) {
  try {
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return { error: "Non autorisé (session expirée)" };

    let parsedData;
    try {
      parsedData = ProcessSaleSchema.parse(data);
    } catch (e: any) {
      return { error: "Données invalides : " + e.message };
    }

    const admin = getAdmin();
    const { orgId, storeId } = await getOrCreateUserOrg(user.user.id, user.user.email, data.organization_id);
    const targetStoreId = parsedData.store_id || storeId;

    const payload = {
      ...parsedData,
      store_id: targetStoreId,
      organization_id: orgId,
      user_id: user.user.id
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error } = await (admin.rpc as any)('create_sale', { payload });
    if (error) {
      if (error.message.includes('insuffisant')) return { error: "Stock insuffisant pour valider cette vente." };
      if (error.message.includes('obligatoire pour une vente à crédit')) return { error: "Un client est obligatoire pour un crédit." };
      return { error: error.message };
    }
    return { data: result };
  } catch (e: any) {
    return { error: "Erreur serveur : " + (e?.message || String(e)) };
  }
}

export async function payReceivable(data: {
  receivable_id: string;
  amount: number;
  payment_method: string;
  idempotency_key: string;
  organization_id?: string;
}) {
  try {
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return { error: "Non autorisé (session expirée)" };

    const admin = getAdmin();
    const { orgId } = await getOrCreateUserOrg(user.user.id, user.user.email, data.organization_id);

    const payload = {
      ...data,
      organization_id: orgId,
      user_id: user.user.id
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error } = await (admin.rpc as any)('pay_receivable', { payload });
    if (error) return { error: error.message };
    return { data: result };
  } catch (e: any) {
    return { error: "Erreur serveur : " + (e?.message || String(e)) };
  }
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
  organization_id?: string;
}) {
  try {
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return { error: "Non autorisé (session expirée)" };

    let parsedData;
    try {
      parsedData = CreateCustomerSchema.parse(data);
    } catch (e: any) {
      return { error: "Données invalides : " + e.message };
    }

    const admin = getAdmin();
    const { orgId } = await getOrCreateUserOrg(user.user.id, user.user.email, data.organization_id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error } = await (admin as any).from('customers').insert({
      organization_id: orgId,
      name: parsedData.name,
      phone: parsedData.phone || '',
      city: parsedData.city || '',
      active: true
    }).select().single();

    if (error || !result) return { error: "Erreur création client : " + (error?.message || "Erreur Supabase") };
    return { data: result };
  } catch (e: any) {
    return { error: "Erreur serveur : " + (e?.message || String(e)) };
  }
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
  organization_id?: string;
}) {
  try {
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return { error: "Non autorisé (session expirée)" };

    let parsedData;
    try {
      parsedData = CreateStoreSchema.parse(data);
    } catch (e: any) {
      return { error: "Données invalides : " + e.message };
    }

    const admin = getAdmin();
    const { orgId } = await getOrCreateUserOrg(user.user.id, user.user.email, data.organization_id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error } = await (admin as any).from('stores').insert({
      organization_id: orgId,
      name: parsedData.name,
      city: parsedData.city || '',
      allow_negative_stock: parsedData.allow_negative_stock || false,
      active: true
    }).select().single();

    if (error || !result) return { error: "Erreur création dépôt : " + (error?.message || "Impossible d'enregistrer le dépôt") };

    if (result && result.id) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any).from('memberships').update({ store_id: result.id }).eq('user_id', user.user.id).eq('organization_id', orgId);
      } catch {}
    }

    return { data: result };
  } catch (e: any) {
    return { error: "Erreur serveur : " + (e?.message || String(e)) };
  }
}

export async function createClientWorkspace(data: { name: string }) {
  try {
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return { success: false, error: "Non autorisé (session expirée)" };

    const admin = getAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: org, error: orgErr } = await (admin as any).from('organizations').insert({ name: data.name }).select().single();
    if (orgErr || !org) return { success: false, error: "Erreur création entreprise : " + (orgErr?.message || "Erreur Supabase") };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: store } = await (admin as any).from('stores').insert({
      organization_id: org.id,
      name: 'Dépôt Principal',
      active: true
    }).select().single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('memberships').insert({
      user_id: user.user.id,
      organization_id: org.id,
      store_id: store ? store.id : null,
      role: 'owner'
    });

    return { success: true, org };
  } catch (e: any) {
    return { success: false, error: "Erreur serveur : " + (e?.message || String(e)) };
  }
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
  organization_id?: string;
}) {
  try {
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return { error: "Non autorisé (session expirée)" };

    let parsedData;
    try {
      parsedData = CreateProductSchema.parse(data);
    } catch (e: any) {
      return { error: "Données invalides : " + e.message };
    }

    const admin = getAdmin();
    const { orgId, storeId } = await getOrCreateUserOrg(user.user.id, user.user.email, data.organization_id);
    const targetStoreId = parsedData.store_id || storeId;

    const sku = parsedData.sku || `PRD-${Date.now().toString().slice(-6)}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: product, error: prdErr } = await (admin as any).from('products').insert({
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

    if (prdErr || !product) return { error: "Erreur création produit : " + (prdErr?.message || "Erreur Supabase") };

    if (parsedData.initial_quantity > 0 && targetStoreId) {
      const idempotency = `init_prod_${product.id}_${Date.now()}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from('inventory_movements').insert({
        organization_id: orgId,
        store_id: targetStoreId,
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
  } catch (e: any) {
    return { error: "Erreur serveur : " + (e?.message || String(e)) };
  }
}

const AddStockMovementSchema = z.object({
  store_id: z.string().optional(),
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
  movement_type: z.enum(['purchase', 'adjustment', 'correction']),
});

export async function addStockMovement(data: {
  store_id?: string;
  product_id: string;
  quantity: number;
  movement_type: 'purchase' | 'adjustment' | 'correction';
  organization_id?: string;
}) {
  try {
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return { error: "Non autorisé (session expirée)" };

    let parsedData;
    try {
      parsedData = AddStockMovementSchema.parse(data);
    } catch (e: any) {
      return { error: "Données invalides : " + e.message };
    }

    const admin = getAdmin();
    const { orgId, storeId } = await getOrCreateUserOrg(user.user.id, user.user.email, data.organization_id);
    const targetStoreId = parsedData.store_id || storeId;

    const idempotency = `mvt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: mvt, error: mvtErr } = await (admin as any).from('inventory_movements').insert({
      organization_id: orgId,
      store_id: targetStoreId,
      product_id: parsedData.product_id,
      movement_type: parsedData.movement_type,
      quantity: parsedData.quantity,
      reference_type: 'adjustment',
      reference_id: parsedData.product_id,
      created_by: user.user.id,
      idempotency_key: idempotency
    }).select().single();

    if (mvtErr || !mvt) return { error: "Erreur mouvement stock : " + (mvtErr?.message || "Erreur Supabase") };
    return { data: mvt };
  } catch (e: any) {
    return { error: "Erreur serveur : " + (e?.message || String(e)) };
  }
}
