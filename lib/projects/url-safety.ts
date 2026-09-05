import "server-only";
import { SECRET_KEY_PATTERN } from "@/lib/audit/redaction";

/**
 * Validates a deliverable/delivery reference URL is well-formed and does
 * not carry embedded credentials -- founder decision #7: "Do not store
 * passwords, API keys, service credentials, FTP credentials, or other
 * secrets in these fields." This is an active check, not just a policy
 * statement: rejects userinfo-in-URL (user:pass@host) and any query
 * parameter whose key matches the same secret-pattern regex used
 * elsewhere in the codebase (lib/audit/redaction.ts), reused rather than
 * duplicated.
 *
 * Never fetches the URL -- this only inspects its shape.
 */
export function assertSafeReferenceUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("reference_url must be a well-formed absolute URL.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("reference_url must use http or https.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("reference_url must not contain embedded credentials.");
  }

  for (const key of parsed.searchParams.keys()) {
    if (SECRET_KEY_PATTERN.test(key)) {
      throw new Error("reference_url must not contain a secret-looking query parameter.");
    }
  }
}
