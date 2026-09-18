"use client";

import { useState, useRef, useEffect } from "react";
import { LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { signOutAction } from "@/app/actions/auth";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2">
        <Avatar name={name} size="sm" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-lg border border-border bg-surface shadow-lg py-1 animate-fade-in">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-sm font-medium text-foreground truncate">{name}</p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-surface-muted"
            >
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
