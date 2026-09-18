"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronsUpDown, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserProjectSummary } from "@/lib/projects/queries";

export function ProjectSwitcher({ projects }: { projects: UserProjectSummary[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  const currentId = pathname.match(/^\/projects\/([^/]+)/)?.[1];
  const current = projects.find((p) => p.id === currentId);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-muted min-w-48 justify-between"
      >
        <span className="truncate">
          {current ? (
            <>
              <span className="text-muted-foreground mr-1.5">{current.key}</span>
              {current.name}
            </>
          ) : (
            "Selecciona un proyecto"
          )}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-72 rounded-lg border border-border bg-surface shadow-lg py-1 animate-fade-in max-h-80 overflow-y-auto">
          {projects.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">Aún no tienes proyectos.</p>
          )}
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => {
                setOpen(false);
                router.push(`/projects/${project.id}/dashboard`);
              }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-surface-muted text-left"
            >
              <span className="truncate">
                <span className="text-muted-foreground mr-1.5">{project.key}</span>
                {project.name}
              </span>
              {project.id === currentId && <Check className="h-4 w-4 text-primary shrink-0" />}
            </button>
          ))}
          <div className="border-t border-border mt-1 pt-1">
            <button
              onClick={() => {
                setOpen(false);
                router.push("/projects?new=1");
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-surface-muted"
              )}
            >
              <Plus className="h-4 w-4" /> Nuevo proyecto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
