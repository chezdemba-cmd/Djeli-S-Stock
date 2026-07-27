"use server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "../../../types/database.types";
import { z } from "zod";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

export async function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function getOrCreateUserOrg(userId: string, email?: string, passedOrgId?: string): Promise<{ orgId: string; storeId: string }> {
  const admin = await getAdmin();

  // 1. Si un passedOrgId valide existe dans la table organizations, l'utiliser
  if (passedOrgId && passedOrgId.trim() !== '' && passedOrgId !== 'mock-org-id' && passedOrgId !== 'null') {
    const { data: checkOrg } = await admin.from('organizations').select('id').eq('id', passedOrgId).maybeSingle();
    if (checkOrg && checkOrg.id) {
      const { data: store } = await admin.from('stores').select('id').eq('organization_id', checkOrg.id).limit(1).maybeSingle();
      return { orgId: checkOrg.id, storeId: store?.id || '' };
    }
  }

  // 2. Vérifier les memberships
  const { data: mem } = await admin.from('memberships').select('organization_id, store_id').eq('user_id', userId).limit(1).maybeSingle();
  if (mem && mem.organization_id) {
    let storeId = mem.store_id;
    if (!storeId) {
      const { data: store } = await admin.from('stores').select('id').eq('organization_id', mem.organization_id).limit(1).maybeSingle();
      storeId = store?.id || '';
    }
    return { orgId: mem.organization_id, storeId: storeId || '' };
  }

  // 3. Vérifier n'importe quelle organisation existante
  const { data: firstOrg } = await admin.from('organizations').select('id').limit(1).maybeSingle();
  if (firstOrg && firstOrg.id) {
    const { data: store } = await admin.from('stores').select('id').eq('organization_id', firstOrg.id).limit(1).maybeSingle();
    const storeId = store?.id || '';
    await admin.from('memberships').upsert({
      user_id: userId,
      organization_id: firstOrg.id,
      store_id: storeId || null,
      role: 'owner'
    }, { onConflict: 'user_id,organization_id' });
    return { orgId: firstOrg.id, storeId };
  }

  // 4. Auto-création complète (Organisation + Boutique Principale + Membership owner)
  const name = email ? `Structure ${email.split('@')[0]}` : "Structure Principale";
  const { data: newOrg, error: orgErr } = await admin.from('organizations').insert({ name }).select().single();
  if (orgErr || !newOrg) {
    throw new Error("Impossible de créer la structure : " + (orgErr?.message || "Erreur Supabase"));
  }

  const { data: newStore } = await admin.from('stores').insert({
    organization_id: newOrg.id,
    name: 'Boutique Principale',
    active: true
  }).select().single();

  await admin.from('memberships').upsert({
    user_id: userId,
    organization_id: newOrg.id,
    store_id: newStore?.id || null,
    role: 'owner'
  }, { onConflict: 'user_id,organization_id' });

  return { orgId: newOrg.id, storeId: newStore?.id || '' };
}
