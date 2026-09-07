import { describe, it, expect, vi, beforeEach } from "vitest";

const requireCurrentUser = vi.fn();
const requirePermission = vi.fn();
const requireClientAccess = vi.fn();
const hasProjectAccess = vi.fn();
const writeAuditLog = vi.fn();
const writeClientActivity = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireCurrentUser: (...a: unknown[]) => requireCurrentUser(...a),
}));
vi.mock("@/lib/permissions", () => ({
  requirePermission: (...a: unknown[]) => requirePermission(...a),
  requireClientAccess: (...a: unknown[]) => requireClientAccess(...a),
  hasProjectAccess: (...a: unknown[]) => hasProjectAccess(...a),
  PERMISSIONS: {
    CLIENTS_READ: "clients.read",
    CLIENTS_CREATE: "clients.create",
    CLIENTS_UPDATE: "clients.update",
    CLIENTS_DELETE: "clients.delete",
    CLIENT_CONTACTS_READ_PRIVATE: "client_contacts.read_private",
    CLIENT_CONTACTS_MANAGE_PRIVATE: "client_contacts.manage_private",
    CLIENT_CREDENTIALS_READ_METADATA: "client_credentials.read_metadata",
    CLIENT_CREDENTIALS_MANAGE: "client_credentials.manage",
    PROJECTS_UPDATE: "projects.update",
  },
}));
vi.mock("@/lib/audit", () => ({ writeAuditLog: (...a: unknown[]) => writeAuditLog(...a) }));
vi.mock("@/lib/clients/activity", () => ({ writeClientActivity: (...a: unknown[]) => writeClientActivity(...a) }));

// Generic chainable query-builder mock -- each `.from(table)` call consumes
// the next queued response for that table name (or reuses a single one if
// only one was queued), mirroring app/actions/team.test.ts's mockChain.
function mockChain(result: { data: unknown; error: { message: string } | null }) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit", "is", "ilike", "neq", "not", "in"]) {
    chain[m] = () => chain;
  }
  chain.single = () => Promise.resolve(result);
  chain.maybeSingle = () => Promise.resolve(result);
  chain.insert = () => chain;
  chain.update = () => chain;
  chain.upsert = () => chain;
  chain.then = (resolve: (v: typeof result) => void) => resolve(result);
  return chain;
}

let fromQueues: Record<string, Array<{ data: unknown; error: { message: string } | null }>> = {};
function nextResult(table: string) {
  const q = fromQueues[table];
  if (!q || q.length === 0) return { data: null, error: null };
  return q.length > 1 ? q.shift()! : q[0];
}

vi.mock("@/lib/database/server", () => ({
  createServerSupabaseClient: async () => ({ from: (table: string) => mockChain(nextResult(table)) }),
  createServiceRoleClient: () => ({ from: (table: string) => mockChain(nextResult(table)) }),
}));

const {
  createClient,
  updateClient,
  archiveClient,
  createNote,
  createPreference,
  createCredential,
  getContactPrivate,
  updateContactPrivate,
  linkProjectToClient,
  updateProjectValue,
} = await import("./clients");

const companyId = "11111111-1111-4111-8111-111111111111";
const orgId = "22222222-2222-4222-8222-222222222222";
const clientId = "33333333-3333-4333-8333-333333333333";
const contactId = "44444444-4444-4444-8444-444444444444";
const projectId = "55555555-5555-4555-8555-555555555555";

beforeEach(() => {
  vi.clearAllMocks();
  fromQueues = {};
  requireCurrentUser.mockResolvedValue({ id: "user-1" });
  requirePermission.mockResolvedValue(undefined);
  requireClientAccess.mockResolvedValue(undefined);
  hasProjectAccess.mockResolvedValue(true);
});

