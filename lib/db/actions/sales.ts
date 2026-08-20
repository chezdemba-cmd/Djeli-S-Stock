"use server";
import { z } from "zod";

import { getAdmin, getOrCreateUserOrg, createClient } from "./auth";

import { SaleItemInput, ProcessSaleSchema } from '../schemas';

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
      user_id: user.user.id
    };

    const { data: result, error } = await admin.rpc('create_sale', { payload });
    if (error) {
      if (error.message.includes('insuffisant')) return { error: "Stock insuffisant pour valider cette vente." };
      if (error.message.includes('obligatoire pour une vente à crédit')) return { error: "Un client est obligatoire pour un crédit." };
      return { error: error.message };
    }
    return { data: result };
  } catch (e) {
    return { error: "Erreur serveur : " + (e instanceof Error ? e.message : String(e)) };
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

    const admin = await getAdmin();
    const { orgId } = await getOrCreateUserOrg(user.user.id, user.user.email, data.organization_id);

    const payload = {
      ...data,
      organization_id: orgId,
      user_id: user.user.id
    };

    const { data: result, error } = await admin.rpc('pay_receivable', { payload });
    if (error) return { error: error.message };
    return { data: result };
  } catch (e) {
    return { error: "Erreur serveur : " + (e instanceof Error ? e.message : String(e)) };
  }
}
