-- 20260723180000_allow_org_creation.sql
-- Autoriser tous les utilisateurs authentifiés à créer une organisation et leur appartenance (membership)

DROP POLICY IF EXISTS "Super admin insert orgs" ON public.organizations;
DROP POLICY IF EXISTS "Authenticated users insert orgs" ON public.organizations;

-- Permettre à tout utilisateur connecté de créer une entreprise/organisation
CREATE POLICY "Authenticated users insert orgs" ON public.organizations 
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Permettre d'insérer son propre membre (membership) comme propriétaire
DROP POLICY IF EXISTS "Insert memberships" ON public.memberships;
DROP POLICY IF EXISTS "Authenticated users insert memberships" ON public.memberships;

CREATE POLICY "Authenticated users insert memberships" ON public.memberships 
FOR INSERT WITH CHECK (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true));
