import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/database/server";
import { PageHeader, Card, CardHeader } from "@/components/ui/Surface";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconProjects, IconDelivery, IconTeams, IconDecisions, IconBrain } from "@/components/ui/icons";

/**
 * Founder Group Command Centre. Every number here is a real count fetched
 * through the normal RLS-enforced client, filtered by organisation_id (not
 * company_id) -- has_project_access/has_company_permission's existing
 * organisation-level branch is what actually restricts these rows to what
 * this user is entitled to see across companies. No new RLS primitive, no
 * frontend-only aggregation of otherwise-inaccessible data. Finance,
 * Clients, Risks and Opportunities are not shown -- those modules don't
 * exist yet, and AGENTS.md forbids inventing values for them.
 */
export default async function GroupPage() {
  const user = await requireCurrentUser();
  const supabase = await createServerSupabaseClient();

  const { data: organisation } = await supabase.from("organisations").select("id, name").limit(1).maybeSingle();
  if (!organisation) redirect("/");

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, slug")
    .eq("organisation_id", organisation.id)
    .order("name");

  const companyIds = (companies ?? []).map((c) => c.id);

  const [{ data: projects }, { data: deliveryReady }, { data: pendingDecisions }, { data: recentActivity }, { data: knowledgeCounts }] =
    await Promise.all([
      companyIds.length
        ? supabase.from("projects").select("id, company_id, status").in("company_id", companyIds).neq("status", "archived")
        : Promise.resolve({ data: [] as never[] }),
      companyIds.length
        ? supabase.from("projects").select("id, company_id").in("company_id", companyIds).eq("status", "delivery_ready")
        : Promise.resolve({ data: [] as never[] }),
      supabase
        .from("decisions")
        .select("id, title, company_id, status")
        .eq("organisation_id", organisation.id)
        .in("status", ["proposed", "in_review"])
        .order("created_at", { ascending: false })
        .limit(6),
      companyIds.length
        ? supabase
            .from("project_activity")
            .select("id, project_id, summary, created_at, projects!inner(company_id)")
            .in("projects.company_id", companyIds)
            .order("created_at", { ascending: false })
            .limit(6)
        : Promise.resolve({ data: [] as never[] }),
      companyIds.length
        ? supabase.from("knowledge_items").select("id, company_id").in("company_id", companyIds)
        : Promise.resolve({ data: [] as never[] }),
    ]);

  const teamCounts = await Promise.all(
    (companies ?? []).map(async (c) => {
      const { count } = await supabase
        .from("company_members")
        .select("id", { count: "exact", head: true })
        .eq("company_id", c.id)
        .eq("status", "active");
      return { companyId: c.id, count: count ?? 0 };
    })
  );
  const teamCountByCompany = new Map(teamCounts.map((t) => [t.companyId, t.count]));

  const projectCountByCompany = new Map<string, number>();
  const deliveryCountByCompany = new Map<string, number>();
  const knowledgeCountByCompany = new Map<string, number>();
  for (const p of projects ?? []) projectCountByCompany.set(p.company_id, (projectCountByCompany.get(p.company_id) ?? 0) + 1);
  for (const d of deliveryReady ?? []) deliveryCountByCompany.set(d.company_id, (deliveryCountByCompany.get(d.company_id) ?? 0) + 1);
  for (const k of knowledgeCounts ?? []) knowledgeCountByCompany.set(k.company_id, (knowledgeCountByCompany.get(k.company_id) ?? 0) + 1);

  const companyById = new Map((companies ?? []).map((c) => [c.id, c]));
  const decisionRows = pendingDecisions ?? [];
  const activityRows = (recentActivity ?? []) as unknown as Array<{
    id: string;
    project_id: string;
    summary: string;
    created_at: string;
    projects: { company_id: string } | { company_id: string }[];
  }>;

  const totalProjects = projects?.length ?? 0;
  const totalDeliveryReady = deliveryReady?.length ?? 0;
  const totalTeam = teamCounts.reduce((sum, t) => sum + t.count, 0);

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Orex Group" description={`Command centre across ${(companies ?? []).length} companies, ${user.email ?? "you"}.`} />
      <div className="flex flex-col gap-4 p-8 pt-6">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard icon={<IconProjects width={14} height={14} />} label="Active Projects" value={totalProjects} />
          <SummaryCard icon={<IconDelivery width={14} height={14} />} label="Delivery Ready" value={totalDeliveryReady} />
          <SummaryCard icon={<IconTeams width={14} height={14} />} label="Team Members" value={totalTeam} />
          <SummaryCard icon={<IconDecisions width={14} height={14} />} label="Pending Decisions" value={decisionRows.length} />
        </section>

        <section className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          {(companies ?? []).map((c) => (
            <Card key={c.id}>
              <CardHeader title={c.name} href={`/${c.slug}`} actionLabel="Open" />
              <div className="grid grid-cols-3 gap-2 px-5 pb-5 text-center">
                <MiniStat icon={<IconProjects width={13} height={13} />} label="Projects" value={projectCountByCompany.get(c.id) ?? 0} />
                <MiniStat icon={<IconDelivery width={13} height={13} />} label="Delivery" value={deliveryCountByCompany.get(c.id) ?? 0} />
                <MiniStat icon={<IconTeams width={13} height={13} />} label="Team" value={teamCountByCompany.get(c.id) ?? 0} />
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-5 py-2.5 text-[11px] text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5"><IconBrain width={11} height={11} /> Company Brain</span>
                <span className="num">{knowledgeCountByCompany.get(c.id) ?? 0} items</span>
              </div>
            </Card>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Needs Attention" icon={<IconDecisions width={13} height={13} />} />
            <div className="px-2 pb-2">
              {decisionRows.length === 0 ? (
                <EmptyState title="No pending decisions across the group." />
              ) : (
                decisionRows.map((d) => (
                  <Link
                    key={d.id}
                    href={`/${companyById.get(d.company_id)?.slug ?? ""}/brain/decisions/${d.id}`}
                    className="ox-focus-ring flex items-center justify-between rounded-[var(--radius-s)] px-3 py-2.5 text-[12.5px] hover:bg-[var(--surface-3)]"
                  >
                    <span className="truncate text-[var(--text-secondary)]">{d.title}</span>
                    <span className="ox-pill ox-pill-neutral shrink-0">{companyById.get(d.company_id)?.name ?? "—"}</span>
                  </Link>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Recent Project Activity" />
            <div className="px-2 pb-2">
              {activityRows.length === 0 ? (
                <EmptyState title="No recent activity across the group." />
              ) : (
                activityRows.map((a) => {
                  const proj = Array.isArray(a.projects) ? a.projects[0] : a.projects;
                  const company = proj ? companyById.get(proj.company_id) : undefined;
                  return (
                    <div key={a.id} className="flex items-center justify-between rounded-[var(--radius-s)] px-3 py-2.5 text-[12px]">
                      <span className="truncate text-[var(--text-secondary)]">{a.summary}</span>
                      <span className="ox-pill ox-pill-neutral shrink-0">{company?.name ?? "—"}</span>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="ox-card flex items-center gap-3 px-4 py-3.5">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius-s)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-muted)]">
        {icon}
      </div>
      <div>
        <div className="text-[10.5px] text-[var(--text-muted)]">{label}</div>
        <div className="num text-[19px] font-semibold leading-tight text-[var(--text-primary)]">{value}</div>
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-[var(--radius-s)] bg-[var(--surface-sunken)] py-2.5">
      <span className="text-[var(--text-muted)]">{icon}</span>
      <span className="num text-[15px] font-semibold text-[var(--text-primary)]">{value}</span>
      <span className="text-[9.5px] uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
    </div>
  );
}
