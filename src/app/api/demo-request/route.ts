import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod/v4";

/**
 * Public, unauthenticated endpoint for the "Pedir demonstração" form on the
 * marketing site. Sends a notification email via Resend's REST API (no SDK,
 * to avoid an extra dependency and keep this edge-runtime compatible).
 *
 * Configure via env:
 *   RESEND_API_KEY   — required; from https://resend.com/api-keys
 *   RESEND_FROM      — defaults to "Convlyx <noreply@convlyx.com>". Use
 *                      "onboarding@resend.dev" for testing without DNS setup.
 *   DEMO_REQUEST_TO  — defaults to "convlyx@gmail.com".
 */

const demoRequestSchema = z.object({
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional(),
  schoolName: z.string().trim().min(1).max(160),
  message: z.string().trim().max(2000).optional(),
  // Honeypot — invisible field; bots fill it, humans leave it empty.
  // We accept the request silently when filled so the bot doesn't retry.
  website: z.string().max(0).optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalidJson" }, { status: 400 });
  }

  const parsed = demoRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalidInput" }, { status: 400 });
  }

  // Silent success on honeypot trigger
  if (parsed.data.website) {
    return NextResponse.json({ ok: true });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[demo-request] RESEND_API_KEY not configured");
    return NextResponse.json({ error: "emailNotConfigured" }, { status: 500 });
  }

  const { email, phone, schoolName, message } = parsed.data;
  const from = process.env.RESEND_FROM ?? "Convlyx <noreply@convlyx.com>";
  const to = process.env.DEMO_REQUEST_TO ?? "convlyx@gmail.com";

  // Email is always read by the (Portuguese-speaking) team. Pin to pt-PT
  // explicitly so we don't depend on whatever locale next-intl resolves
  // for an unauthenticated POST request.
  const t = await getTranslations({ locale: "pt-PT", namespace: "landing.demoForm" });

  const empty = t("notificationEmptyValue");
  const subject = t("notificationSubject", { schoolName });
  const labels = {
    school: t("notificationFieldSchool"),
    email: t("notificationFieldEmail"),
    phone: t("notificationFieldPhone"),
    message: t("notificationFieldMessage"),
  };

  const text = [
    `${t("notificationHeader")} ${t("notificationVia")}`,
    "",
    `${labels.school}:    ${schoolName}`,
    `${labels.email}:     ${email}`,
    `${labels.phone}:     ${phone || empty}`,
    "",
    `${labels.message}:`,
    message || t("notificationNoMessage"),
  ].join("\n");

  const html = `
    <h2>${escapeHtml(t("notificationHeader"))}</h2>
    <p><strong>${escapeHtml(t("notificationVia"))}</strong></p>
    <table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px;line-height:1.5">
      <tr><td style="padding:6px 12px 6px 0;color:#666">${escapeHtml(labels.school)}</td><td>${escapeHtml(schoolName)}</td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666">${escapeHtml(labels.email)}</td><td><a href="mailto:${encodeURIComponent(email)}">${escapeHtml(email)}</a></td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666">${escapeHtml(labels.phone)}</td><td>${escapeHtml(phone || empty)}</td></tr>
    </table>
    ${message ? `<p style="margin-top:16px"><strong>${escapeHtml(labels.message)}:</strong></p><p style="white-space:pre-wrap">${escapeHtml(message)}</p>` : ""}
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: email,
      subject,
      text,
      html,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("[demo-request] Resend error", res.status, errorBody);
    return NextResponse.json({ error: "sendFailed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
