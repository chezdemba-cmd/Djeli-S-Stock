-- Migration: RBAC and Security Hardening

-- Helper function to get current user role for an org
create or replace function public.get_user_role(p_org_id uuid) 
returns public.app_role 
language sql stable security definer as $$
  select role from public.memberships 
  where user_id = auth.uid() and organization_id = p_org_id 
  limit 1;
$$;

-- Helper function to check if user has access to a specific store
create or replace function public.check_store_access(p_store_id uuid, p_org_id uuid)
returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from public.memberships 
    where user_id = auth.uid() 
      and organization_id = p_org_id
      and (role in ('owner', 'manager') or store_id = p_store_id)
  );
$$;

-- Secure existing tables with RBAC

-- PRODUCTS: Only owner and manager can insert/update/delete. Sellers can only select.
drop policy if exists "Org isolation insert" on public.products;
drop policy if exists "Org isolation update" on public.products;

create policy "Org isolation insert" on public.products for insert 
with check (organization_id in (select public.current_orgs()) and public.get_user_role(organization_id) in ('owner', 'manager'));

create policy "Org isolation update" on public.products for update 
using (organization_id in (select public.current_orgs()) and public.get_user_role(organization_id) in ('owner', 'manager'));

create policy "Org isolation delete" on public.products for delete 
using (organization_id in (select public.current_orgs()) and public.get_user_role(organization_id) in ('owner', 'manager'));

-- Update RPC create_sale to check store access
create or replace function public.create_sale(payload jsonb)
returns jsonb
language plpgsql security definer
as $$
declare
  v_org_id uuid;
  v_store_id uuid;
  v_user_id uuid;
  v_customer_id uuid;
  v_sale_id uuid;
  v_idempotency_key text;
  v_total_amount bigint;
  v_paid_amount bigint;
  v_method public.payment_method;
  v_item jsonb;
  v_product_id uuid;
  v_qty numeric(10,3);
  v_price bigint;
  v_receivable_id uuid;
  v_has_access boolean;
begin
  v_org_id := (payload->>'organization_id')::uuid;
  v_store_id := (payload->>'store_id')::uuid;
  v_user_id := (payload->>'user_id')::uuid;
  v_customer_id := nullif(payload->>'customer_id', '')::uuid;
  v_idempotency_key := payload->>'idempotency_key';
  v_total_amount := (payload->>'total_amount')::bigint;
  v_paid_amount := coalesce((payload->>'paid_amount')::bigint, 0);
  v_method := (payload->>'payment_method')::public.payment_method;

  -- 1. SECURITE : Vérifier que l'utilisateur est autorisé sur cette boutique
  select public.check_store_access(v_store_id, v_org_id) into v_has_access;
  if not v_has_access then
    raise exception 'Accès refusé : Vous n''êtes pas assigné à ce dépôt.';
  end if;

  if v_paid_amount < v_total_amount and v_customer_id is null then
    raise exception 'Un client est obligatoire pour une vente à crédit (paiement partiel).';
  end if;

  insert into public.sales (organization_id, store_id, customer_id, total_amount, paid_amount, status, idempotency_key, created_by)
  values (v_org_id, v_store_id, v_customer_id, v_total_amount, v_paid_amount, 
          case when v_paid_amount >= v_total_amount then 'completed' else 'pending' end, 
          v_idempotency_key, v_user_id)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(payload->'items')
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::numeric(10,3);
    v_price := (v_item->>'unit_price')::bigint;

    insert into public.sale_items (sale_id, product_id, quantity, unit_price)
    values (v_sale_id, v_product_id, v_qty, v_price);

    insert into public.inventory_movements (organization_id, store_id, product_id, movement_type, quantity, reference_type, reference_id, created_by, idempotency_key)
    values (v_org_id, v_store_id, v_product_id, 'sale', -v_qty, 'sale', v_sale_id, v_user_id, v_idempotency_key || '_mov_' || v_product_id);
  end loop;

  if v_paid_amount > 0 then
    insert into public.payments (organization_id, customer_id, amount, method, direction, created_by, idempotency_key)
    values (v_org_id, v_customer_id, v_paid_amount, v_method, 'in', v_user_id, v_idempotency_key || '_pay');
  end if;

  if v_paid_amount < v_total_amount then
    insert into public.receivables (organization_id, customer_id, sale_id, amount, amount_paid, due_date, status, created_by, idempotency_key)
    values (v_org_id, v_customer_id, v_sale_id, v_total_amount - v_paid_amount, 0, (payload->>'due_date')::date, 'open', v_user_id, v_idempotency_key || '_debt')
    returning id into v_receivable_id;
  end if;

  return jsonb_build_object('success', true, 'sale_id', v_sale_id);
exception when unique_violation then
  return jsonb_build_object('success', true, 'message', 'Idempotency caught');
end;
$$;
