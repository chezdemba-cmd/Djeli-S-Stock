-- Migration 20260722100000_core_mvp.sql
create extension if not exists "pgcrypto";

create type public.app_role as enum ('owner', 'manager', 'seller');
create type public.movement_type as enum ('purchase', 'sale', 'transfer_in', 'transfer_out', 'loss', 'adjustment', 'correction');
create type public.payment_method as enum ('cash', 'mobile_money', 'card', 'bank_transfer');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'XOF',
  timezone text not null default 'Africa/Bamako',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  city text,
  allow_negative_stock boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  role public.app_role not null default 'seller',
  created_at timestamptz not null default now(),
  unique(user_id, organization_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sku text not null,
  name text not null,
  category text,
  unit text not null,
  purchase_price bigint not null check (purchase_price >= 0),
  sale_price bigint not null check (sale_price >= 0),
  min_stock numeric(10,3) not null default 0 check (min_stock >= 0),
  active boolean not null default true,
  idempotency_key text,
  created_at timestamptz not null default now(),
  unique (organization_id, sku)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  phone text,
  city text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.stores(id),
  customer_id uuid references public.customers(id),
  total_amount bigint not null check (total_amount >= 0),
  paid_amount bigint not null default 0 check (paid_amount >= 0),
  status text not null default 'completed' check (status in ('pending', 'completed', 'cancelled')),
  idempotency_key text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(10,3) not null check (quantity > 0),
  unit_price bigint not null check (unit_price >= 0)
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.stores(id),
  product_id uuid not null references public.products(id),
  movement_type public.movement_type not null,
  quantity numeric(10,3) not null,
  reference_type text not null check (reference_type in ('sale', 'purchase', 'adjustment', 'correction')),
  reference_id uuid not null,
  created_by uuid not null references public.profiles(id),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table public.receivables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  sale_id uuid references public.sales(id),
  amount bigint not null check (amount > 0),
  amount_paid bigint not null default 0 check (amount_paid >= 0 and amount_paid <= amount),
  due_date date,
  status text not null default 'open' check (status in ('open', 'late', 'paid', 'cancelled')),
  created_by uuid not null references public.profiles(id),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id),
  supplier_id uuid references public.suppliers(id),
  receivable_id uuid references public.receivables(id),
  amount bigint not null check (amount > 0),
  method public.payment_method not null,
  direction text not null check (direction in ('in', 'out')),
  created_by uuid not null references public.profiles(id),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.stores(id),
  amount bigint not null check (amount > 0),
  reason text not null,
  created_by uuid not null references public.profiles(id),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table public.voice_commands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  transcription text not null,
  language text not null default 'fr',
  intent jsonb,
  confidence numeric,
  status text not null default 'pending' check (status in ('pending', 'applied', 'failed')),
  error_message text,
  reference_id uuid,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,
  created_at timestamptz not null default now()
);

-- View for Current Stock
create view public.current_stock with (security_invoker = true) as
select organization_id, store_id, product_id, sum(quantity) as quantity
from public.inventory_movements
group by organization_id, store_id, product_id;

-- Prevent Negative Stock Check Trigger
create or replace function public.check_negative_stock() returns trigger as $$
declare
  current_qty numeric(10,3);
  allow_neg boolean;
begin
  select coalesce(quantity, 0) into current_qty 
  from public.current_stock 
  where product_id = NEW.product_id and store_id = NEW.store_id;
  
  select allow_negative_stock into allow_neg from public.stores where id = NEW.store_id;
  if not allow_neg and (current_qty + NEW.quantity) < 0 then
    raise exception 'Stock insuffisant pour cette opération.';
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger tr_check_negative_stock before insert on public.inventory_movements for each row execute function public.check_negative_stock();

-- Append Only on critical tables (prevent UPDATE/DELETE on sales, inventory_movements)
create or replace function public.prevent_update_delete() returns trigger as $$
begin
  raise exception 'Modification ou suppression non autorisée. Veuillez créer une annulation traçable.';
end;
$$ language plpgsql;

create trigger tr_prevent_update_sales before update or delete on public.sales for each row execute function public.prevent_update_delete();
create trigger tr_prevent_update_movements before update or delete on public.inventory_movements for each row execute function public.prevent_update_delete();

-- Centralized RLS Helper Function
create or replace function public.current_orgs() returns setof uuid language sql stable security definer as $$
  select organization_id from public.memberships where user_id = auth.uid();
$$;

-- RLS setup
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.sales enable row level security;
alter table public.inventory_movements enable row level security;

-- Strict Isolation Policies (Must belong to organization to read/write)
create policy "Org isolation select" on public.products for select using (organization_id in (select public.current_orgs()));
create policy "Org isolation insert" on public.products for insert with check (organization_id in (select public.current_orgs()));
create policy "Org isolation update" on public.products for update using (organization_id in (select public.current_orgs()));
create policy "Org isolation select sales" on public.sales for select using (organization_id in (select public.current_orgs()));
create policy "Org isolation insert sales" on public.sales for insert with check (organization_id in (select public.current_orgs()));
create policy "Org isolation select movs" on public.inventory_movements for select using (organization_id in (select public.current_orgs()));
create policy "Org isolation insert movs" on public.inventory_movements for insert with check (organization_id in (select public.current_orgs()));
