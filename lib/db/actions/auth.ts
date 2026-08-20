"use server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "../../../types/database.types";

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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY manquante : impossible d'initialiser le client admin. " +
      "Configurez cette variable d'environnement (jamais la clé anon) avant d'utiliser les actions serveur."
    );
  }
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function getOrCreateUserOrg(userId: string, email?: string, passedOrgId?: string): Promise<{ orgId: string; storeId: string }> {
  const admin = await getAdmin();

  // 1. Si un passedOrgId est fourni, l'utilisateur DOIT en être membre.
  //    On ne fait jamais confiance à un organization_id venant du client sans
  //    vérifier son appartenance : sinon n'importe quel utilisateur connecté
  //    pourrait écrire dans les données d'une autre entreprise.
  if (passedOrgId && passedOrgId.trim() !== '' && passedOrgId !== 'mock-org-id' && passedOrgId !== 'null') {
    const { data: membership } = await admin
      .from('memberships')
      .select('organization_id, store_id')
      .eq('user_id', userId)
      .eq('organization_id', passedOrgId)
      .maybeSingle();

    if (!membership) {
      throw new Error("Accès refusé : vous n'êtes pas membre de cette organisation.");
    }

    let storeId = membership.store_id;
    if (!storeId) {
      const { data: store } = await admin.from('stores').select('id').eq('organization_id', membership.organization_id).limit(1).maybeSingle();
      storeId = store?.id || '';
    }
    return { orgId: membership.organization_id, storeId: storeId || '' };
  }

  // 2. Sinon, résoudre l'organisation via les memberships réels de l'utilisateur
  const { data: mem } = await admin.from('memberships').select('organization_id, store_id').eq('user_id', userId).limit(1).maybeSingle();
  if (mem && mem.organization_id) {
    let storeId = mem.store_id;
    if (!storeId) {
      const { data: store } = await admin.from('stores').select('id').eq('organization_id', mem.organization_id).limit(1).maybeSingle();
      storeId = store?.id || '';
    }
    return { orgId: mem.organization_id, storeId: storeId || '' };
  }

  // 3. Aucune organisation existante pour cet utilisateur : on lui en crée une nouvelle.
  //    (on ne le rattache JAMAIS à une organisation préexistante appartenant à quelqu'un d'autre)
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
