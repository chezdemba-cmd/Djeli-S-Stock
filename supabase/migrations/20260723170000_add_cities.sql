-- 20260723170000_add_cities.sql
-- Ajout de la colonne 'city' (ville) pour les clients et fournisseurs
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS city text;
