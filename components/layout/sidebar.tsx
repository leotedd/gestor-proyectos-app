"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  LayoutDashboard,
  KanbanSquare,
  ListChecks,
  ListTodo,
  CalendarRange,
  Users,
  FolderKanban,
  FileText,
  Activity,
  Settings,
  FolderGit2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { subscribe, getSnapshot, getServerSnapshot } from "@/lib/client/project-role-store";

function useProjectId() {
  const pathname = usePathname();
  const match = pathname.match(/^\/projects\/([^/]+)/);
  return match && match[1] !== "new" ? match[1] : null;
}

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const projectId = useProjectId();

  // El rol lo publica <SyncProjectRole> desde [projectId]/layout.tsx (ver
  // lib/client/project-role-store.ts). Mientras no coincide con el
  // proyecto de la URL actual (recién entrando, o cambiando de proyecto),
  // se trata como "desconocido" y se ocultan los ítems sensibles al rol
  // — nunca se muestran de más ni por un instante.
  const roleState = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const role = roleState.projectId === projectId ? roleState.role : null;

  const topLinks = [{ href: "/projects", label: "Mis proyectos", icon: FolderGit2 }];

  const projectLinks = projectId
    ? [
        { href: `/projects/${projectId}/dashboard`, label: "Dashboard", icon: LayoutDashboard },
        ...(role === "OWNER" || role === "MEMBER"
          ? [{ href: `/projects/${projectId}/my-tasks`, label: "Mis tareas", icon: ListTodo }]
          : []),
        { href: `/projects/${projectId}/board`, label: "Tablero", icon: KanbanSquare },
        { href: `/projects/${projectId}/tasks`, label: "Tareas", icon: ListChecks },
        { href: `/projects/${projectId}/schedule`, label: "Cronograma", icon: CalendarRange },
        { href: `/projects/${projectId}/members`, label: "Miembros", icon: Users },
        { href: `/projects/${projectId}/areas`, label: "Áreas", icon: FolderKanban },
        { href: `/projects/${projectId}/documents`, label: "Documentos", icon: FileText },
        { href: `/projects/${projectId}/activity`, label: "Actividad", icon: Activity },
        ...(role === "OWNER"
          ? [{ href: `/projects/${projectId}/settings`, label: "Configuración", icon: Settings }]
          : []),
      ]
    : [];

  const renderLink = (link: { href: string; label: string; icon: typeof LayoutDashboard }) => {
    const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
    const Icon = link.icon;
    return (
      <Link
        key={link.href}
        href={link.href}
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-primary/10 text-primary"
            : "text-slate-600 hover:bg-surface-muted hover:text-foreground"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {link.label}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-surface px-3 py-4 overflow-y-auto",
        className
      )}
    >
      <nav className="flex flex-col gap-1">{topLinks.map(renderLink)}</nav>

      {projectLinks.length > 0 && (
        <>
          <div className="mt-4 mb-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Proyecto
          </div>
          <nav className="flex flex-col gap-1">{projectLinks.map(renderLink)}</nav>
        </>
      )}
    </aside>
  );
}
