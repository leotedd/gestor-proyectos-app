"use client";

import { useState, useTransition } from "react";
import { X, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { cancelInvitationAction } from "@/app/actions/invitations";
import type { InvitationRow } from "@/lib/types/database";

function CopyLinkIconButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Copiar enlace de invitación"
      onClick={async () => {
        try {
          const link = `${window.location.origin}/invite/${token}`;
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Portapapeles no disponible.
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

const statusTone: Record<string, "warning" | "success" | "danger" | "neutral"> = {
  PENDING: "warning",
  ACCEPTED: "success",
  EXPIRED: "danger",
  CANCELLED: "neutral",
};

const statusLabel: Record<string, string> = {
  PENDING: "Pendiente",
  ACCEPTED: "Aceptada",
  EXPIRED: "Expirada",
  CANCELLED: "Cancelada",
};

export function PendingInvitations({
  projectId,
  invitations,
}: {
  projectId: string;
  invitations: InvitationRow[];
}) {
  const [, startTransition] = useTransition();

  if (invitations.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay invitaciones registradas.</p>;
  }

  return (
    <div className="rounded-xl border border-border bg-surface divide-y divide-border">
      {invitations.map((inv) => (
        <div key={inv.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{inv.email}</p>
            <p className="text-xs text-muted-foreground">
              Enviada {formatDateTime(inv.created_at)} · Expira {formatDateTime(inv.expires_at)}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge tone="primary">{inv.role}</Badge>
            <Badge tone={statusTone[inv.status]}>{statusLabel[inv.status]}</Badge>
            {inv.status === "PENDING" && (
              <>
                <CopyLinkIconButton token={inv.token} />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Cancelar invitación"
                  onClick={() => startTransition(() => cancelInvitationAction(inv.id, projectId))}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
