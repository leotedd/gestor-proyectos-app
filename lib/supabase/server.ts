import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 * Crea una instancia nueva por request (recomendado por @supabase/ssr).
 *
 * `setAll` puede fallar si se llama desde un Server Component puro (no se
 * pueden escribir cookies fuera de una Server Action/Route Handler); se
 * ignora ese caso porque `proxy.ts` ya refresca la sesión en cada navegación.
 *
 * No se tipa con el genérico `Database` (ver nota en lib/supabase/client.ts);
 * los tipos de fila de `lib/types/database.ts` se aplican en cada consulta.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Llamado desde un Server Component: no se puede escribir.
            // `proxy.ts` se encarga de refrescar y persistir la sesión.
          }
        },
      },
    }
  );
}
