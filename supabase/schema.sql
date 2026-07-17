-- DJELI'S STOCK — fondations multi-entreprises et mouvements de stock immuables
create extension if not exists "pgcrypto";

create type public.user_role as enum ('owner', 'manager', 'sales', 'accountant');
create type public.movement_type as enum ('purchase', 'sale', 'transfer_in', 'transfer_out', 'loss', 'adjustment');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'XOF',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'sales',
  created_at timestamptz not null default now()
);

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  city text,
  active boolean not null default true,
  created_at timestamptz not null default now()
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
  min_stock numeric not null default 0 check (min_stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, sku)
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id),
  product_id uuid not null references public.products(id),
  movement_type public.movement_type not null,
  quantity numeric not null check (quantity > 0),
  unit_cost bigint check (unit_cost >= 0),
  reason text not null,
  reference_id uuid,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index stock_movements_lookup on public.stock_movements (organization_id, warehouse_id, product_id, created_at desc);

create view public.current_stock with (security_invoker = true) as
select organization_id, warehouse_id, product_id,
  sum(case when movement_type in ('purchase', 'transfer_in', 'adjustment') then quantity else -quantity end) as quantity
from public.stock_movements
group by organization_id, warehouse_id, product_id;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.warehouses enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;

create or replace function public.current_organization_id() returns uuid
language sql stable security definer set search_path = public
as $$ select organization_id from public.profiles where id = auth.uid() $$;

create policy "members read organization" on public.organizations for select
using (id = public.current_organization_id());
create policy "members read profiles" on public.profiles for select
using (organization_id = public.current_organization_id());
create policy "members read warehouses" on public.warehouses for select
using (organization_id = public.current_organization_id());
create policy "members read products" on public.products for select
using (organization_id = public.current_organization_id());
create policy "members read movements" on public.stock_movements for select
using (organization_id = public.current_organization_id());

create policy "owner manager write products" on public.products for all
using (organization_id = public.current_organization_id() and exists (
  select 1 from public.profiles where id = auth.uid() and role in ('owner', 'manager')
))
with check (organization_id = public.current_organization_id());

create policy "staff create movements" on public.stock_movements for insert
with check (organization_id = public.current_organization_id() and created_by = auth.uid());

-- Aucun UPDATE ou DELETE n'est autorisé sur stock_movements :
-- une correction doit créer un nouveau mouvement traçable.