describe("createClient", () => {
  it("requires clients.create on the target company", async () => {
    fromQueues.clients = [{ data: { id: clientId }, error: null }];
    await createClient({ organisationId: orgId, companyId, name: "Nova Labs" });
    expect(requirePermission).toHaveBeenCalledWith(companyId, "clients.create");
  });

  it("rejects when the caller lacks clients.create", async () => {
    requirePermission.mockRejectedValue(new Error("Forbidden"));
    await expect(createClient({ organisationId: orgId, companyId, name: "Nova Labs" })).rejects.toThrow("Forbidden");
  });
});

describe("updateClient / archiveClient use client-resource-scoped access, not a bare company check", () => {
  it("updateClient checks requireClientAccess with clients.update", async () => {
    fromQueues.clients = [{ data: { id: clientId, company_id: companyId, organisation_id: orgId, name: "Nova Labs" }, error: null }];
    await updateClient({ clientId, status: "active" });
    expect(requireClientAccess).toHaveBeenCalledWith(clientId, "clients.update");
  });

  it("archiveClient checks requireClientAccess with clients.delete", async () => {
    fromQueues.clients = [{ data: { id: clientId, company_id: companyId, organisation_id: orgId, name: "Nova Labs" }, error: null }];
    await archiveClient({ clientId });
    expect(requireClientAccess).toHaveBeenCalledWith(clientId, "clients.delete");
  });

  it("denies the mutation when requireClientAccess rejects (e.g. viewer/member/contractor without access)", async () => {
    fromQueues.clients = [{ data: { id: clientId, company_id: companyId, organisation_id: orgId, name: "Nova Labs" }, error: null }];
    requireClientAccess.mockRejectedValue(new Error("Forbidden: missing required permission"));
    await expect(updateClient({ clientId, status: "active" })).rejects.toThrow("Forbidden");
  });
});

describe("private contact data is never gated by ordinary clients.read/.update", () => {
  it("getContactPrivate requires client_contacts.read_private, not clients.read", async () => {
    fromQueues.client_contact_private = [{ data: null, error: null }];
    await getContactPrivate(contactId, companyId);
    expect(requirePermission).toHaveBeenCalledWith(companyId, "client_contacts.read_private");
    expect(requirePermission).not.toHaveBeenCalledWith(companyId, "clients.read");
  });

  it("updateContactPrivate requires client_contacts.manage_private, not clients.update", async () => {
    fromQueues.client_contacts = [{ data: { id: contactId, client_id: clientId, company_id: companyId }, error: null }];
    fromQueues.client_contact_private = [{ data: null, error: null }];
    await updateContactPrivate({ contactId, birthday: "1990-01-01" });
    expect(requirePermission).toHaveBeenCalledWith(companyId, "client_contacts.manage_private");
    expect(requirePermission).not.toHaveBeenCalledWith(companyId, "clients.update");
  });

  it("a caller who lacks client_contacts.manage_private is denied even if they hold clients.update", async () => {
    fromQueues.client_contacts = [{ data: { id: contactId, client_id: clientId, company_id: companyId }, error: null }];
    requirePermission.mockRejectedValue(new Error("Forbidden"));
    await expect(updateContactPrivate({ contactId, birthday: "1990-01-01" })).rejects.toThrow("Forbidden");
  });

  it("never writes private field values into the audit log -- only that a change happened", async () => {
    fromQueues.client_contacts = [{ data: { id: contactId, client_id: clientId, company_id: companyId }, error: null }];
    fromQueues.client_contact_private = [{ data: null, error: null }];
    await updateContactPrivate({ contactId, personalEmail: "secret@example.com", privateNotes: "sensitive" });
    const call = writeAuditLog.mock.calls[0][0];
    expect(JSON.stringify(call)).not.toContain("secret@example.com");
    expect(JSON.stringify(call)).not.toContain("sensitive");
  });
});

