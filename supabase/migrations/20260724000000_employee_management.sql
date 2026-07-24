-- Migration 20260724000000_employee_management.sql

-- 1. Mettre à jour le trigger pour éviter la création de boutique pour les employés
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_org_id uuid;
  new_store_id uuid;
  user_name text;
  is_employee boolean;
BEGIN
  user_name := COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  is_employee := COALESCE((new.raw_user_meta_data->>'is_employee')::boolean, false);

  -- Créer le profil
  INSERT INTO public.profiles (id, full_name, is_super_admin)
  VALUES (new.id, user_name, false)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  -- Si c'est un employé créé par l'owner, on ne lui crée pas sa propre boutique
  IF is_employee THEN
    RETURN new;
  END IF;

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

-- 2. Créer une vue pour récupérer les employés d'une organisation
CREATE OR REPLACE VIEW public.org_employees WITH (security_invoker = true) AS
SELECT 
    m.id AS membership_id,
    m.organization_id,
    m.user_id,
    p.full_name,
    m.role,
    m.store_id,
    s.name AS store_name,
    m.created_at
FROM public.memberships m
JOIN public.profiles p ON m.user_id = p.id
LEFT JOIN public.stores s ON m.store_id = s.id;
