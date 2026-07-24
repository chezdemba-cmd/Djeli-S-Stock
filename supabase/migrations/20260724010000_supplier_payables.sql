-- Migration 20260724010000_supplier_payables.sql

create table public.payables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id),
  store_id uuid references public.stores(id),
  amount bigint not null check (amount > 0),
  amount_paid bigint not null default 0 check (amount_paid >= 0 and amount_paid <= amount),
  due_date date,
  status text not null default 'open' check (status in ('open', 'late', 'paid', 'cancelled')),
  created_by uuid not null references public.profiles(id),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

-- RLS setup
alter table public.payables enable row level security;

-- Policies for payables
create policy "Org isolation select payables" on public.payables for select using (organization_id in (select public.current_orgs()));
create policy "Org isolation insert payables" on public.payables for insert with check (organization_id in (select public.current_orgs()));
create policy "Org isolation update payables" on public.payables for update using (organization_id in (select public.current_orgs()));

-- Trigger to prevent update/delete on critical tables (optional but good practice to maintain immutable financial records)
create trigger tr_prevent_update_payables before delete on public.payables for each row execute function public.prevent_update_delete();
