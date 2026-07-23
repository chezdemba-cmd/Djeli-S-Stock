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

describe('Security Tests: Server Actions Validation', () => {
  const baseValidPayload = {
    store_id: "123e4567-e89b-12d3-a456-426614174000",
    items: [{ product_id: "123e4567-e89b-12d3-a456-426614174001", quantity: 2, unit_price: 1500 }],
    total_amount: 3000,
    paid_amount: 3000,
    payment_method: "cash",
    idempotency_key: "key_1"
  };

  test('Accepte un payload valide', () => {
    expect(() => ProcessSaleSchema.parse(baseValidPayload)).not.toThrow();
  });

  test('Rejette une tentative de vente avec une quantité négative (vol ou erreur)', () => {
    const maliciousPayload = {
      ...baseValidPayload,
      items: [{ product_id: "123e4567-e89b-12d3-a456-426614174001", quantity: -5, unit_price: 1500 }],
    };
    expect(() => ProcessSaleSchema.parse(maliciousPayload)).toThrow();
  });

  test('Rejette un paiement négatif (injection)', () => {
    const maliciousPayload = {
      ...baseValidPayload,
      paid_amount: -1000,
    };
    expect(() => ProcessSaleSchema.parse(maliciousPayload)).toThrow();
  });

  test('Rejette un store_id non-uuid (SQL injection basique sur les actions type cast)', () => {
    const maliciousPayload = {
      ...baseValidPayload,
      store_id: "drop table users;--",
    };
    expect(() => ProcessSaleSchema.parse(maliciousPayload)).toThrow();
  });
});
