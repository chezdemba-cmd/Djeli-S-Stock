"use server";
import { z } from "zod";

import { getAdmin, getOrCreateUserOrg, createClient } from "./auth";

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

const AddStockMovementSchema = z.object({
  store_id: z.string().optional(),
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
  movement_type: z.enum(['purchase', 'adjustment', 'correction']),
  supplier_id: z.string().uuid().optional(),
  payable_amount: z.number().nonnegative().optional(),
  amount_paid: z.number().nonnegative().optional(),
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
    } catch (e) {
      return { error: "Données invalides : " + (e instanceof Error ? e.message : String(e)) };
    }

    const admin = await getAdmin();
    const { orgId, storeId } = await getOrCreateUserOrg(user.user.id, user.user.email, data.organization_id);
    const targetStoreId = parsedData.store_id || storeId;

    const sku = parsedData.sku || `PRD-${Date.now().toString().slice(-6)}`;

    const { data: product, error: prdErr } = await admin.from('products').insert({
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
      await admin.from('inventory_movements').insert({
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
  } catch (e) {
    return { error: "Erreur serveur : " + (e instanceof Error ? e.message : String(e)) };
  }
}

export async function addStockMovement(data: {
  store_id?: string;
  product_id: string;
  quantity: number;
  movement_type: 'purchase' | 'adjustment' | 'correction';
  organization_id?: string;
  supplier_id?: string;
  payable_amount?: number;
  amount_paid?: number;
}) {
  try {
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return { error: "Non autorisé (session expirée)" };

    let parsedData;
    try {
      parsedData = AddStockMovementSchema.parse(data);
    } catch (e) {
      return { error: "Données invalides : " + (e instanceof Error ? e.message : String(e)) };
    }

    const admin = await getAdmin();
    const { orgId, storeId } = await getOrCreateUserOrg(user.user.id, user.user.email, data.organization_id);
    const targetStoreId = parsedData.store_id || storeId;

    const idempotency = `mvt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // 1. Enregistrer le mouvement de stock
    const { data: mvt, error: mvtErr } = await admin.from('inventory_movements').insert({
      organization_id: orgId,
      store_id: targetStoreId,
      product_id: parsedData.product_id,
      movement_type: parsedData.movement_type,
      quantity: parsedData.quantity,
      reference_type: parsedData.movement_type === 'purchase' ? 'purchase' : 'adjustment',
      reference_id: parsedData.product_id, // simplified, should be a real purchase order ID normally
      created_by: user.user.id,
      idempotency_key: idempotency
    }).select().single();

    if (mvtErr || !mvt) return { error: "Erreur mouvement stock : " + (mvtErr?.message || "Erreur Supabase") };

    // 2. Si c'est un achat fournisseur avec une dette (payable)
    if (parsedData.supplier_id && parsedData.payable_amount && parsedData.payable_amount > 0) {
      const payableIdempotency = `payb_${idempotency}`;
      const amountPaid = parsedData.amount_paid || 0;
      
      await admin.from('payables').insert({
        organization_id: orgId,
        supplier_id: parsedData.supplier_id,
        store_id: targetStoreId,
        amount: parsedData.payable_amount,
        amount_paid: amountPaid,
        status: amountPaid >= parsedData.payable_amount ? 'paid' : 'open',
        created_by: user.user.id,
        idempotency_key: payableIdempotency
      });

      // Si une partie ou tout a été payé, on trace le décaissement dans la table payments
      if (amountPaid > 0) {
        await admin.from('payments').insert({
          organization_id: orgId,
          supplier_id: parsedData.supplier_id,
          amount: amountPaid,
          method: 'cash', // Defaulting to cash for inline payments
          direction: 'out',
          created_by: user.user.id,
          idempotency_key: `pmt_${payableIdempotency}`
        });
      }
    }

    return { data: mvt };
  } catch (e) {
    return { error: "Erreur serveur : " + (e instanceof Error ? e.message : String(e)) };
  }
}
