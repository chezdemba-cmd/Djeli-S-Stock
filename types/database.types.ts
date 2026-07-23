// Types générés manuellement représentant le schéma Supabase.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: { id: string; name: string; currency: string; timezone: string; created_at: string; }
        Insert: { name: string; currency?: string; timezone?: string; }
      }
      products: {
        Row: { id: string; organization_id: string; sku: string; name: string; category: string | null; unit: string; purchase_price: number; sale_price: number; min_stock: number; idempotency_key: string | null; created_at: string; }
        Insert: { organization_id: string; sku: string; name: string; category?: string; unit: string; purchase_price: number; sale_price: number; min_stock?: number; idempotency_key?: string; }
      }
      sales: {
        Row: { id: string; organization_id: string; store_id: string; total_amount: number; paid_amount: number; status: string; idempotency_key: string; created_by: string; created_at: string; }
        Insert: { organization_id: string; store_id: string; total_amount: number; paid_amount?: number; status?: string; idempotency_key: string; created_by: string; }
      }
      inventory_movements: {
        Row: { id: string; organization_id: string; store_id: string; product_id: string; movement_type: string; quantity: number; reference_type: string; reference_id: string; idempotency_key: string; created_by: string; created_at: string; }
        Insert: { organization_id: string; store_id: string; product_id: string; movement_type: string; quantity: number; reference_type: string; reference_id: string; idempotency_key: string; created_by: string; }
      }
      voice_commands: {
        Row: { id: string; organization_id: string; created_by: string; transcription: string; language: string; intent: Json | null; confidence: number | null; status: string; error_message: string | null; reference_id: string | null; created_at: string; }
        Insert: { organization_id: string; created_by: string; transcription: string; language?: string; intent?: Json; confidence?: number; status?: string; error_message?: string; reference_id?: string; }
      }
    }
  }
}
