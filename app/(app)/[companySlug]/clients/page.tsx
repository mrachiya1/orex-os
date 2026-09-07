import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/lib/database/companies";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { createServerSupabaseClient } from "@/lib/database/server";
import { PageHeader, Card } from "@/components/ui/Surface";
import { EmptyState } from "@/components/ui/EmptyState";
import { CreateClientButton } from "@/components/clients/CreateClientButton";
import { ClientStatusBadge, RelationshipStageBadge, ClientHealthBadge } from "@/components/clients/ClientBadges";
import { IconClients } from "@/components/ui/icons";
import { computeClientHealth } from "@/lib/clients/health";
import { computeClientValue } from "@/lib/clients/value";
import { formatMoney } from "@/lib/finance/currency";
import type { ClientStatus, RelationshipStage } from "@/lib/clients/types";

export default async function ClientsPage({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const company = await getCompanyBySlug(companySlug);
  if (!company) notFound();

  const [canRead, canCreate] = await Promise.all([
    hasPermission(company.id, PERMISSIONS.CLIENTS_READ),
    hasPermission(company.id, PERMISSIONS.CLIENTS_CREATE),
  ]);

  if (!canRead) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Card>
          <EmptyState icon={<IconClients width={16} height={16} />} title="You don't have permission to view this company's clients." />
        </Card>
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, status, relationship_stage, client_since, last_interaction_at")
    .eq("company_id", company.id)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  const clientIds = (clients ?? []).map((c) => c.id);

  const [{ data: contacts }, { data: projects }, { data: openIssues }] = await Promise.all([
    clientIds.length
      ? supabase
          .from("client_contacts")
          .select("client_id, first_name, last_name")
          .in("client_id", clientIds)
          .eq("is_primary_contact", true)
      : Promise.resolve({ data: [] as never[] }),
    clientIds.length
      ? supabase
          .from("projects")
          .select("client_id, status, project_value_minor, currency_code")
          .in("client_id", clientIds)
      : Promise.resolve({ data: [] as never[] }),
    clientIds.length
      ? supabase
          .from("client_relationship_issues")
          .select("client_id")
          .in("client_id", clientIds)
          .eq("status", "open")
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const primaryContactByClient = new Map(
    (contacts ?? []).map((c) => [c.client_id, [c.first_name, c.last_name].filter(Boolean).join(" ")])
  );
  const projectsByClient = new Map<string, typeof projects>();
  for (const p of projects ?? []) {
    const list = projectsByClient.get(p.client_id) ?? [];
    list.push(p);
    projectsByClient.set(p.client_id, list);
  }
  const openIssueCountByClient = new Map<string, number>();
  for (const i of openIssues ?? []) {
    openIssueCountByClient.set(i.client_id, (openIssueCountByClient.get(i.client_id) ?? 0) + 1);
  }

  const ACTIVE_STATUSES = new Set(["draft", "planned", "active", "on_hold", "review", "delivery_ready"]);

  const rows = (clients ?? []).map((c) => {
    const clientProjects = projectsByClient.get(c.id) ?? [];
    const activeProjects = clientProjects.filter((p) => ACTIVE_STATUSES.has(p.status));
    const value = computeClientValue(
      clientProjects.map((p) => ({ status: p.status, projectValueMinor: p.project_value_minor, currencyCode: p.currency_code }))
    );
    const daysSince =
      c.last_interaction_at != null
        ? Math.floor((new Date().getTime() - new Date(c.last_interaction_at).getTime()) / 86400000)
        : null;
    const health = computeClientHealth({
      openIssuesCount: openIssueCountByClient.get(c.id) ?? 0,
      hasLinkedProjects: clientProjects.length > 0,
      hasActiveProject: activeProjects.length > 0,
      hasAtRiskProject: false,
      hasBlockedProject: false,
      daysSinceLastInteraction: daysSince,
    });

    return {
      id: c.id,
      name: c.name,
      status: c.status as ClientStatus,
      relationshipStage: c.relationship_stage as RelationshipStage,
      primaryContact: primaryContactByClient.get(c.id) ?? "—",
      activeProjectCount: activeProjects.length,
      totalProjectCount: clientProjects.length,
      clientSince: c.client_since,
      lastInteractionAt: c.last_interaction_at,
      value,
      health,
    };
  });

  rows.sort((a, b) => {
    const rank = (h: string) => (h === "at_risk" ? 0 : h === "attention" ? 1 : 2);
    return rank(a.health.status) - rank(b.health.status);
  });

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Clients"
        description="Client relationships, connected to projects, contacts, feedback and history."
        action={canCreate ? <CreateClientButton organisationId={company.organisation_id} companyId={company.id} /> : undefined}
      />
      <div className="px-8 py-6">
        {rows.length === 0 ? (
          <Card>
            <div className="px-5 py-8">
              <EmptyState
                icon={<IconClients width={16} height={16} />}
                title="No clients yet."
                body="Create a client profile to connect projects, contacts, feedback and relationship intelligence."
                action={canCreate ? <CreateClientButton organisationId={company.organisation_id} companyId={company.id} /> : undefined}
              />
            </div>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <table className="ox-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Primary Contact</th>
                  <th>Status</th>
                  <th>Relationship</th>
                  <th>Projects</th>
                  <th>Client Since</th>
                  <th>Last Interaction</th>
                  <th>Value</th>
                  <th>Health</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/${companySlug}/clients/${r.id}`} className="ox-focus-ring font-medium hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="text-[var(--text-secondary)]">{r.primaryContact}</td>
                    <td><ClientStatusBadge status={r.status} /></td>
                    <td><RelationshipStageBadge stage={r.relationshipStage} /></td>
                    <td className="num text-[var(--text-secondary)]">
                      {r.activeProjectCount} active / {r.totalProjectCount} total
                    </td>
                    <td className="num text-[var(--text-secondary)]">{r.clientSince ?? "—"}</td>
                    <td className="num text-[var(--text-secondary)]">
                      {r.lastInteractionAt ? new Date(r.lastInteractionAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="num text-[var(--text-secondary)]">
                      {r.value.totalsByCurrency.length === 0
                        ? "Not tracked"
                        : r.value.totalsByCurrency.map((t) => formatMoney(t.lifetimeMinor, t.currencyCode)).join(", ")}
                    </td>
                    <td><ClientHealthBadge status={r.health.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
