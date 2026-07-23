import { z } from "zod";

// --- Schémas de base ---
const SaleItemSchema = z.object({
  search_term: z.string().describe("Le nom du produit dicté par l'utilisateur"),
  quantity: z.number().positive().describe("Quantité vendue"),
  unit_price: z.number().positive().optional().describe("Prix unitaire s'il est explicitement mentionné"),
});

const PaymentSchema = z.object({
  amount: z.number().positive().describe("Montant payé ou reçu"),
  method: z.enum(["cash", "mobile_money", "card", "bank_transfer"]).default("cash"),
});

// --- Schémas des Intentions ---
export const IntentCreateSaleSchema = z.object({
  intent: z.literal("create_sale"),
  items: z.array(SaleItemSchema).min(1),
  payment: PaymentSchema.optional().describe("Informations de paiement si renseignées"),
  customer_search_term: z.string().optional().describe("Nom du client, obligatoire si paiement partiel"),
});

export const IntentCreatePurchaseSchema = z.object({
  intent: z.literal("create_purchase"),
  items: z.array(SaleItemSchema).min(1),
  payment: PaymentSchema.optional(),
  supplier_search_term: z.string().optional(),
});

export const IntentCreateExpenseSchema = z.object({
  intent: z.literal("create_expense"),
  amount: z.number().positive(),
  reason: z.string(),
  payment_method: z.enum(["cash", "mobile_money", "card", "bank_transfer"]).default("cash"),
});

export const IntentDebtPaymentSchema = z.object({
  intent: z.literal("record_customer_payment"),
  customer_search_term: z.string(),
  payment: PaymentSchema,
});

export const IntentQuerySchema = z.object({
  intent: z.enum(["query_stock", "query_today_summary", "query_customer_debts", "query_low_stock"]),
  search_term: z.string().optional().describe("Sujet de la requête (ex: nom du produit pour query_stock)"),
});

export const IntentCancelSchema = z.object({
  intent: z.literal("cancel_or_correct_transaction"),
  reason: z.string().describe("Raison de l'annulation"),
});

export const IntentUnknownSchema = z.object({
  intent: z.literal("unknown"),
  reason: z.string().describe("Pourquoi l'intention n'a pas pu être déterminée ou est malveillante"),
});

// --- Schéma global de retour LLM ---
export const LLMResponseSchema = z.object({
  confidence: z.number().min(0).max(1),
  missing_info_question: z.string().nullable().describe("Question à poser si des infos critiques manquent (ex: quel client ?)"),
  data: z.discriminatedUnion("intent", [
    IntentCreateSaleSchema,
    IntentCreatePurchaseSchema,
    IntentCreateExpenseSchema,
    IntentDebtPaymentSchema,
    IntentQuerySchema,
    IntentCancelSchema,
    IntentUnknownSchema
  ])
});

export type LLMResponse = z.infer<typeof LLMResponseSchema>;

// --- Moteur de Rapprochement (Mock) ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function evaluateIntent(llmResponse: LLMResponse, context: { products: any[], customers: any[] }) {
  if (llmResponse.confidence < 0.7 || llmResponse.data.intent === "unknown") {
    return { status: "REJECTED", message: llmResponse.data.intent === "unknown" ? llmResponse.data.reason : "Je n'ai pas bien compris. Pouvez-vous reformuler ?" };
  }

  if (llmResponse.missing_info_question) {
    return { status: "AMBIGUOUS", message: llmResponse.missing_info_question };
  }

  // Exemple de rapprochement pour une vente
  if (llmResponse.data.intent === "create_sale") {
    const sale = llmResponse.data;
    
    // Règle métier : Crédit sans client
    const total_calc = sale.items.reduce((sum, item) => sum + (item.unit_price || 0) * item.quantity, 0);
    const paid = sale.payment?.amount || 0;
    
    if (paid < total_calc && !sale.customer_search_term) {
      return { status: "AMBIGUOUS", message: "À qui faites-vous ce crédit ? Précisez le nom du client." };
    }

    return { status: "READY_FOR_PREVIEW", data: sale };
  }

  return { status: "READY_FOR_PREVIEW", data: llmResponse.data };
}
