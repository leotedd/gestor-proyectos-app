import { redirect } from "next/navigation";
import { LayoutGrid, Mail } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/dal";
import { getInvitationByToken } from "@/lib/invitations/queries";
import { RoleBadge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { AcceptInvitationForm } from "@/components/invite/accept-invitation-form";

export const metadata = { title: "Invitación — Flowbase" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?next=/invite/${token}`);
  }

  const invitation = await getInvitationByToken(token);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <LayoutGrid className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold text-foreground">Flowbase</span>
        </div>

        <div className="rounded-xl border border-border bg-surface p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>

          {!invitation ? (
            <>
              <h1 className="text-lg font-semibold text-foreground mb-2">
                Invitación no encontrada
              </h1>
              <p className="text-sm text-muted-foreground">
                El enlace no es válido o ya fue utilizado.
              </p>
            </>
          ) : invitation.status !== "PENDING" ? (
            <>
              <h1 className="text-lg font-semibold text-foreground mb-2">
                Invitación no disponible
              </h1>
              <p className="text-sm text-muted-foreground">
                Esta invitación ya fue {invitation.status === "ACCEPTED" ? "aceptada" : "cancelada o expiró"}.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-foreground mb-1">
                Te invitaron a colaborar
              </h1>
              <p className="text-sm text-muted-foreground mb-4">
                <span className="font-medium text-foreground">{invitation.project.name}</span>{" "}
                ({invitation.project.key})
              </p>
              <div className="flex justify-center mb-5">
                <RoleBadge role={invitation.role} />
              </div>

              {invitation.email.toLowerCase() !== (user.email ?? "").toLowerCase() && (
                <Alert tone="warning" className="mb-4 text-left">
                  Esta invitación es para <strong>{invitation.email}</strong>, pero iniciaste
                  sesión como {user.email}.
                </Alert>
              )}

              <AcceptInvitationForm token={token} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
