import "server-only";

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

    const { error } = await resend.emails.send({
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
    });

    if (error) {
      return { sent: false, reason: error.message };
    }

    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      reason: err instanceof Error ? err.message : "Error desconocido al enviar el correo.",
    };
  }
}
