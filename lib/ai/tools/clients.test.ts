import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { clientsTools } from "./clients";

const sourceCode = readFileSync(fileURLToPath(new URL("./clients.ts", import.meta.url)), "utf-8");

describe("clients.* AI read tools", () => {
  it("registers exactly the 7 read-only tools granted to the advisor agent (migration 0045)", () => {
    expect(Object.keys(clientsTools).sort()).toEqual(
      [
        "clients.search",
        "clients.get",
        "clients.projects.list",
        "clients.timeline.list",
        "clients.preferences.list",
        "clients.feedback.list",
        "clients.issues.list",
      ].sort()
    );
  });

  it("every registered tool is risk level 0 (read only) -- no mutation tool exists in this file", () => {
    for (const tool of Object.values(clientsTools)) {
      expect(tool.riskLevel).toBe(0);
    }
  });

  it("never queries client_contact_private -- the sensitive-tier table is never touched by any AI tool", () => {
    expect(sourceCode).not.toContain("client_contact_private");
  });

  it("never selects private-contact field names -- defense in depth even if a future edit touched the private table", () => {
    for (const forbidden of ["personal_email", "personal_phone", "birthday", "private_notes"]) {
      expect(sourceCode).not.toContain(forbidden);
    }
  });

  it("never queries client_credentials -- no AI tool surface exists for credential metadata in V1", () => {
    expect(sourceCode).not.toContain("client_credentials");
  });

  it("clients.get is client-scoped (resolves access via has_client_access, not a caller-supplied companyId)", () => {
    expect(clientsTools["clients.get"].scopeType).toBe("client");
  });
});
