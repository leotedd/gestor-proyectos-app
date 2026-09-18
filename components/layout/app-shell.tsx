"use client";

import { useState } from "react";
import { Menu, X, LayoutGrid } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { ProjectSwitcher } from "@/components/layout/project-switcher";
import { UserMenu } from "@/components/layout/user-menu";
import type { UserProjectSummary } from "@/lib/projects/queries";
import type { ProfileRow } from "@/lib/types/database";

export function AppShell({
  profile,
  projects,
  children,
}: {
  profile: ProfileRow;
  projects: UserProjectSummary[];
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
        <button
          className="md:hidden rounded-md p-1.5 hover:bg-surface-muted"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Abrir menú"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <div className="hidden md:flex items-center gap-2 mr-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <LayoutGrid className="h-4 w-4" />
          </div>
          <span className="font-semibold text-sm text-foreground">Flowbase</span>
        </div>

        <ProjectSwitcher projects={projects} />

        <div className="ml-auto flex items-center gap-3">
          <UserMenu name={profile.full_name || profile.email} email={profile.email} />
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <Sidebar />

        {mobileOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="absolute inset-0 bg-slate-900/50"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-64 bg-surface shadow-xl animate-fade-in">
              <div className="h-14 flex items-center px-4 border-b border-border">
                <span className="font-semibold text-sm">Menú</span>
              </div>
              <div onClick={() => setMobileOpen(false)}>
                <Sidebar className="!flex w-full h-[calc(100vh-3.5rem)]" />
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 min-w-0 overflow-y-auto bg-background">{children}</main>
      </div>
    </div>
  );
}
