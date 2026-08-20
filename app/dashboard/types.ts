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

export type Employee = {
  organization_id: string;
  user_id: string;
  full_name: string;
  role: string;
  store_id: string | null;
  store_name: string | null;
  membership_id: string;
  created_at: string;
};

export type Receipt = {
  date: string;
  productName: string;
  quantity: number;
  total: number;
  paid: number;
  due: number;
  customerPhone?: string | null;
};

export type ModalType =
  | "product" | "movement" | "customer" | "supplier" | "depot" | "sale"
  | "receipt" | "new_client" | "inflow" | "payment" | "pay_supplier"
  | "new_employee" | "expense" | null;
