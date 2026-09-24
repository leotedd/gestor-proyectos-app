import "server-only";

// Si Resend (DNS/red) tarda en responder, esto evita que el Server Action
// —y con él el botón "Enviar invitación"— se quede esperando indefinidamente.
// La invitación ya quedó creada en la base antes de intentar el envío; un
// timeout aquí solo afecta si se pudo notificar por correo, nunca si la
// invitación existe.
const SEND_TIMEOUT_MS = 12_000;

/**
 * Envío de correo de invitación vía Resend. Si RESEND_API_KEY no está
 * configurada, la app sigue funcionando: la invitación queda creada en la
 * base de datos con estado PENDING y se informa que el correo no se envió.
 */
export async function sendInvitationEmail(params: {
  to: string;
  projectName: string;
  role: string;
  inviterName: string;
  acceptUrl: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return {
      sent: false,
      reason:
        "El envío de correo está pendiente de configuración (falta RESEND_API_KEY).",
    };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    // El SDK de Resend no acepta un AbortSignal en `send()`, así que el
    // límite de tiempo se hace por fuera: lo que gane la carrera decide.
    const timeout = new Promise<"timeout">((resolve) =>
      setTimeout(() => resolve("timeout"), SEND_TIMEOUT_MS)
    );

    const result = await Promise.race([
      resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
        to: params.to,
        subject: `Invitación a ${params.projectName}`,
        html: `
        <div style="font-family: sans-serif; line-height: 1.6;">
          <h2>Te invitaron a colaborar en "${params.projectName}"</h2>
          <p>${params.inviterName} te invitó con el rol <strong>${params.role}</strong>.</p>
          <p><a href="${params.acceptUrl}" style="display:inline-block;background:#111827;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Aceptar invitación</a></p>
          <p>Si el botón no funciona, copia este enlace: ${params.acceptUrl}</p>
        </div>
      `,
      }),
      timeout,
    ]);

    if (result === "timeout") {
      return {
        sent: false,
        reason:
          "Resend no respondió a tiempo. La invitación quedó creada; copia el enlace para compartirlo manualmente.",
      };
    }

    if (result.error) {
      return { sent: false, reason: result.error.message };
    }

    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      reason: err instanceof Error ? err.message : "Error desconocido al enviar el correo.",
    };
  }
}
