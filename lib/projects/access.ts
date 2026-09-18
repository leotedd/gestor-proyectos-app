import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUserClient } from "@/lib/auth/dal";
import type { ProjectRole, ProjectRow } from "@/lib/types/database";

export const EDITOR_ROLES: ProjectRole[] = ["OWNER", "ADMIN", "MEMBER"];
export const MANAGER_ROLES: ProjectRole[] = ["OWNER", "ADMIN"];

export function canEdit(role: ProjectRole | null | undefined): boolean {
  return !!role && EDITOR_ROLES.includes(role);
}

export function canManage(role: ProjectRole | null | undefined): boolean {
  return !!role && MANAGER_ROLES.includes(role);
}

export function isViewer(role: ProjectRole | null | undefined): boolean {
  return role === "VIEWER";
}

export interface ProjectContext {
  project: ProjectRow;
  role: ProjectRole;
  userId: string;
  canEdit: boolean;
  canManage: boolean;
  isViewer: boolean;
}

/**
 * Carga el proyecto y el rol del usuario actual dentro de él.
 * RLS ya impide leer proyectos ajenos, pero además verificamos aquí para
 * poder mostrar 404 (en vez de una fila vacía) y para exponer el rol.
 * Toda mutación debe volver a comprobar el rol server-side: nunca confiar
 * solo en la UI.
 */
export const getProjectContext = cache(
  async (projectId: string): Promise<ProjectContext> => {
    const { supabase, user } = await requireUserClient();

    const { data: project, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();

    if (error || !project) {
      notFound();
    }

    const { data: membership } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      notFound();
    }

    const role = membership.role;

    return {
      project,
      role,
      userId: user.id,
      canEdit: canEdit(role),
      canManage: canManage(role),
      isViewer: isViewer(role),
    };
  }
);

/**
 * Para Server Actions: exige rol suficiente o lanza error controlado.
 * Devuelve también el cliente de Supabase ya autenticado que se usó para
 * verificar el rol, para que la acción reutilice ese mismo cliente en su
 * mutación en vez de crear uno nuevo sin necesidad.
 */
export async function requireProjectRole(
  projectId: string,
  allowed: ProjectRole[]
): Promise<{ userId: string; role: ProjectRole; supabase: SupabaseClient }> {
  const { supabase, user } = await requireUserClient();

  const { data: membership } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || !allowed.includes(membership.role)) {
    throw new Error(
      "No tienes permisos suficientes para realizar esta acción en este proyecto."
    );
  }

  return { userId: user.id, role: membership.role, supabase };
}

export async function redirectToFirstProject() {
  const { supabase, user } = await requireUserClient();
  const { data } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (data) {
    redirect(`/projects/${data.project_id}/dashboard`);
  }
  redirect("/projects");
}
