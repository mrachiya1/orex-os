/**
 * Shared secret-key-pattern redaction, extracted verbatim from
 * lib/audit/index.ts so lib/ai can reuse the identical rule instead of
 * duplicating it (Phase 002, prompts/002-openrouter-gateway.md "Files
 * Expected to Be Created"). Behavior is unchanged from the original
 * inline implementation -- see lib/audit/index.ts's re-export below.
 */
export const SECRET_KEY_PATTERN = /token|password|secret|api_key|apikey|access_key/i;

export function redactSecrets<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redactSecrets) as unknown as T;

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    result[key] = SECRET_KEY_PATTERN.test(key) ? "[redacted]" : redactSecrets(val);
  }
  return result as T;
}
