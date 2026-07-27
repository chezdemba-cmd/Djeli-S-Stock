"use server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "../../../types/database.types";
import { z } from "zod";

import { getAdmin, getOrCreateUserOrg, createClient } from "./auth";

const CreateStoreSchema = z.object({
  name: z.string().min(1),
  city: z.string().optional(),
  allow_negative_stock: z.boolean().default(false),
});

const CreateEmployeeSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1),
  role: z.enum(['seller', 'manager']),
  store_id: z.string().uuid(),
  organization_id: z.string().optional(),
});

export async function createStore(data: {
  name: string;
  city?: string;
  allow_negative_stock?: boolean;
  organization_id?: string;
}) {
  try {
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return { error: "Non autorisé (session expirée)" };

    let parsedData;
    try {
      parsedData = CreateStoreSchema.parse(data);
    } catch (e: any) {
      return { error: "Données invalides : " + e.message };
    }

    const admin = await getAdmin();
    const { orgId } = await getOrCreateUserOrg(user.user.id, user.user.email, data.organization_id);

    const { data: result, error } = await admin.from('stores').insert({
      organization_id: orgId,
      name: parsedData.name,
      city: parsedData.city || '',
      allow_negative_stock: parsedData.allow_negative_stock || false,
      active: true
    }).select().single();

    if (error || !result) return { error: "Erreur création dépôt : " + (error?.message || "Impossible d'enregistrer le dépôt") };

    if (result && result.id) {
      try {
        await admin.from('memberships').update({ store_id: result.id }).eq('user_id', user.user.id).eq('organization_id', orgId);
      } catch {}
    }

    return { data: result };
  } catch (e: any) {
    return { error: "Erreur serveur : " + (e?.message || String(e)) };
  }
}

export async function createClientWorkspace(data: { name: string }) {
  try {
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return { success: false, error: "Non autorisé (session expirée)" };

    const admin = await getAdmin();
    const { data: org, error: orgErr } = await admin.from('organizations').insert({ name: data.name }).select().single();
    if (orgErr || !org) return { success: false, error: "Erreur création entreprise : " + (orgErr?.message || "Erreur Supabase") };

    const { data: store } = await admin.from('stores').insert({
      organization_id: org.id,
      name: 'Dépôt Principal',
      active: true
    }).select().single();

    await admin.from('memberships').insert({
      user_id: user.user.id,
      organization_id: org.id,
      store_id: store ? store.id : null,
      role: 'owner'
    });

    return { success: true, org };
  } catch (e: any) {
    return { success: false, error: "Erreur serveur : " + (e?.message || String(e)) };
  }
}

export async function createPartnerWorkspace(data: { 
  name: string;
  owner_email: string;
  owner_password: string;
  owner_full_name: string;
}) {
  try {
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return { success: false, error: "Non autorisé (session expirée)" };

    const admin = await getAdmin();
    
    // 1. Check if super_admin
    const { data: profile } = await admin.from('profiles').select('is_super_admin').eq('id', user.user.id).single();
    if (!profile?.is_super_admin) return { success: false, error: "Accès refusé. Réservé aux administrateurs SaaS." };

    // 2. Create the Organization
    const { data: org, error: orgErr } = await admin.from('organizations').insert({ name: data.name }).select().single();
    if (orgErr || !org) return { success: false, error: "Erreur création entreprise : " + (orgErr?.message || "Erreur Supabase") };

    // 3. Create the Main Store
    const { data: store } = await admin.from('stores').insert({
      organization_id: org.id,
      name: 'Boutique Principale',
      active: true
    }).select().single();

    // 4. Create the User via Admin Auth API
    const { data: newAuthUser, error: authErr } = await admin.auth.admin.createUser({
      email: data.owner_email,
      password: data.owner_password,
      email_confirm: true,
      user_metadata: {
        full_name: data.owner_full_name,
        is_employee: false
      }
    });

    if (authErr || !newAuthUser.user) {
       // Rollback org creation is hard without RLS bypass or rpc, but let's just return error
       return { success: false, error: "Erreur création compte partenaire : " + (authErr?.message || "L'email est peut-être déjà utilisé.") };
    }

    // 5. Link User to Organization as Owner
    await admin.from('memberships').insert({
      user_id: newAuthUser.user.id,
      organization_id: org.id,
      store_id: store ? store.id : null,
      role: 'owner'
    });

    // 6. Update profile with full name
    try {
      await admin.from('profiles').update({ full_name: data.owner_full_name }).eq('id', newAuthUser.user.id);
    } catch (err) {
      console.error("Erreur mise à jour profil", err);
    }

    return { success: true, org };
  } catch (e: any) {
    return { success: false, error: "Erreur serveur : " + (e?.message || String(e)) };
  }
}

export async function createEmployee(data: {
  email: string;
  password: string;
  full_name: string;
  role: 'seller' | 'manager';
  store_id: string;
  organization_id?: string;
}) {
  try {
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return { error: "Non autorisé (session expirée)" };

    let parsedData;
    try {
      parsedData = CreateEmployeeSchema.parse(data);
    } catch (e: any) {
      return { error: "Données invalides : " + e.message };
    }

    const admin = await getAdmin();
    const { orgId } = await getOrCreateUserOrg(user.user.id, user.user.email, data.organization_id);
    
    // 1. Vérifier si l'utilisateur courant a le droit (owner ou manager)
    const { data: currentUserRole } = await admin.from('memberships').select('role').eq('user_id', user.user.id).eq('organization_id', orgId).single();
    if (!currentUserRole || (currentUserRole.role !== 'owner' && currentUserRole.role !== 'manager')) {
      return { error: "Accès refusé. Seul un gérant ou propriétaire peut ajouter un employé." };
    }

    // 2. Créer l'utilisateur via l'API Admin de Supabase
    const { data: newAuthUser, error: authErr } = await admin.auth.admin.createUser({
      email: parsedData.email,
      password: parsedData.password,
      email_confirm: true,
      user_metadata: {
        full_name: parsedData.full_name,
        is_employee: true,
      }
    });

    if (authErr || !newAuthUser.user) {
       return { error: "Erreur création compte employé : " + (authErr?.message || "Erreur Supabase. L'email est peut-être déjà utilisé.") };
    }

    // 3. Lier l'employé à l'organisation
    const { error: memErr } = await admin.from('memberships').insert({
      user_id: newAuthUser.user.id,
      organization_id: orgId,
      store_id: parsedData.store_id,
      role: parsedData.role
    });

    if (memErr) return { error: "Erreur assignation rôle : " + memErr.message };

    return { data: { success: true } };
  } catch (e: any) {
    return { error: "Erreur serveur : " + (e?.message || String(e)) };
  }
}
