-- 20260723200000_commercial_grade_setup.sql
-- Fichier de conformité et d'automatisation globale pour Djeli's Stock (Commercial-Grade)

-- 1. Trigger d'inscription automatique pour TOUT NOUVEAU COMMERÇANT
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_org_id uuid;
  new_store_id uuid;
  user_name text;
BEGIN
  user_name := COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));

  -- Créer le profil
  INSERT INTO public.profiles (id, full_name, is_super_admin)
  VALUES (new.id, user_name, false)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  -- Créer l'organisation par défaut
  INSERT INTO public.organizations (name)
  VALUES (user_name || ' Boutique')
  RETURNING id INTO new_org_id;

  -- Créer le dépôt principal par défaut
  INSERT INTO public.stores (organization_id, name, city, active)
  VALUES (new_org_id, 'Dépôt Principal', 'Bamako', true)
  RETURNING id INTO new_store_id;

  -- Attribuer le rôle d'owner
  INSERT INTO public.memberships (user_id, organization_id, store_id, role)
  VALUES (new.id, new_org_id, new_store_id, 'owner')
  ON CONFLICT (user_id, organization_id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Réparer TOUS les comptes existants qui n'ont pas encore d'organisation
DO $$
DECLARE
  rec RECORD;
  new_org_id uuid;
  new_store_id uuid;
  u_name text;
BEGIN
  FOR rec IN 
    SELECT u.id, u.email 
    FROM auth.users u
    LEFT JOIN public.memberships m ON u.id = m.user_id
    WHERE m.id IS NULL
  LOOP
    u_name := split_part(rec.email, '@', 1);

    -- S'assurer que le profil existe
    INSERT INTO public.profiles (id, full_name, is_super_admin)
    VALUES (rec.id, u_name, false)
    ON CONFLICT (id) DO NOTHING;

    -- Créer organisation
    INSERT INTO public.organizations (name)
    VALUES (u_name || ' Boutique')
    RETURNING id INTO new_org_id;

    -- Créer dépôt
    INSERT INTO public.stores (organization_id, name, city, active)
    VALUES (new_org_id, 'Dépôt Principal', 'Bamako', true)
    RETURNING id INTO new_store_id;

    -- Créer membership
    INSERT INTO public.memberships (user_id, organization_id, store_id, role)
    VALUES (rec.id, new_org_id, new_store_id, 'owner')
    ON CONFLICT (user_id, organization_id) DO NOTHING;
  END LOOP;
END;
$$;

-- 3. Fonction RPC de secours instantanée (bootstrap_user_organization)
CREATE OR REPLACE FUNCTION public.bootstrap_user_organization(p_name text DEFAULT 'Ma Boutique Principale')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_store_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Utilisateur non authentifié');
  END IF;

  -- Si l'utilisateur a déjà une organisation, la retourner directement
  SELECT organization_id INTO v_org_id 
  FROM public.memberships 
  WHERE user_id = v_user_id LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    SELECT store_id INTO v_store_id FROM public.memberships WHERE user_id = v_user_id AND organization_id = v_org_id LIMIT 1;
    RETURN json_build_object('success', true, 'org_id', v_org_id, 'store_id', v_store_id, 'existing', true);
  END IF;

  -- Sinon, créer l'organisation et le dépôt
  INSERT INTO public.organizations (name)
  VALUES (COALESCE(NULLIF(p_name, ''), 'Ma Boutique Principale'))
  RETURNING id INTO v_org_id;

  INSERT INTO public.stores (organization_id, name, active)
  VALUES (v_org_id, 'Dépôt Principal', true)
  RETURNING id INTO v_store_id;

  INSERT INTO public.memberships (user_id, organization_id, store_id, role)
  VALUES (v_user_id, v_org_id, v_store_id, 'owner')
  ON CONFLICT (user_id, organization_id) DO NOTHING;

  RETURN json_build_object('success', true, 'org_id', v_org_id, 'store_id', v_store_id, 'org_name', p_name);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.bootstrap_user_organization(text) TO authenticated, anon;

-- 4. Débloquer la création d'organisation pour les utilisateurs authentifiés
DROP POLICY IF EXISTS "Super admin insert orgs" ON public.organizations;
DROP POLICY IF EXISTS "Authenticated users insert orgs" ON public.organizations;
CREATE POLICY "Authenticated users insert orgs" ON public.organizations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Insert memberships" ON public.memberships;
DROP POLICY IF EXISTS "Authenticated users insert memberships" ON public.memberships;
CREATE POLICY "Authenticated users insert memberships" ON public.memberships FOR INSERT WITH CHECK (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true));
