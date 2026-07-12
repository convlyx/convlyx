import "server-only";
import { logger } from "@/lib/logger";

/**
 * Minimal transactional-email sender over the Resend HTTP API (no SDK dep —
 * mirrors `api/demo-request`). Best-effort: returns `false` (never throws) if
 * Resend isn't configured or the send fails, so callers can treat email as a
 * non-critical side effect.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("sendEmail: RESEND_API_KEY not configured — skipping", { subject: params.subject });
    return false;
  }
  const from = process.env.RESEND_FROM ?? "Convlyx <noreply@convlyx.com>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        ...(params.text && { text: params.text }),
      }),
    });
    if (!res.ok) {
      logger.error("sendEmail: Resend send failed", { status: res.status, body: await res.text() });
      return false;
    }
    return true;
  } catch (e) {
    logger.error("sendEmail: Resend request threw", { error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * "You've been added to <school>" email for a person who already has a Convlyx
 * account (cross-tenant add). `actionUrl` is a one-click magic link that logs
 * them into the new school's subdomain — the existing-user analogue of the
 * set-password invite email. Same visual language as the Supabase invite
 * template.
 */
export function renderAddedToSchoolEmail(params: {
  schoolName: string;
  actionUrl: string;
}): { subject: string; html: string; text: string } {
  const school = escapeHtml(params.schoolName);
  const url = params.actionUrl;
  const subject = `Foi adicionado/a à escola ${params.schoolName}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#16a34a,#15803d);padding:32px 32px 24px;text-align:center;">
              <div style="display:inline-block;background-color:#ffffff;border-radius:16px;padding:8px;margin:0 auto 12px;">
                <img src="https://convlyx.com/favicon.png" width="48" height="48" alt="" style="display:block;" />
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Convlyx</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 8px;font-size:18px;font-weight:600;color:#18181b;">Bem-vindo/a à ${school}</h2>
              <p style="margin:0 0 24px;font-size:14px;color:#71717a;line-height:1.6;">
                Foi adicionado/a à escola <strong>${school}</strong> na Convlyx. Como já tem uma conta, basta iniciar sessão com as suas credenciais habituais — a sua palavra-passe mantém-se.
              </p>
              <table align="center" cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td bgcolor="#16a34a" style="background-color:#16a34a;border-radius:8px;">
                    <a href="${url}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">Iniciar sessão</a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:12px;color:#a1a1aa;line-height:1.5;">
                Se não esperava este acesso, pode ignorar este email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #f4f4f5;text-align:center;">
              <p style="margin:0;font-size:11px;color:#a1a1aa;">© 2026 Convlyx. Todos os direitos reservados.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Bem-vindo/a à ${params.schoolName}\n\nFoi adicionado/a à escola ${params.schoolName} na Convlyx. Como já tem uma conta, inicie sessão com as suas credenciais habituais (a sua palavra-passe mantém-se):\n\n${url}\n\nSe não esperava este acesso, pode ignorar este email.`;

  return { subject, html, text };
}
