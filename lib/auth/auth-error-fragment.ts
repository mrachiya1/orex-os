/**
 * Supabase reports auth errors (expired/used recovery or magic links,
 * denied OTP, etc.) by appending them to the URL *fragment*
 * (`#error=...&error_code=...&error_description=...`), not a query string
 * -- fragments never reach the server, so this can only be read client-side,
 * wherever the browser actually lands after following the email link.
 *
 * Only a small, known set of error codes get a specific user-facing message.
 * Everything else falls back to a generic message -- Supabase's own
 * `error_description` text is never shown directly (AGENTS.md: don't expose
 * internal provider details).
 */
export type AuthFragmentError = {
  code: string | null;
  message: string;
};

const KNOWN_ERROR_MESSAGES: Record<string, string> = {
  otp_expired: "That email link has expired or has already been used.",
  access_denied: "That email link has expired or has already been used.",
};

const DEFAULT_MESSAGE = "That link could not be used to sign you in. Please request a new one.";

export function parseAuthErrorFragment(hash: string): AuthFragmentError | null {
  const trimmed = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!trimmed) return null;

  const params = new URLSearchParams(trimmed);
  const error = params.get("error");
  if (!error) return null;

  const errorCode = params.get("error_code");
  const message = (errorCode && KNOWN_ERROR_MESSAGES[errorCode]) || KNOWN_ERROR_MESSAGES[error] || DEFAULT_MESSAGE;

  return { code: errorCode ?? error, message };
}