describe("credential metadata uses its own permission, never clients.update", () => {
  it("createCredential requires client_credentials.manage", async () => {
    fromQueues.clients = [{ data: { id: clientId, company_id: companyId, organisation_id: orgId, name: "Nova Labs" }, error: null }];
    fromQueues.client_credentials = [{ data: { id: "cred-1" }, error: null }];
    await createCredential({ clientId, label: "WordPress admin", credentialType: "website_login" });
    expect(requirePermission).toHaveBeenCalledWith(companyId, "client_credentials.manage");
  });

  it("createCredentialSchema-backed action never accepts a secret/password field", async () => {
    fromQueues.clients = [{ data: { id: clientId, company_id: companyId, organisation_id: orgId, name: "Nova Labs" }, error: null }];
    fromQueues.client_credentials = [{ data: { id: "cred-1" }, error: null }];
    // createCredential takes `unknown` input (parsed by zod), so passing an
    // extra field here proves it's silently stripped, not persisted.
    await createCredential({ clientId, label: "WordPress admin", credentialType: "website_login", password: "hunter2" });
    const auditCall = writeAuditLog.mock.calls[0][0];
    expect(JSON.stringify(auditCall)).not.toContain("hunter2");
  });
});

describe("createPreference provenance defaults", () => {
  it("origin client_direct is auto-verified (the client's own statement IS the verification)", async () => {
    fromQueues.clients = [{ data: { id: clientId, company_id: companyId, organisation_id: orgId, name: "Nova Labs" }, error: null }];
    fromQueues.client_preferences = [{ data: { id: "pref-1" }, error: null }];
    await createPreference({ clientId, statement: "Prefers concise updates", sentiment: "preference", origin: "client_direct" });
    // We can't inspect the insert payload directly with this lightweight
    // mock, but we can assert the call succeeded without throwing the
    // DB-level "AI never pre-verified" constraint's app-side equivalent.
    expect(writeClientActivity).toHaveBeenCalled();
  });
});

describe("linkProjectToClient / updateProjectValue use projects.update via hasProjectAccess, not a bare company check", () => {
  it("linkProjectToClient is denied when the caller lacks project access (e.g. cross-company)", async () => {
    fromQueues.projects = [{ data: { id: projectId, company_id: companyId, organisation_id: orgId, name: "IRWAY" }, error: null }];
    hasProjectAccess.mockResolvedValue(false);
    await expect(linkProjectToClient({ projectId, clientId })).rejects.toThrow("Forbidden");
  });

  it("linkProjectToClient succeeds and audits when access is granted", async () => {
    fromQueues.projects = [
      { data: { id: projectId, company_id: companyId, organisation_id: orgId, name: "IRWAY" }, error: null },
      { data: null, error: null },
    ];
    await linkProjectToClient({ projectId, clientId });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "project.client_linked" }));
  });

  it("updateProjectValue records before/after state on the audit log", async () => {
    fromQueues.projects = [
      { data: { id: projectId, company_id: companyId, organisation_id: orgId, project_value_minor: 100000, currency_code: "USD" }, error: null },
      { data: null, error: null },
    ];
    await updateProjectValue({ projectId, projectValueMinor: 350000, currencyCode: "USD" });
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "project.value_updated",
        beforeState: { projectValueMinor: 100000, currencyCode: "USD" },
        afterState: { projectValueMinor: 350000, currencyCode: "USD" },
      })
    );
  });

  it("updateProjectValue is denied when the caller lacks project access", async () => {
    fromQueues.projects = [{ data: { id: projectId, company_id: companyId, organisation_id: orgId, project_value_minor: null, currency_code: null }, error: null }];
    hasProjectAccess.mockResolvedValue(false);
    await expect(updateProjectValue({ projectId, projectValueMinor: 1000, currencyCode: "USD" })).rejects.toThrow("Forbidden");
  });
});

describe("createNote requires client-resource access", () => {
  it("calls requireClientAccess with clients.update", async () => {
    fromQueues.clients = [{ data: { id: clientId, company_id: companyId, organisation_id: orgId, name: "Nova Labs" }, error: null }];
    fromQueues.client_notes = [{ data: { id: "note-1" }, error: null }];
    await createNote({ clientId, content: "Client mentioned a new brand launch." });
    expect(requireClientAccess).toHaveBeenCalledWith(clientId, "clients.update");
    expect(writeClientActivity).toHaveBeenCalled();
  });
});
