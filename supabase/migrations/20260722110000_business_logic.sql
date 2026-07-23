-- Migration: Logique Métier Atomique (RPC)

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
begin
  v_org_id := (payload->>'organization_id')::uuid;
  v_store_id := (payload->>'store_id')::uuid;
  v_user_id := (payload->>'user_id')::uuid;
  v_customer_id := nullif(payload->>'customer_id', '')::uuid;
  v_idempotency_key := payload->>'idempotency_key';
  v_total_amount := (payload->>'total_amount')::bigint;
  v_paid_amount := coalesce((payload->>'paid_amount')::bigint, 0);
  v_method := (payload->>'payment_method')::public.payment_method;

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

create or replace function public.create_purchase(payload jsonb)
returns jsonb
language plpgsql security definer
as $$
declare
  v_org_id uuid;
  v_store_id uuid;
  v_user_id uuid;
  v_supplier_id uuid;
  v_purchase_id uuid;
  v_idempotency_key text;
  v_total_amount bigint;
  v_paid_amount bigint;
  v_method public.payment_method;
  v_item jsonb;
  v_product_id uuid;
  v_qty numeric(10,3);
  v_price bigint;
begin
  v_org_id := (payload->>'organization_id')::uuid;
  v_store_id := (payload->>'store_id')::uuid;
  v_user_id := (payload->>'user_id')::uuid;
  v_supplier_id := nullif(payload->>'supplier_id', '')::uuid;
  v_idempotency_key := payload->>'idempotency_key';
  v_total_amount := (payload->>'total_amount')::bigint;
  v_paid_amount := coalesce((payload->>'paid_amount')::bigint, 0);
  v_method := coalesce(nullif(payload->>'payment_method', ''), 'cash')::public.payment_method;

  insert into public.purchases (organization_id, store_id, supplier_id, total_amount, paid_amount, status, idempotency_key, created_by)
  values (v_org_id, v_store_id, v_supplier_id, v_total_amount, v_paid_amount, 
          case when v_paid_amount >= v_total_amount then 'completed' else 'pending' end, 
          v_idempotency_key, v_user_id)
  returning id into v_purchase_id;

  for v_item in select * from jsonb_array_elements(payload->'items')
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::numeric(10,3);
    v_price := (v_item->>'unit_price')::bigint;

    insert into public.purchase_items (purchase_id, product_id, quantity, unit_price)
    values (v_purchase_id, v_product_id, v_qty, v_price);

    insert into public.inventory_movements (organization_id, store_id, product_id, movement_type, quantity, reference_type, reference_id, created_by, idempotency_key)
    values (v_org_id, v_store_id, v_product_id, 'purchase', v_qty, 'purchase', v_purchase_id, v_user_id, v_idempotency_key || '_mov_' || v_product_id);
  end loop;

  if v_paid_amount > 0 then
    insert into public.payments (organization_id, supplier_id, amount, method, direction, created_by, idempotency_key)
    values (v_org_id, v_supplier_id, v_paid_amount, v_method, 'out', v_user_id, v_idempotency_key || '_pay');
  end if;

  return jsonb_build_object('success', true, 'purchase_id', v_purchase_id);
exception when unique_violation then
  return jsonb_build_object('success', true, 'message', 'Idempotency caught');
end;
$$;

create or replace function public.pay_receivable(payload jsonb)
returns jsonb
language plpgsql security definer
as $$
declare
  v_org_id uuid;
  v_user_id uuid;
  v_receivable_id uuid;
  v_amount bigint;
  v_method public.payment_method;
  v_idempotency_key text;
  v_current_paid bigint;
  v_total_debt bigint;
  v_customer_id uuid;
begin
  v_org_id := (payload->>'organization_id')::uuid;
  v_user_id := (payload->>'user_id')::uuid;
  v_receivable_id := (payload->>'receivable_id')::uuid;
  v_amount := (payload->>'amount')::bigint;
  v_method := (payload->>'payment_method')::public.payment_method;
  v_idempotency_key := payload->>'idempotency_key';

  select amount, amount_paid, customer_id into v_total_debt, v_current_paid, v_customer_id
  from public.receivables where id = v_receivable_id and organization_id = v_org_id for update;

  if (v_current_paid + v_amount) > v_total_debt then
    raise exception 'Le paiement dépasse le montant de la créance.';
  end if;

  update public.receivables
  set amount_paid = amount_paid + v_amount,
      status = case when (amount_paid + v_amount) >= amount then 'paid' else status end
  where id = v_receivable_id;

  insert into public.payments (organization_id, customer_id, receivable_id, amount, method, direction, created_by, idempotency_key)
  values (v_org_id, v_customer_id, v_receivable_id, v_amount, v_method, 'in', v_user_id, v_idempotency_key);

  return jsonb_build_object('success', true);
exception when unique_violation then
  return jsonb_build_object('success', true, 'message', 'Idempotency caught');
end;
$$;
