-- Migration 20260723140000_super_admin.sql

-- 1. Add is_super_admin to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

-- 2. Update current_orgs() to return all orgs if super admin
CREATE OR REPLACE FUNCTION public.current_orgs()
RETURNS setof uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  -- Si l'utilisateur est super admin, il a accès à toutes les organisations
  SELECT id FROM public.organizations 
  WHERE EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
  UNION
  -- Sinon, seulement les organisations où il est membre
  SELECT organization_id FROM public.memberships WHERE user_id = auth.uid();
$$;

-- 3. Helper RPC to get all accessible organizations with their details (for the UI Switcher)
CREATE OR REPLACE FUNCTION public.get_accessible_orgs()
RETURNS TABLE (id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id, name FROM public.organizations 
  WHERE id IN (SELECT public.current_orgs());
$$;

-- 4. Automatically make chezdemba@gmail.com a super admin
UPDATE public.profiles 
SET is_super_admin = true 
WHERE id IN (SELECT id FROM auth.users WHERE email = 'chezdemba@gmail.com');
