"use server";
import { z } from "zod";

import { getAdmin, getOrCreateUserOrg, createClient } from "./auth";
import { allocatePaymentToDebts } from "../payables";

const CreateSupplierSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
});

export async function createSupplier(data: {
  name: string;
  phone?: string;
  organization_id?: string;
}) {
  try {
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return { error: "Non autorisé (session expirée)" };

    let parsedData;
    try {
      parsedData = CreateSupplierSchema.parse(data);
    } catch (e) {
      return { error: "Données invalides : " + (e instanceof Error ? e.message : String(e)) };
    }

    const admin = await getAdmin();
    const { orgId } = await getOrCreateUserOrg(user.user.id, user.user.email, data.organization_id);

    const { data: result, error } = await admin.from('suppliers').insert({
      organization_id: orgId,
      name: parsedData.name,
      phone: parsedData.phone || '',
      active: true
    }).select().single();

    if (error || !result) return { error: "Erreur création fournisseur : " + (error?.message || "Erreur Supabase") };
    return { data: result };
  } catch (e) {
    return { error: "Erreur serveur : " + (e instanceof Error ? e.message : String(e)) };
  }
}

export async function paySupplier(data: {
  supplier_id: string;
  amount: number;
  payment_method: string;
  organization_id?: string;
}) {
  try {
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return { error: "Non autorisé (session expirée)" };

    const admin = await getAdmin();
    const { orgId } = await getOrCreateUserOrg(user.user.id, user.user.email, data.organization_id);

    const idempotency_key = `paysup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 1. Enregistrer le paiement (décaissement)
    const { error: payErr } = await admin.from('payments').insert({
      organization_id: orgId,
      supplier_id: data.supplier_id,
      amount: data.amount,
      method: data.payment_method,
      direction: 'out',
      created_by: user.user.id,
      idempotency_key
    });

    if (payErr) return { error: "Erreur enregistrement paiement : " + payErr.message };

    // 2. Mettre à jour les payables (on simplifie : on récupère les dettes non soldées et on rembourse en cascade)
    const { data: openPayables } = await admin.from('payables')
      .select('*')
      .eq('organization_id', orgId)
      .eq('supplier_id', data.supplier_id)
      .in('status', ['open', 'late'])
      .order('created_at', { ascending: true });

    if (openPayables) {
      const updates = allocatePaymentToDebts(openPayables, data.amount);
      for (const u of updates) {
        await admin.from('payables').update({ amount_paid: u.amount_paid, status: u.status }).eq('id', u.id);
      }
    }

    return { data: { success: true } };
  } catch (e) {
    return { error: "Erreur serveur : " + (e instanceof Error ? e.message : String(e)) };
  }
}
