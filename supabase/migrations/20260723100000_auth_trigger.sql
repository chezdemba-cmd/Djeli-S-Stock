-- 1. Create the function to setup a new user automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_org_id uuid;
  new_store_id uuid;
BEGIN
  -- Create a profile
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));

  -- Create a default organization
  INSERT INTO public.organizations (name)
  VALUES (COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)) || ' Boutique')
  RETURNING id INTO new_org_id;

  -- Create a default store
  INSERT INTO public.stores (organization_id, name, city)
  VALUES (new_org_id, 'Dépôt Principal', 'Bamako')
  RETURNING id INTO new_store_id;

  -- Link user to organization and store
  INSERT INTO public.memberships (user_id, organization_id, store_id, role)
  VALUES (new.id, new_org_id, new_store_id, 'owner');

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Fix existing users (like chezdemba) who don't have a profile yet
DO $$
DECLARE
  rec RECORD;
  new_org_id uuid;
  new_store_id uuid;
BEGIN
  FOR rec IN SELECT * FROM auth.users WHERE id NOT IN (SELECT id FROM public.profiles) LOOP
    -- Create profile
    INSERT INTO public.profiles (id, full_name)
    VALUES (rec.id, split_part(rec.email, '@', 1));

    -- Create organization
    INSERT INTO public.organizations (name)
    VALUES (split_part(rec.email, '@', 1) || ' Boutique')
    RETURNING id INTO new_org_id;

    -- Create store
    INSERT INTO public.stores (organization_id, name, city)
    VALUES (new_org_id, 'Dépôt Principal', 'Bamako')
    RETURNING id INTO new_store_id;

    -- Create membership
    INSERT INTO public.memberships (user_id, organization_id, store_id, role)
    VALUES (rec.id, new_org_id, new_store_id, 'owner');
  END LOOP;
END;
$$;
