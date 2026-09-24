import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileRow } from "@/lib/types/database";

export interface AuthUser {
  id: string;
  email?: string;
  is_anonymous?: boolean;
}

/**
 * Identidad de la petición actual, resuelta UNA sola vez por request
 * (`cache()` deduplica entre layouts, páginas y acciones).
 *
 * Usa `getClaims()`: verifica la firma del JWT localmente con las claves
 * públicas asimétricas del proyecto (JWKS, cacheadas en memoria), sin viaje
 * de red al servidor de Auth en cada navegación. Una firma o payload alterado
 * se rechaza. Es la misma garantía que usa RLS: PostgREST también valida el
 * JWT por firma. Lo único que no detecta es una sesión revocada antes de que
 * expire el JWT (por defecto 1 h), igual que RLS.
 */
const getRequestAuth = cache(
  async (): Promise<{ supabase: SupabaseClient; user: AuthUser | null }> => {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;

    if (error || !claims?.sub) {
      return { supabase, user: null };
    }

    return {
      supabase,
      user: {
        id: claims.sub,
        email: typeof claims.email === "string" && claims.email ? claims.email : undefined,
        is_anonymous: claims.is_anonymous === true,
      },
    };
  }
);

export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const { user } = await getRequestAuth();
  return user;
});

export const getCurrentProfile = cache(async (): Promise<ProfileRow | null> => {
  const { supabase, user } = await getRequestAuth();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  return data;
});

/** Exige sesión activa; si no hay, redirige a /login. Úsalo en páginas/layouts. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireProfile(): Promise<ProfileRow> {
  await requireUser();
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  return profile;
}

/**
 * Devuelve el usuario y el MISMO cliente de Supabase que debe usarse para la
 * consulta o mutación siguiente (así `owner_id`/`created_by` y el `auth.uid()`
 * que evalúa RLS provienen de la misma sesión). Deduplicado por request.
 */
export async function requireUserClient(): Promise<{
  supabase: SupabaseClient;
  user: AuthUser;
}> {
  const { supabase, user } = await getRequestAuth();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}
