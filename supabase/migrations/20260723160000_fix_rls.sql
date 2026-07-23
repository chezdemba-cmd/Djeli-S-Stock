-- 20260723160000_fix_rls.sql
-- Correction des politiques RLS manquantes pour permettre les insertions.

-- 0. S'assurer que la colonne is_super_admin existe (au cas où le script précédent a échoué)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

-- S'assurer que vous êtes bien défini comme Super Admin
UPDATE public.profiles 
SET is_super_admin = true 
WHERE id IN (SELECT id FROM auth.users WHERE email = 'chezdemba@gmail.com');

-- 1. Customers (Clients)
CREATE POLICY "Org isolation select customers" ON public.customers FOR SELECT USING (organization_id IN (SELECT public.current_orgs()));
CREATE POLICY "Org isolation insert customers" ON public.customers FOR INSERT WITH CHECK (organization_id IN (SELECT public.current_orgs()));
CREATE POLICY "Org isolation update customers" ON public.customers FOR UPDATE USING (organization_id IN (SELECT public.current_orgs()));

-- 2. Stores (Dépôts)
CREATE POLICY "Org isolation select stores" ON public.stores FOR SELECT USING (organization_id IN (SELECT public.current_orgs()));
-- Les administrateurs peuvent ajouter des dépôts dans leurs organisations, et le Super Admin peut le faire partout.
CREATE POLICY "Org isolation insert stores" ON public.stores FOR INSERT WITH CHECK (
  organization_id IN (SELECT public.current_orgs()) 
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
);

-- 3. Organizations (Entreprises SaaS)
-- Seul le Super Admin peut créer une nouvelle organisation manuellement depuis l'interface SaaS
CREATE POLICY "Super admin insert orgs" ON public.organizations FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
);
-- Lecture des organisations autorisées
CREATE POLICY "Select orgs" ON public.organizations FOR SELECT USING (
  id IN (SELECT public.current_orgs())
);

-- 4. Memberships (Membres)
CREATE POLICY "Select memberships" ON public.memberships FOR SELECT USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
);

-- 5. Suppliers (Fournisseurs)
CREATE POLICY "Org isolation select suppliers" ON public.suppliers FOR SELECT USING (organization_id IN (SELECT public.current_orgs()));
CREATE POLICY "Org isolation insert suppliers" ON public.suppliers FOR INSERT WITH CHECK (organization_id IN (SELECT public.current_orgs()));
CREATE POLICY "Org isolation update suppliers" ON public.suppliers FOR UPDATE USING (organization_id IN (SELECT public.current_orgs()));

