import "server-only";
import { Resend } from "resend";

let client: Resend | null = null;

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Resend(apiKey);
  return client;
}

/**
 * Sends an invitation email via Resend. If RESEND_API_KEY is not configured
 * (e.g. local development before the founder has set one up), this is a
 * no-op and the invite link should be shared manually -- Phase 001 supports
 * both delivery paths (prompts/001-foundation.md Open Questions #4).
 */
export async function sendInvitationEmail(params: {
  to: string;
  companyName: string;
  roleLabel: string;
  inviteUrl: string;
}): Promise<{ sent: boolean }> {
  const resend = getClient();
  if (!resend) {
    return { sent: false };
  }

  await resend.emails.send({
    from: "Orex OS <no-reply@orexos.app>",
    to: params.to,
    subject: `You've been invited to ${params.companyName} on Orex OS`,
    html: `<p>You've been invited to join <strong>${params.companyName}</strong> on Orex OS as <strong>${params.roleLabel}</strong>.</p><p><a href="${params.inviteUrl}">Accept invitation</a></p><p>This link expires in 7 days.</p>`,
  });

  return { sent: true };
}
