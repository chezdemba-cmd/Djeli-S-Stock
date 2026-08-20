import { ProcessSaleSchema, CreateExpenseSchema } from "../lib/db/schemas";

describe('Security Tests: Server Actions Validation', () => {
  describe('ProcessSaleSchema Validation', () => {
    const baseValidPayload = {
      store_id: "123e4567-e89b-12d3-a456-426614174000",
      items: [{ product_id: "123e4567-e89b-12d3-a456-426614174001", quantity: 2, unit_price: 1500 }],
      total_amount: 3000,
      paid_amount: 3000,
      payment_method: "cash",
      idempotency_key: "key_1"
    };

    test('Accepte un payload de vente valide', () => {
      expect(() => ProcessSaleSchema.parse(baseValidPayload)).not.toThrow();
    });

    test('Rejette une tentative de vente avec une quantité négative (prévention vol)', () => {
      const maliciousPayload = {
        ...baseValidPayload,
        items: [{ product_id: "123e4567-e89b-12d3-a456-426614174001", quantity: -5, unit_price: 1500 }],
      };
      expect(() => ProcessSaleSchema.parse(maliciousPayload)).toThrow();
    });

    test('Rejette un paiement négatif (injection de solde)', () => {
      const maliciousPayload = {
        ...baseValidPayload,
        paid_amount: -1000,
      };
      expect(() => ProcessSaleSchema.parse(maliciousPayload)).toThrow();
    });

    test('Rejette un store_id invalide (SQL injection basique UUID)', () => {
      const maliciousPayload = {
        ...baseValidPayload,
        store_id: "drop table users;--",
      };
      expect(() => ProcessSaleSchema.parse(maliciousPayload)).toThrow();
    });
  });

  describe('CreateExpenseSchema Validation (Trésorerie)', () => {
    const validExpense = {
      store_id: "123e4567-e89b-12d3-a456-426614174000",
      amount: 5000,
      reason: "Paiement facture électricité",
      idempotency_key: "exp_1"
    };

    test('Accepte une dépense valide', () => {
      expect(() => CreateExpenseSchema.parse(validExpense)).not.toThrow();
    });

    test('Rejette une dépense avec montant négatif ou nul', () => {
      expect(() => CreateExpenseSchema.parse({ ...validExpense, amount: 0 })).toThrow();
      expect(() => CreateExpenseSchema.parse({ ...validExpense, amount: -500 })).toThrow();
    });

    test('Rejette une dépense sans raison (Anti Spam Trésorerie)', () => {
      expect(() => CreateExpenseSchema.parse({ ...validExpense, reason: "" })).toThrow();
    });
  });
});
