"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para uso en Client Components.
 * Usa la clave pública (publishable/anon); nunca la service_role aquí.
 *
 * Nota: no se tipa con el genérico `Database` de supabase-js porque nuestro
 * tipo está escrito a mano (no generado con `supabase gen types`) y su forma
 * no coincide exactamente con las restricciones genéricas internas de la
 * librería. Las formas de fila/inserción/actualización siguen tipadas en
 * `lib/types/database.ts` y se usan explícitamente en cada consulta.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
