import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

/**
 * Server-only development integration config -- runs *.integration.test.ts
 * files, which make real OpenRouter network calls using OPENROUTER_API_KEY
 * from the local environment. Never run in CI by default; invoke explicitly
 * via `npm run test:integration`. Never logs or prints the API key itself
 * -- see lib/ai/router.integration.test.ts.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "server-only": path.resolve(__dirname, "test/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.integration.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    testTimeout: 30_000,
    setupFiles: ["./test/load-env.ts"],
  },
});
