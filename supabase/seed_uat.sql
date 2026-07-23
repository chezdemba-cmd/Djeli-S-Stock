-- Seed Data for DJELI'S Stock Assistant (FIELD UAT - PHASE B)
-- Generates 3 isolated stores with 3 users for the field test.

-- ==============================================================================
-- 1. Create Organizations (Isolées par Row Level Security)
-- ==============================================================================
insert into public.organizations (id, name, currency, timezone)
values 
  ('org-uat-0000-0000-0000-000000000001', 'Boutique Alpha', 'XOF', 'Africa/Bamako'),
  ('org-uat-0000-0000-0000-000000000002', 'Supermarché Beta', 'XOF', 'Africa/Bamako'),
  ('org-uat-0000-0000-0000-000000000003', 'Grossiste Gamma', 'XOF', 'Africa/Bamako')
on conflict (id) do nothing;

-- ==============================================================================
-- 2. Create Stores
-- ==============================================================================
insert into public.stores (id, organization_id, name, city, allow_negative_stock)
values 
  ('store-uat-0000-0000-0000-00000000001', 'org-uat-0000-0000-0000-000000000001', 'Boutique Alpha Principale', 'Bamako', false),
  ('store-uat-0000-0000-0000-00000000002', 'org-uat-0000-0000-0000-000000000002', 'Supermarché Beta Centre', 'Ségou', false),
  ('store-uat-0000-0000-0000-00000000003', 'org-uat-0000-0000-0000-000000000003', 'Dépôt Gamma', 'Sikasso', true)
on conflict (id) do nothing;

-- ==============================================================================
-- 3. Mock Authentication / Profiles (Normally created by Supabase Auth triggers)
-- Note: You MUST manually create test1@djelis.app, test2@djelis.app, test3@djelis.app 
-- in the Supabase Authentication dashboard to get actual UUIDs. 
-- For the sake of this script, we assume their UUIDs are known or we use dummy UUIDs.
-- ==============================================================================
-- We use deterministic UUIDs here. When you create the users in Auth, you can update these IDs,
-- OR you can just use these UUIDs directly if you insert into auth.users (if allowed in your setup).

-- /!\ Warning: auth.users inserts usually require SUPERUSER privileges. 
-- If this fails, run it from the Supabase SQL editor directly.

insert into auth.users (id, email)
values 
  ('user-uat-0000-0000-0000-000000000001', 'test1@djelis.app'),
  ('user-uat-0000-0000-0000-000000000002', 'test2@djelis.app'),
  ('user-uat-0000-0000-0000-000000000003', 'test3@djelis.app')
on conflict (id) do nothing;

insert into public.profiles (id, full_name)
values 
  ('user-uat-0000-0000-0000-000000000001', 'Commerçant Alpha'),
  ('user-uat-0000-0000-0000-000000000002', 'Commerçant Beta'),
  ('user-uat-0000-0000-0000-000000000003', 'Commerçant Gamma')
on conflict (id) do nothing;

-- Link users to their organizations
insert into public.memberships (user_id, organization_id, store_id, role)
values 
  ('user-uat-0000-0000-0000-000000000001', 'org-uat-0000-0000-0000-000000000001', 'store-uat-0000-0000-0000-00000000001', 'owner'),
  ('user-uat-0000-0000-0000-000000000002', 'org-uat-0000-0000-0000-000000000002', 'store-uat-0000-0000-0000-00000000002', 'owner'),
  ('user-uat-0000-0000-0000-000000000003', 'org-uat-0000-0000-0000-000000000003', 'store-uat-0000-0000-0000-00000000003', 'owner')
on conflict (user_id, organization_id) do nothing;

