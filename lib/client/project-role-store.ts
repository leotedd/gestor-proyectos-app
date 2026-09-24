"use client";

import type { ProjectRole } from "@/lib/types/database";

/**
 * Comparte el rol del proyecto activo con el Sidebar sin una petición de
 * red extra: `[projectId]/layout.tsx` ya calcula el rol server-side para
 * renderizar la página, y lo entrega aquí vía <SyncProjectRole> (un simple
 * prop, ya viene en el HTML/RSC de la navegación). El Sidebar vive en el
 * layout de arriba `(app)/layout.tsx`, así que no puede recibirlo por
 * contexto de React (el contexto solo fluye hacia abajo); este store es
 * el puente entre ambos, solo en el navegador.
 *
 * `getServerSnapshot` SIEMPRE devuelve el valor vacío: durante el render en
 * servidor este módulo es compartido entre peticiones de distintos
 * usuarios, así que nunca debe leer el estado mutable ahí (evita filtrar
 * el rol de un usuario en la respuesta de otro). El estado real solo se
 * lee en el cliente, donde el módulo vive aislado por pestaña/usuario.
 */
type State = { projectId: string | null; role: ProjectRole | null };

const EMPTY: State = { projectId: null, role: null };
let state: State = EMPTY;
const listeners = new Set<() => void>();

export function setProjectRole(projectId: string, role: ProjectRole) {
  if (state.projectId === projectId && state.role === role) return;
  state = { projectId, role };
  listeners.forEach((l) => l());
}

export function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function getSnapshot(): State {
  return state;
}

export function getServerSnapshot(): State {
  return EMPTY;
}
