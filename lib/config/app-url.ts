import "server-only";

/**
 * The single canonical source of Orex OS's own absolute origin, read from
 * `APP_URL` (docs/.env.example) -- server-side only, environment-driven,
 * never hard-coded per environment. Localhost is only ever the *fallback*
 * for when `APP_URL` is unset, which is expected in local dev and wrong
 * everywhere else; `assertProductionAppUrl()` below exists to catch that
 * misconfiguration loudly instead of silently mailing out localhost links
 * (exactly what happened before this file existed -- Vercel's `APP_URL`
 * was never set for Production, so every auth email fell back to
 * `http://localhost:3000`).
 */
export function getAppUrl(): string {
  const configured = process.env.APP_URL?.trim();
  return configured && configured.length > 0 ? configured.replace(/\/+$/, "") : "http://localhost:3000";
}

/**
 * Logs (not throws -- a broken auth email must never take the whole
 * request down) when running on Vercel but APP_URL is missing or still
 * pointing at localhost, which is exactly the class of bug this file
 * fixes. Cheap enough to call on every auth email send.
 */
export function warnIfAppUrlMisconfiguredInProduction(): void {
  if (process.env.VERCEL_ENV !== "production") return;
  const url = getAppUrl();
  if (url.includes("localhost")) {
    console.error(
      `APP_URL is "${url}" in a Vercel production runtime -- auth emails will link to localhost. ` +
        "Set APP_URL to the real production domain in Vercel project settings."
    );
  }
}

/**
 * A `next`/return path is only safe to redirect to if it stays inside Orex
 * OS. Rejects anything that could send a browser to a different host:
 * absolute URLs (`https://...`), protocol-relative (`//evil.example.com`),
 * backslash tricks some browsers still normalize into `//` (`/\evil.com`),
 * and embedded control/whitespace characters. A strict path *allowlist*
 * isn't practical here -- legitimate destinations include dynamic segments
 * (`/accept-invite/<token>`, `/<companySlug>`) -- so this is a structural
 * validator instead: must start with exactly one `/` and contain nothing
 * that changes the effective host.
 */
export function isSafeInternalPath(path: string): boolean {
  if (typeof path !== "string" || path.length === 0) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//") || path.startsWith("/\\")) return false;
  if (/[\s\x00-\x1f]/.test(path)) return false;
  // A URL constructor resolves scheme-relative/backslash tricks -- if the
  // resolved origin differs from a fixed base, the path was trying to
  // escape the app.
  try {
    const resolved = new URL(path, "http://internal.invalid");
    if (resolved.origin !== "http://internal.invalid") return false;
  } catch {
    return false;
  }
  return true;
}

function safeInternalPathOr(path: string | undefined, fallback: string): string {
  if (path && isSafeInternalPath(path)) return path;
  return fallback;
}

/**
 * The one canonical builder for Orex OS's own absolute URLs -- used for
 * anything mailed out (invite links, the /auth/callback destination) so
 * there is exactly one place that reads APP_URL and validates the path.
 */
export function buildAppUrl(path: string): string {
  const safePath = safeInternalPathOr(path, "/");
  return `${getAppUrl()}${safePath}`;
}

/**
 * Every redirect-carrying auth call (sign-up confirmation, magic link,
 * password reset) shares this: build an absolute /auth/callback URL,
 * carrying only a validated in-app relative `next` path -- never an open
 * redirect, never anything sensitive.
 */
export function buildAuthCallbackUrl(nextPath?: string): string {
  warnIfAppUrlMisconfiguredInProduction();
  const safePath = safeInternalPathOr(nextPath, "/");
  return buildAppUrl(`/auth/callback?next=${encodeURIComponent(safePath)}`);
}
