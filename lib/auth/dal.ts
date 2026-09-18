import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { ProfileRow } from "@/lib/types/database";

/**
 * Data Access Layer de autenticación. `cache()` deduplica la llamada dentro
 * de un mismo render (varios componentes pueden pedir el usuario sin costo
 * extra de red).
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getCurrentProfile = cache(async (): Promise<ProfileRow | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

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
 * Igual que `requireUser()`, pero devuelve el usuario resuelto por el MISMO
 * cliente de Supabase que se debe usar a continuación para la mutación o
 * consulta.
 *
 * Importante: no reutilices `requireUser()` (que crea su propio cliente
 * internamente vía `getCurrentUser`) seguido de un `createClient()` aparte
 * para la query real. Aunque `@supabase/ssr` recarga la sesión desde las
 * cookies en cada request sin importar la instancia, mezclar dos clientes
 * distintos para "quién soy" y "la operación" no aporta nada, duplica una
 * llamada de red a Supabase Auth y dificulta diagnosticar problemas de RLS
 * como "new row violates row-level security policy": si `auth.getUser()`
 * falla en el cliente que realmente ejecuta el INSERT/UPDATE, lo notamos
 * aquí con un mensaje claro en vez de un error crudo de Postgres.
 */
export async function requireUserClient(): Promise<{
  supabase: SupabaseClient;
  user: User;
}> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return { supabase, user };
}
