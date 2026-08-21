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

export async function cancelMovement(movement_id: string, organization_id?: string) {
  try {
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return { error: "Non autorisé (session expirée)" };

    const admin = await getAdmin();
    const { orgId } = await getOrCreateUserOrg(user.user.id, user.user.email, organization_id);

    // 1. Fetch movement
    const { data: movement } = await admin.from('inventory_movements').select('*').eq('id', movement_id).eq('organization_id', orgId).single();
    if (!movement) return { error: "Mouvement introuvable." };
    
    // Prevent duplicate cancel
    const { data: existingCancel } = await admin.from('inventory_movements').select('*').eq('reference_id', movement_id).eq('reference_type', 'cancellation').single();
    if (existingCancel) return { error: "Ce mouvement a déjà été annulé/retourné." };

    const newMovement = {
      organization_id: movement.organization_id,
      store_id: movement.store_id,
      product_id: movement.product_id,
      movement_type: movement.movement_type === 'OUT' ? 'IN' : 'OUT',
      quantity: movement.quantity,
      reference_type: 'cancellation',
      reference_id: movement.id,
      idempotency_key: `cancel-${movement.id}-${Date.now()}`,
      created_by: user.user.id
    };
    
    const { error: insertErr } = await admin.from('inventory_movements').insert(newMovement);
    if (insertErr) return { error: insertErr.message };

    // If it was a sale/outflow, log a cash outflow (refund)
    if (movement.reference_type === 'sale' && movement.movement_type === 'OUT') {
       const { data: product } = await admin.from('products').select('sale_price').eq('id', movement.product_id).single();
       if (product) {
         await admin.from('expenses').insert({
           organization_id: movement.organization_id,
           store_id: movement.store_id,
           amount: product.sale_price * movement.quantity,
           reason: 'Remboursement suite annulation vente (Retour)',
           created_by: user.user.id,
           idempotency_key: `refund-${movement.id}-${Date.now()}`
         });
       }
    }

    return { data: true };
  } catch (e) {
    return { error: "Erreur serveur : " + (e instanceof Error ? e.message : String(e)) };
  }
}
