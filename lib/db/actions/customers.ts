"use server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "../../../types/database.types";
import { z } from "zod";

import { getAdmin, getOrCreateUserOrg, createClient } from "./auth";

const CreateCustomerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  city: z.string().optional(),
});

export async function createCustomer(data: {
  name: string;
  phone?: string;
  city?: string;
  organization_id?: string;
}) {
  try {
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return { error: "Non autorisé (session expirée)" };

    let parsedData;
    try {
      parsedData = CreateCustomerSchema.parse(data);
    } catch (e: any) {
      return { error: "Données invalides : " + e.message };
    }

    const admin = await getAdmin();
    const { orgId } = await getOrCreateUserOrg(user.user.id, user.user.email, data.organization_id);

    const { data: result, error } = await admin.from('customers').insert({
      organization_id: orgId,
      name: parsedData.name,
      phone: parsedData.phone || '',
      city: parsedData.city || '',
      active: true
    }).select().single();

    if (error || !result) return { error: "Erreur création client : " + (error?.message || "Erreur Supabase") };
    return { data: result };
  } catch (e: any) {
    return { error: "Erreur serveur : " + (e?.message || String(e)) };
  }
}
