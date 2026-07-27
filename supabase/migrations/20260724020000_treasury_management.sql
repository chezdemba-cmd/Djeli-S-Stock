-- Migration 20260724020000_treasury_management.sql

-- 1. Enable RLS on expenses if not already enabled
alter table public.expenses enable row level security;

-- 2. Add RLS policies for expenses
create policy "Org isolation select expenses" on public.expenses 
  for select using (organization_id in (select public.current_orgs()));

create policy "Org isolation insert expenses" on public.expenses 
  for insert with check (organization_id in (select public.current_orgs()));

-- 3. Create a unified ledger view for Treasury
create or replace view public.treasury_ledger with (security_invoker = true) as
select 
  p.id, 
  p.organization_id, 
  'payment' as source_table,
  case when p.direction = 'in' then p.amount else -p.amount end as net_amount,
  p.direction as flow_direction,
  case 
    when p.customer_id is not null then 'Encaissement Client'
    when p.supplier_id is not null then 'Règlement Fournisseur'
    else 'Paiement'
  end as description,
  p.method::text as payment_method,
  p.created_at,
  p.created_by
from public.payments p
union all
select 
  e.id, 
  e.organization_id, 
  'expense' as source_table,
  -e.amount as net_amount,
  'out' as flow_direction,
  e.reason as description,
  'cash' as payment_method,
  e.created_at,
  e.created_by
from public.expenses e;
