import { z } from "zod";

/**
 * Per-alias structured-output schemas live here (one export per real task,
 * added by whichever future phase builds that task). Phase 002 ships only
 * a test-fixture schema, used by the diagnostic-free automated test suite
 * to exercise the structured-output validation path end-to-end without a
 * real feature existing yet.
 */
export const testFixtureResultSchema = z.object({
  summary: z.string(),
  confidence: z.number().min(0).max(1),
});

export type TestFixtureResult = z.infer<typeof testFixtureResultSchema>;
