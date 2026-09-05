import { randomBytes, createHash } from "crypto";

/**
 * Generates a high-entropy invitation token and its hash. Only the hash is
 * ever persisted (docs/security.md "Invitation Security") -- the raw token
 * exists only long enough to build the invite URL / email.
 */
export function generateInvitationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashInvitationToken(token);
  return { token, tokenHash };
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
