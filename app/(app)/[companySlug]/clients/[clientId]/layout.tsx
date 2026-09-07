import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/database/server";
import { hasClientAccess, PERMISSIONS } from "@/lib/permissions";
import { ProjectTabs } from "@/components/projects/ProjectTabs";
import { ClientStatusBadge, RelationshipStageBadge } from "@/components/clients/ClientBadges";
import { IconClients } from "@/components/ui/icons";
import type { ClientStatus, RelationshipStage } from "@/lib/clients/types";

export default async function ClientDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ companySlug: string; clientId: string }>;
}) {
  const { companySlug, clientId } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: client }, canRead] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, status, relationship_stage, client_since, last_interaction_at")
      .eq("id", clientId)
      .maybeSingle(),
    hasClientAccess(clientId, PERMISSIONS.CLIENTS_READ),
  ]);

  if (!client || !canRead) notFound();

  const { data: primaryContact } = await supabase
    .from("client_contacts")
    .select("first_name, last_name")
    .eq("client_id", clientId)
    .eq("is_primary_contact", true)
    .maybeSingle();

  const base = `/${companySlug}/clients/${clientId}`;
  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/projects`, label: "Projects" },
    { href: `${base}/relationship`, label: "Relationship" },
    { href: `${base}/timeline`, label: "Timeline" },
    { href: `${base}/files`, label: "Files" },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-8 py-3 text-[12px] text-[var(--text-muted)]">
        <div className="flex items-center gap-1.5">
          <Link href={`/${companySlug}/clients`} className="ox-focus-ring hover:text-[var(--text-primary)]">
            Clients
          </Link>
          <span>/</span>
          <span className="text-[var(--text-secondary)]">{client.name}</span>
        </div>
      </div>

      <div className="border-b border-[var(--border-subtle)] px-8 py-6">
        <div className="flex items-start gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[var(--radius-m)] border border-[var(--border-medium)] bg-[var(--surface-raised)] text-[var(--text-muted)]">
            <IconClients width={22} height={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[19px] font-semibold text-[var(--text-primary)]">{client.name}</h1>
              <ClientStatusBadge status={client.status as ClientStatus} />
              <RelationshipStageBadge stage={client.relationship_stage as RelationshipStage} />
            </div>

            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
              <PrimaryField label="Primary Contact">
                <span className="text-[12px] text-[var(--text-secondary)]">
                  {primaryContact ? [primaryContact.first_name, primaryContact.last_name].filter(Boolean).join(" ") : "—"}
                </span>
              </PrimaryField>
              <PrimaryField label="Client Since">
                <span className="num text-[12px] text-[var(--text-secondary)]">{client.client_since ?? "—"}</span>
              </PrimaryField>
              <PrimaryField label="Last Interaction">
                <span className="num text-[12px] text-[var(--text-secondary)]">
                  {client.last_interaction_at ? new Date(client.last_interaction_at).toLocaleDateString() : "—"}
                </span>
              </PrimaryField>
            </div>
          </div>
        </div>
      </div>

      <ProjectTabs base={base} tabs={tabs} />
      <div className="flex-1 overflow-x-auto px-8 py-6">{children}</div>
    </div>
  );
}

function PrimaryField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
