-- Fichier de tests pgTAP pour vérifier la logique métier RPC.
begin;
create extension if not exists pgtap;
select plan(7);

-- 1. PRÉPARATION
insert into public.organizations (id, name) values ('cccccccc-0000-0000-0000-000000000000', 'Test Org');
insert into public.stores (id, organization_id, name, allow_negative_stock) values ('dddddddd-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-000000000000', 'Boutique 1', false);
insert into auth.users (id) values ('00000000-0000-0000-0000-000000000003');
insert into public.profiles (id, full_name) values ('00000000-0000-0000-0000-000000000003', 'User Test');
insert into public.customers (id, organization_id, name) values ('eeeeeeee-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-000000000000', 'Client Test');

-- Produit A
insert into public.products (id, organization_id, sku, name, unit, purchase_price, sale_price) 
values ('11111111-0000-0000-0000-111111111111', 'cccccccc-0000-0000-0000-000000000000', 'P-1', 'Prod 1', 'U', 10, 20);

-- Mouvement initial (Entrée de stock : 10 unités)
insert into public.inventory_movements (organization_id, store_id, product_id, movement_type, quantity, reference_type, reference_id, created_by, idempotency_key)
values ('cccccccc-0000-0000-0000-000000000000', 'dddddddd-0000-0000-0000-000000000000', '11111111-0000-0000-0000-111111111111', 'purchase', 10, 'purchase', '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'init_stock');

-- 2. TEST : VENTE COMPTANT (Décrémente le stock, ajoute paiement)
select lives_ok(
  $$ select public.create_sale('{"organization_id": "cccccccc-0000-0000-0000-000000000000", "store_id": "dddddddd-0000-0000-0000-000000000000", "user_id": "00000000-0000-0000-0000-000000000003", "total_amount": 40, "paid_amount": 40, "payment_method": "cash", "idempotency_key": "sale_1", "items": [{"product_id": "11111111-0000-0000-0000-111111111111", "quantity": 2, "unit_price": 20}]}'::jsonb) $$,
  'Vente comptant de 2 unités réussie'
);

select results_eq(
  'select quantity from public.current_stock where product_id = ''11111111-0000-0000-0000-111111111111''',
  $$values (8::numeric)$$,
  'Le stock restant doit être 8'
);

-- 3. TEST : STOCK INSUFFISANT
select throws_ok(
  $$ select public.create_sale('{"organization_id": "cccccccc-0000-0000-0000-000000000000", "store_id": "dddddddd-0000-0000-0000-000000000000", "user_id": "00000000-0000-0000-0000-000000000003", "total_amount": 200, "paid_amount": 200, "payment_method": "cash", "idempotency_key": "sale_fail", "items": [{"product_id": "11111111-0000-0000-0000-111111111111", "quantity": 10, "unit_price": 20}]}'::jsonb) $$,
  'Stock insuffisant pour cette opération.',
  'Vente refusée car le stock deviendrait négatif (8 - 10)'
);

-- 4. TEST : VENTE À CRÉDIT (Client manquant)
select throws_ok(
  $$ select public.create_sale('{"organization_id": "cccccccc-0000-0000-0000-000000000000", "store_id": "dddddddd-0000-0000-0000-000000000000", "user_id": "00000000-0000-0000-0000-000000000003", "total_amount": 40, "paid_amount": 20, "payment_method": "cash", "idempotency_key": "sale_credit_fail", "items": [{"product_id": "11111111-0000-0000-0000-111111111111", "quantity": 2, "unit_price": 20}]}'::jsonb) $$,
  'Un client est obligatoire pour une vente à crédit (paiement partiel).',
  'Vente à crédit refusée sans client'
);

-- 5. TEST : VENTE À CRÉDIT (Mixte) AVEC CLIENT
select lives_ok(
  $$ select public.create_sale('{"organization_id": "cccccccc-0000-0000-0000-000000000000", "store_id": "dddddddd-0000-0000-0000-000000000000", "customer_id": "eeeeeeee-0000-0000-0000-000000000000", "user_id": "00000000-0000-0000-0000-000000000003", "total_amount": 40, "paid_amount": 10, "payment_method": "mobile_money", "idempotency_key": "sale_credit_ok", "items": [{"product_id": "11111111-0000-0000-0000-111111111111", "quantity": 2, "unit_price": 20}]}'::jsonb) $$,
  'Vente mixte (crédit) réussie avec un client'
);

select results_eq(
  'select amount - amount_paid from public.receivables where idempotency_key = ''sale_credit_ok_debt''',
  $$values (30::bigint)$$,
  'Une créance de 30 FCFA a été créée (40 - 10)'
);

-- 6. TEST : DOUBLE SOUMISSION (Idempotence)
select results_eq(
  $$ select public.create_sale('{"organization_id": "cccccccc-0000-0000-0000-000000000000", "store_id": "dddddddd-0000-0000-0000-000000000000", "user_id": "00000000-0000-0000-0000-000000000003", "total_amount": 40, "paid_amount": 40, "payment_method": "cash", "idempotency_key": "sale_1", "items": [{"product_id": "11111111-0000-0000-0000-111111111111", "quantity": 2, "unit_price": 20}]}'::jsonb)->>'message' $$,
  $$values ('Déjà exécuté (Idempotence)')$$,
  'La deuxième soumission avec la même clé retourne silencieusement le message idempotence'
);

select * from finish();
rollback;
