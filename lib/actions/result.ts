/**
 * Shared return shape for Server Actions whose failures are expected and
 * user-facing (bad password, expired invite, etc.). Next.js redacts the
 * `message` of anything *thrown* out of a Server Action in production
 * builds -- only a generic digest-bearing error reaches the client (this
 * never triggers in `next dev`, which is why it was invisible during local
 * testing). Returning this shape instead means no error ever crosses the
 * action boundary, so there's nothing for Next to redact.
 */
export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };
