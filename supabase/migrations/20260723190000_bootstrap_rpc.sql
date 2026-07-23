-- 20260723190000_bootstrap_rpc.sql
-- Fonction RPC ultra-sécurisée pour créer une organisation, son dépôt et son membre en 1 appel atomique

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

  -- 1. Créer l'organisation
  INSERT INTO public.organizations (name)
  VALUES (COALESCE(NULLIF(p_name, ''), 'Ma Boutique Principale'))
  RETURNING id INTO v_org_id;

  -- 2. Créer le dépôt principal
  INSERT INTO public.stores (organization_id, name, active)
  VALUES (v_org_id, 'Dépôt Principal', true)
  RETURNING id INTO v_store_id;

  -- 3. Attribuer le rôle d'owner dans memberships
  INSERT INTO public.memberships (user_id, organization_id, store_id, role)
  VALUES (v_user_id, v_org_id, v_store_id, 'owner')
  ON CONFLICT (user_id, organization_id) DO NOTHING;

  RETURN json_build_object(
    'success', true, 
    'org_id', v_org_id,
    'store_id', v_store_id,
    'org_name', p_name
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.bootstrap_user_organization(text) TO authenticated, anon;
