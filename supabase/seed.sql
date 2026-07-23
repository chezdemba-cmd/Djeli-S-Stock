-- Seed Data for DJELI'S Stock Assistant
-- Realist West African Wholesale Demo Data (No personal data)

-- 1. Create Organization
insert into public.organizations (id, name, currency, timezone)
values ('org-0000-0000-0000-000000000001', 'Dépôt Central Bamako', 'XOF', 'Africa/Bamako')
on conflict (id) do nothing;

-- 2. Create Store
insert into public.stores (id, organization_id, name, city, allow_negative_stock)
values ('store-0000-0000-0000-000000000001', 'org-0000-0000-0000-000000000001', 'Boutique Principale', 'Bamako', false)
on conflict (id) do nothing;

-- 3. Create Demo Users (Profiles handled by Supabase Auth usually, we mock them here)
insert into auth.users (id, email)
values ('user-0000-0000-0000-000000000001', 'owner@djelis.demo')
on conflict (id) do nothing;

insert into public.profiles (id, full_name)
values ('user-0000-0000-0000-000000000001', 'Propriétaire Démo')
on conflict (id) do nothing;

insert into public.memberships (user_id, organization_id, store_id, role)
values ('user-0000-0000-0000-000000000001', 'org-0000-0000-0000-000000000001', 'store-0000-0000-0000-000000000001', 'owner')
on conflict (user_id, organization_id) do nothing;

-- 4. Create Customers & Suppliers
insert into public.customers (id, organization_id, name, city)
values 
  ('cust-0000-0000-0000-000000000001', 'org-0000-0000-0000-000000000001', 'Boutique Diallo Frères', 'Bamako'),
  ('cust-0000-0000-0000-000000000002', 'org-0000-0000-0000-000000000001', 'Supermarché Sissoko', 'Ségou')
on conflict (id) do nothing;

insert into public.suppliers (id, organization_id, name)
values ('supp-0000-0000-0000-000000000001', 'org-0000-0000-0000-000000000001', 'Grossiste Cissé')
on conflict (id) do nothing;

-- 5. Create Products (Various units)
insert into public.products (id, organization_id, sku, name, category, unit, purchase_price, sale_price, min_stock, idempotency_key)
values
  ('prod-0000-0000-0000-000000000001', 'org-0000-0000-0000-000000000001', 'RIZ-25', 'Riz Parfumé', 'Céréales', 'Sac', 18000, 20000, 50, 'seed_prod_1'),
  ('prod-0000-0000-0000-000000000002', 'org-0000-0000-0000-000000000001', 'HUI-20', 'Huile Végétale', 'Huiles', 'Bidon', 15000, 16500, 20, 'seed_prod_2'),
  ('prod-0000-0000-0000-000000000003', 'org-0000-0000-0000-000000000001', 'LAI-CART', 'Lait en poudre Nido', 'Laitier', 'Carton', 25000, 27500, 10, 'seed_prod_3'),
  ('prod-0000-0000-0000-000000000004', 'org-0000-0000-0000-000000000001', 'SUC-50', 'Sucre Cristallisé', 'Épicerie', 'Kg', 500, 600, 100, 'seed_prod_4'),
  ('prod-0000-0000-0000-000000000005', 'org-0000-0000-0000-000000000001', 'JUS-1L', 'Jus de Mangue', 'Boissons', 'Litre', 800, 1000, 50, 'seed_prod_5')
on conflict (organization_id, sku) do nothing;

-- 6. Initial Inventory (Purchases)
insert into public.inventory_movements (organization_id, store_id, product_id, movement_type, quantity, reference_type, reference_id, created_by, idempotency_key)
values
  ('org-0000-0000-0000-000000000001', 'store-0000-0000-0000-000000000001', 'prod-0000-0000-0000-000000000001', 'purchase', 200, 'adjustment', 'store-0000-0000-0000-000000000001', 'user-0000-0000-0000-000000000001', 'seed_mov_1'),
  ('org-0000-0000-0000-000000000001', 'store-0000-0000-0000-000000000001', 'prod-0000-0000-0000-000000000002', 'purchase', 100, 'adjustment', 'store-0000-0000-0000-000000000001', 'user-0000-0000-0000-000000000001', 'seed_mov_2'),
  ('org-0000-0000-0000-000000000001', 'store-0000-0000-0000-000000000001', 'prod-0000-0000-0000-000000000003', 'purchase', 50, 'adjustment', 'store-0000-0000-0000-000000000001', 'user-0000-0000-0000-000000000001', 'seed_mov_3'),
  ('org-0000-0000-0000-000000000001', 'store-0000-0000-0000-000000000001', 'prod-0000-0000-0000-000000000004', 'purchase', 500, 'adjustment', 'store-0000-0000-0000-000000000001', 'user-0000-0000-0000-000000000001', 'seed_mov_4'),
  ('org-0000-0000-0000-000000000001', 'store-0000-0000-0000-000000000001', 'prod-0000-0000-0000-000000000005', 'purchase', 200, 'adjustment', 'store-0000-0000-0000-000000000001', 'user-0000-0000-0000-000000000001', 'seed_mov_5')
on conflict (organization_id, idempotency_key) do nothing;
