"use server";
import { z } from "zod";
import { getAdmin, getOrCreateUserOrg, createClient } from "./auth";

const CreateExpenseSchema = z.object({
  store_id: z.string().uuid(),
  amount: z.number().positive(),
  reason: z.string().min(1),
  organization_id: z.string().uuid().optional(),
  idempotency_key: z.string().min(1)
});

export async function createExpense(data: {
  store_id: string;
  amount: number;
  reason: string;
  organization_id?: string;
  idempotency_key: string;
}) {
  try {
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return { error: "Non autorisé (session expirée)" };

    let parsedData;
    try {
      parsedData = CreateExpenseSchema.parse(data);
    } catch (e) {
      return { error: "Données invalides : " + (e instanceof Error ? e.message : String(e)) };
    }

    const admin = await getAdmin();
    const { orgId, storeId } = await getOrCreateUserOrg(user.user.id, user.user.email, data.organization_id);
    const targetStoreId = parsedData.store_id || storeId;

    const payload = {
      ...parsedData,
      store_id: targetStoreId,
      organization_id: orgId,
      created_by: user.user.id
    };

    const { data: result, error } = await admin
      .from('expenses')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }
    return { data: result };
  } catch (e) {
    return { error: "Erreur serveur : " + (e instanceof Error ? e.message : String(e)) };
  }
}
