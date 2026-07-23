-- Fichier de tests pgTAP pour vérifier l'isolation RLS.

begin;
create extension if not exists pgtap;
select plan(3);

-- Test de préparation
-- Création de deux utilisateurs et de deux organisations distinctes (Organisation A et Organisation B).

insert into auth.users (id) values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
insert into public.profiles (id, full_name) values ('00000000-0000-0000-0000-000000000001', 'User A'), ('00000000-0000-0000-0000-000000000002', 'User B');

insert into public.organizations (id, name) values ('aaaaaaaa-0000-0000-0000-000000000000', 'Org A'), ('bbbbbbbb-0000-0000-0000-000000000000', 'Org B');

insert into public.memberships (user_id, organization_id) values ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000'), ('00000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000000');

insert into public.products (id, organization_id, sku, name, unit, purchase_price, sale_price) values 
('11111111-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'SKU-A', 'Produit Org A', 'Unité', 10, 20),
('22222222-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000', 'SKU-B', 'Produit Org B', 'Unité', 10, 20);

-- Test 1 : L'utilisateur A ne doit voir que le Produit A
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select results_eq(
    'select sku from public.products',
    $$values ('SKU-A')$$,
    'User A ne voit que les produits de Org A'
);

-- Test 2 : L'utilisateur B ne doit voir que le Produit B
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select results_eq(
    'select sku from public.products',
    $$values ('SKU-B')$$,
    'User B ne voit que les produits de Org B'
);

-- Test 3 : L'utilisateur A ne peut pas insérer un produit dans Org B
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select throws_ok(
    $$insert into public.products (organization_id, sku, name, unit, purchase_price, sale_price) values ('bbbbbbbb-0000-0000-0000-000000000000', 'SKU-FAIL', 'Fail', 'Unit', 1, 1)$$,
    'new row violates row-level security policy for table "products"',
    'User A ne peut pas écrire dans Org B'
);

select * from finish();
rollback;
