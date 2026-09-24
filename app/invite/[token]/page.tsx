import Link from "next/link";
import { LayoutGrid, Mail } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/dal";
import { getInvitationByToken, getInvitationPreview } from "@/lib/invitations/queries";
import { RoleBadge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AcceptInvitationForm } from "@/components/invite/accept-invitation-form";
import { GuestInviteForm } from "@/components/invite/guest-invite-form";
import { signOutAction } from "@/app/actions/auth";

export const metadata = { title: "Invitación — Flowbase" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getCurrentUser();

  // Sin sesión o con sesión anónima (invitado): leemos con la función
  // pública acotada al token, porque RLS de `invitations` exige rol
  // OWNER/ADMIN o que el email del JWT coincida — un invitado anónimo no
  // tiene email en su JWT. Con una cuenta real, usamos la consulta normal
  // (protegida por RLS) para no perder el flujo tradicional.
  const invitation =
    user && !user.is_anonymous
      ? await getInvitationByToken(token)
      : await getInvitationPreview(token);

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
                {user ? "Te invitaron a colaborar" : "Bienvenido a Flowbase"}
              </h1>
              <p className="text-sm text-muted-foreground mb-4">
                Has sido invitado al proyecto{" "}
                <span className="font-medium text-foreground">
                  {"project" in invitation ? invitation.project.name : invitation.project_name}
                </span>
              </p>
              <div className="flex justify-center mb-5">
                <RoleBadge role={invitation.role} />
              </div>

              {!user && (
                <div className="space-y-4">
                  <Link
                    href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
                    className="inline-flex items-center justify-center rounded-lg font-medium transition-colors h-9 px-4 text-sm gap-2 w-full border border-border bg-surface hover:bg-surface-muted text-foreground"
                  >
                    Ya tengo una cuenta — Iniciar sesión
                  </Link>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    o continúa sin cuenta
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  <GuestInviteForm token={token} defaultEmail={invitation.email} />
                </div>
              )}

              {user && user.is_anonymous && (
                <GuestInviteForm token={token} defaultEmail={invitation.email} />
              )}

              {user &&
                !user.is_anonymous &&
                user.email?.toLowerCase() === invitation.email.toLowerCase() && (
                  <AcceptInvitationForm token={token} />
                )}

              {user &&
                !user.is_anonymous &&
                user.email?.toLowerCase() !== invitation.email.toLowerCase() && (
                  <div className="space-y-4">
                    <Alert tone="warning" className="text-left">
                      Esta invitación es para <strong>{invitation.email}</strong>, pero iniciaste
                      sesión como {user.email}. Cierra esa sesión y vuelve a abrir este enlace
                      para continuar.
                    </Alert>
                    <form action={signOutAction}>
                      <Button type="submit" variant="outline" className="w-full">
                        Cerrar sesión
                      </Button>
                    </form>
                  </div>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
