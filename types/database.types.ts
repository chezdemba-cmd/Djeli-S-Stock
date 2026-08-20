export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: { id: string; name: string; currency: string; timezone: string; created_at: string; }
        Insert: { id?: string; name: string; currency?: string; timezone?: string; created_at?: string; }
        Update: { id?: string; name?: string; currency?: string; timezone?: string; created_at?: string; }
        Relationships: { foreignKeyName: string; columns: string[]; isOneToOne?: boolean; referencedRelation: string; referencedColumns: string[]; }[]
      }
      profiles: {
        Row: { id: string; full_name: string; is_super_admin: boolean; created_at: string; }
        Insert: { id: string; full_name: string; is_super_admin?: boolean; created_at?: string; }
        Update: { id?: string; full_name?: string; is_super_admin?: boolean; created_at?: string; }
        Relationships: { foreignKeyName: string; columns: string[]; isOneToOne?: boolean; referencedRelation: string; referencedColumns: string[]; }[]
      }
      stores: {
        Row: { id: string; organization_id: string; name: string; city: string | null; allow_negative_stock: boolean; active: boolean; created_at: string; }
        Insert: { id?: string; organization_id: string; name: string; city?: string | null; allow_negative_stock?: boolean; active?: boolean; created_at?: string; }
        Update: { id?: string; organization_id?: string; name?: string; city?: string | null; allow_negative_stock?: boolean; active?: boolean; created_at?: string; }
        Relationships: { foreignKeyName: string; columns: string[]; isOneToOne?: boolean; referencedRelation: string; referencedColumns: string[]; }[]
      }
      memberships: {
        Row: { user_id: string; organization_id: string; store_id: string | null; role: string; }
        Insert: { user_id: string; organization_id: string; store_id?: string | null; role: string; }
        Update: { user_id?: string; organization_id?: string; store_id?: string | null; role?: string; }
        Relationships: { foreignKeyName: string; columns: string[]; isOneToOne?: boolean; referencedRelation: string; referencedColumns: string[]; }[]
      }
      products: {
        Row: { id: string; organization_id: string; sku: string; name: string; category: string | null; unit: string; purchase_price: number; sale_price: number; min_stock: number; active: boolean; idempotency_key: string | null; created_at: string; }
        Insert: { id?: string; organization_id: string; sku: string; name: string; category?: string; unit: string; purchase_price: number; sale_price: number; min_stock?: number; active?: boolean; idempotency_key?: string; created_at?: string; }
        Update: { id?: string; organization_id?: string; sku?: string; name?: string; category?: string; unit?: string; purchase_price?: number; sale_price?: number; min_stock?: number; active?: boolean; idempotency_key?: string; created_at?: string; }
        Relationships: { foreignKeyName: string; columns: string[]; isOneToOne?: boolean; referencedRelation: string; referencedColumns: string[]; }[]
      }
      customers: {
        Row: { id: string; organization_id: string; name: string; phone: string | null; city: string | null; active: boolean; created_at: string; }
        Insert: { id?: string; organization_id: string; name: string; phone?: string | null; city?: string | null; active?: boolean; created_at?: string; }
        Update: { id?: string; organization_id?: string; name?: string; phone?: string | null; city?: string | null; active?: boolean; created_at?: string; }
        Relationships: { foreignKeyName: string; columns: string[]; isOneToOne?: boolean; referencedRelation: string; referencedColumns: string[]; }[]
      }
      suppliers: {
        Row: { id: string; organization_id: string; name: string; phone: string | null; active: boolean; created_at: string; }
        Insert: { id?: string; organization_id: string; name: string; phone?: string | null; active?: boolean; created_at?: string; }
        Update: { id?: string; organization_id?: string; name?: string; phone?: string | null; active?: boolean; created_at?: string; }
        Relationships: { foreignKeyName: string; columns: string[]; isOneToOne?: boolean; referencedRelation: string; referencedColumns: string[]; }[]
      }
      sales: {
        Row: { id: string; organization_id: string; store_id: string; total_amount: number; paid_amount: number; status: string; idempotency_key: string; created_by: string; created_at: string; }
        Insert: { id?: string; organization_id: string; store_id: string; total_amount: number; paid_amount?: number; status?: string; idempotency_key: string; created_by: string; created_at?: string; }
        Update: { id?: string; organization_id?: string; store_id?: string; total_amount?: number; paid_amount?: number; status?: string; idempotency_key?: string; created_by?: string; created_at?: string; }
        Relationships: { foreignKeyName: string; columns: string[]; isOneToOne?: boolean; referencedRelation: string; referencedColumns: string[]; }[]
      }
      inventory_movements: {
        Row: { id: string; organization_id: string; store_id: string; product_id: string; movement_type: string; quantity: number; reference_type: string; reference_id: string; idempotency_key: string; created_by: string; created_at: string; products?: { name: string } }
        Insert: { id?: string; organization_id: string; store_id: string; product_id: string; movement_type: string; quantity: number; reference_type: string; reference_id: string; idempotency_key: string; created_by: string; created_at?: string; }
        Update: { id?: string; organization_id?: string; store_id?: string; product_id?: string; movement_type?: string; quantity?: number; reference_type?: string; reference_id?: string; idempotency_key?: string; created_by?: string; created_at?: string; }
        Relationships: { foreignKeyName: string; columns: string[]; isOneToOne?: boolean; referencedRelation: string; referencedColumns: string[]; }[]
      }
      receivables: {
        Row: { id: string; organization_id: string; store_id: string | null; customer_id: string; amount: number; amount_paid: number; status: string; idempotency_key: string; created_by: string; created_at: string; }
        Insert: { id?: string; organization_id: string; store_id?: string | null; customer_id: string; amount: number; amount_paid?: number; status?: string; idempotency_key: string; created_by: string; created_at?: string; }
        Update: { id?: string; organization_id?: string; store_id?: string | null; customer_id?: string; amount?: number; amount_paid?: number; status?: string; idempotency_key?: string; created_by?: string; created_at?: string; }
        Relationships: { foreignKeyName: string; columns: string[]; isOneToOne?: boolean; referencedRelation: string; referencedColumns: string[]; }[]
      }
      payables: {
        Row: { id: string; organization_id: string; store_id: string | null; supplier_id: string; amount: number; amount_paid: number; status: string; idempotency_key: string; created_by: string; created_at: string; }
        Insert: { id?: string; organization_id: string; store_id?: string | null; supplier_id: string; amount: number; amount_paid?: number; status?: string; idempotency_key: string; created_by: string; created_at?: string; }
        Update: { id?: string; organization_id?: string; store_id?: string | null; supplier_id?: string; amount?: number; amount_paid?: number; status?: string; idempotency_key?: string; created_by?: string; created_at?: string; }
        Relationships: { foreignKeyName: string; columns: string[]; isOneToOne?: boolean; referencedRelation: string; referencedColumns: string[]; }[]
      }
      payments: {
        Row: { id: string; organization_id: string; supplier_id: string | null; customer_id: string | null; amount: number; method: string; direction: string; created_by: string; idempotency_key: string; created_at: string; }
        Insert: { id?: string; organization_id: string; supplier_id?: string | null; customer_id?: string | null; amount: number; method: string; direction: string; created_by: string; idempotency_key: string; created_at?: string; }
        Update: { id?: string; organization_id?: string; supplier_id?: string | null; customer_id?: string | null; amount?: number; method?: string; direction?: string; created_by?: string; idempotency_key?: string; created_at?: string; }
        Relationships: { foreignKeyName: string; columns: string[]; isOneToOne?: boolean; referencedRelation: string; referencedColumns: string[]; }[]
      }
      expenses: {
        Row: { id: string; organization_id: string; store_id: string; amount: number; reason: string; created_by: string; idempotency_key: string; created_at: string; }
        Insert: { id?: string; organization_id: string; store_id: string; amount: number; reason: string; created_by: string; idempotency_key: string; created_at?: string; }
        Update: { id?: string; organization_id?: string; store_id?: string; amount?: number; reason?: string; created_by?: string; idempotency_key?: string; created_at?: string; }
        Relationships: { foreignKeyName: string; columns: string[]; isOneToOne?: boolean; referencedRelation: string; referencedColumns: string[]; }[]
      }
      voice_commands: {
        Row: { id: string; organization_id: string; created_by: string; transcription: string; language: string; intent: Json | null; confidence: number | null; status: string; error_message: string | null; reference_id: string | null; created_at: string; }
        Insert: { id?: string; organization_id: string; created_by: string; transcription: string; language?: string; intent?: Json; confidence?: number; status?: string; error_message?: string; reference_id?: string; created_at?: string; }
        Update: { id?: string; organization_id?: string; created_by?: string; transcription?: string; language?: string; intent?: Json; confidence?: number; status?: string; error_message?: string; reference_id?: string; created_at?: string; }
        Relationships: { foreignKeyName: string; columns: string[]; isOneToOne?: boolean; referencedRelation: string; referencedColumns: string[]; }[]
      }
    }
    Functions: {
      get_accessible_orgs: {
        Args: Record<string, never>;
        Returns: { id: string; name: string }[];
      };
      create_sale: { Args: { payload: Json }; Returns: Json; };
      pay_receivable: { Args: { payload: Json }; Returns: Json; };
      current_orgs: {
        Args: Record<string, never>;
        Returns: string[];
      };
      bootstrap_user_organization: {
        Args: { p_name?: string };
        Returns: Json;
      };
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
    Views: {
      current_stock: {
        Row: { organization_id: string; store_id: string; product_id: string; quantity: number; }; Relationships: { foreignKeyName: string; columns: string[]; isOneToOne?: boolean; referencedRelation: string; referencedColumns: string[]; }[]
      }
      org_employees: {
        Row: { organization_id: string; user_id: string; full_name: string; role: string; store_id: string | null; store_name: string | null; membership_id: string; created_at: string; }; Relationships: { foreignKeyName: string; columns: string[]; isOneToOne?: boolean; referencedRelation: string; referencedColumns: string[]; }[]
      }
      treasury_ledger: {
        Row: { id: string; organization_id: string; source_table: 'payment' | 'expense'; net_amount: number; flow_direction: 'in' | 'out'; description: string; payment_method: string; created_at: string; created_by: string; profiles?: { full_name: string } }; Relationships: { foreignKeyName: string; columns: string[]; isOneToOne?: boolean; referencedRelation: string; referencedColumns: string[]; }[]
      }
    }
  }
}