-- ==============================================================================
-- 4. Inject Common Products for all 3 organizations
-- ==============================================================================
-- Organization 1
insert into public.products (id, organization_id, sku, name, category, unit, purchase_price, sale_price, min_stock, idempotency_key)
values
  ('prod-uat-1-1', 'org-uat-0000-0000-0000-000000000001', 'RIZ-25', 'Riz Parfumé', 'Céréales', 'Sac', 18000, 20000, 50, 'uat1_prod1'),
  ('prod-uat-1-2', 'org-uat-0000-0000-0000-000000000001', 'HUI-20', 'Huile Végétale', 'Huiles', 'Bidon', 15000, 16500, 20, 'uat1_prod2')
on conflict do nothing;

-- Organization 2
insert into public.products (id, organization_id, sku, name, category, unit, purchase_price, sale_price, min_stock, idempotency_key)
values
  ('prod-uat-2-1', 'org-uat-0000-0000-0000-000000000002', 'RIZ-25', 'Riz Parfumé', 'Céréales', 'Sac', 18000, 20000, 50, 'uat2_prod1'),
  ('prod-uat-2-2', 'org-uat-0000-0000-0000-000000000002', 'HUI-20', 'Huile Végétale', 'Huiles', 'Bidon', 15000, 16500, 20, 'uat2_prod2')
on conflict do nothing;

-- Organization 3
insert into public.products (id, organization_id, sku, name, category, unit, purchase_price, sale_price, min_stock, idempotency_key)
values
  ('prod-uat-3-1', 'org-uat-0000-0000-0000-000000000003', 'RIZ-25', 'Riz Parfumé', 'Céréales', 'Sac', 18000, 20000, 50, 'uat3_prod1'),
  ('prod-uat-3-2', 'org-uat-0000-0000-0000-000000000003', 'HUI-20', 'Huile Végétale', 'Huiles', 'Bidon', 15000, 16500, 20, 'uat3_prod2')
on conflict do nothing;

-- ==============================================================================
-- 5. Inject Initial Inventory (100 units for everyone)
-- ==============================================================================
insert into public.inventory_movements (organization_id, store_id, product_id, movement_type, quantity, reference_type, reference_id, created_by, idempotency_key)
values
  -- Org 1
  ('org-uat-0000-0000-0000-000000000001', 'store-uat-0000-0000-0000-00000000001', 'prod-uat-1-1', 'purchase', 100, 'adjustment', 'store-uat-0000-0000-0000-00000000001', 'user-uat-0000-0000-0000-000000000001', 'uat1_mov1'),
  ('org-uat-0000-0000-0000-000000000001', 'store-uat-0000-0000-0000-00000000001', 'prod-uat-1-2', 'purchase', 100, 'adjustment', 'store-uat-0000-0000-0000-00000000001', 'user-uat-0000-0000-0000-000000000001', 'uat1_mov2'),
  -- Org 2
  ('org-uat-0000-0000-0000-000000000002', 'store-uat-0000-0000-0000-00000000002', 'prod-uat-2-1', 'purchase', 100, 'adjustment', 'store-uat-0000-0000-0000-00000000002', 'user-uat-0000-0000-0000-000000000002', 'uat2_mov1'),
  ('org-uat-0000-0000-0000-000000000002', 'store-uat-0000-0000-0000-00000000002', 'prod-uat-2-2', 'purchase', 100, 'adjustment', 'store-uat-0000-0000-0000-00000000002', 'user-uat-0000-0000-0000-000000000002', 'uat2_mov2'),
  -- Org 3
  ('org-uat-0000-0000-0000-000000000003', 'store-uat-0000-0000-0000-00000000003', 'prod-uat-3-1', 'purchase', 100, 'adjustment', 'store-uat-0000-0000-0000-00000000003', 'user-uat-0000-0000-0000-000000000003', 'uat3_mov1'),
  ('org-uat-0000-0000-0000-000000000003', 'store-uat-0000-0000-0000-00000000003', 'prod-uat-3-2', 'purchase', 100, 'adjustment', 'store-uat-0000-0000-0000-00000000003', 'user-uat-0000-0000-0000-000000000003', 'uat3_mov2')
on conflict do nothing;

-- Fin du provisionnement.
