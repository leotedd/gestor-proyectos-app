"use client";

import { useEffect } from "react";
import { setProjectRole } from "@/lib/client/project-role-store";
import type { ProjectRole } from "@/lib/types/database";

/** Marcador invisible: publica el rol (ya calculado server-side) al store del Sidebar. */
export function SyncProjectRole({ projectId, role }: { projectId: string; role: ProjectRole }) {
  useEffect(() => {
    setProjectRole(projectId, role);
  }, [projectId, role]);

  return null;
}
