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
  if (!user.user) throw new Error("Non autorisé");

  // VALIDATION SECURISEE
  const parsedData = ProcessSaleSchema.parse(data);

  const orgId = data.organization_id;
  if (!orgId) throw new Error("Organisation manquante");

  const payload = {
    ...parsedData,
    organization_id: orgId,
    user_id: user.user.id
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: result, error } = await (supabase.rpc as any)('create_sale', { payload });
  if (error) {
    if (error.message.includes('insuffisant')) {
      throw new Error("Stock insuffisant pour valider cette vente.");
    }
    if (error.message.includes('obligatoire pour une vente à crédit')) {
      throw new Error("Un client est obligatoire pour un crédit.");
    }
    throw new Error(error.message);
  }
  return result;
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
  if (!user.user) throw new Error("Non autorisé");

  const orgId = data.organization_id;
  if (!orgId) throw new Error("Organisation manquante");

  const payload = {
    ...data,
    organization_id: orgId,
    user_id: user.user.id
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: result, error } = await (supabase.rpc as any)('pay_receivable', { payload });
  if (error) throw new Error(error.message);
  return result;
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
  if (!user.user) throw new Error("Non autorisé");

  const orgId = data.organization_id;
  if (!orgId) throw new Error("Organisation manquante");

  const parsedData = CreateCustomerSchema.parse(data);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: result, error } = await (supabase as any).from('customers').insert({
    organization_id: orgId,
    name: parsedData.name,
    phone: parsedData.phone,
    city: parsedData.city,
    active: true
  }).select().single();

  if (error) throw new Error(error.message);
  return result;
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
  if (!user.user) throw new Error("Non autorisé");

  const orgId = data.organization_id;
  if (!orgId) throw new Error("Organisation manquante");

  const parsedData = CreateStoreSchema.parse(data);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: result, error } = await (supabase as any).from('stores').insert({
    organization_id: orgId,
    name: parsedData.name,
    city: parsedData.city,
    allow_negative_stock: parsedData.allow_negative_stock,
    active: true
  }).select().single();

  if (error) throw new Error(error.message);
  return result;
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
