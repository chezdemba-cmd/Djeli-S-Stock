import { z } from "zod";

export const SaleItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
});

export type SaleItemInput = z.infer<typeof SaleItemSchema>;

export const ProcessSaleSchema = z.object({
  store_id: z.string().uuid(),
  items: z.array(SaleItemSchema).min(1),
  total_amount: z.number().nonnegative(),
  paid_amount: z.number().nonnegative(),
  payment_method: z.enum(['cash', 'mobile_money', 'card', 'bank_transfer']),
  customer_id: z.string().uuid().optional(),
  due_date: z.string().optional(),
  idempotency_key: z.string().min(1),
});

export const CreateExpenseSchema = z.object({
  store_id: z.string().uuid(),
  amount: z.number().positive(),
  reason: z.string().min(1),
  organization_id: z.string().uuid().optional(),
  idempotency_key: z.string().min(1),
});
