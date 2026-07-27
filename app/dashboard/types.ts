export type Product = { id: string; name: string; sku: string; category: string; unit: string; quantity: number; minStock: number; purchasePrice: number; salePrice: number; };
export type Movement = { id: string; product: string; type: "Entrée" | "Sortie" | "Vente"; quantity: number; date: string; rawDate?: string; author: string; };
export type Customer = { id: string; name: string; phone: string; city: string; balance: number; dueDate: string; status: "À jour" | "À relancer" | "En retard"; };
export type Supplier = { id: string; name: string; phone: string; balance: number; status: "À régler" | "À jour"; };
export type Depot = { id: string; name: string; city: string; manager: string; references: number; stockValue: number; };

export interface TreasuryTransaction {
  id: string;
  source_table: 'payment' | 'expense';
  net_amount: number;
  flow_direction: 'in' | 'out';
  description: string;
  payment_method?: string;
  date: string;
  rawDate?: string;
  author: string;
}
