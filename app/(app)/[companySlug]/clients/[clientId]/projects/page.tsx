import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/database/server";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkProjectForm } from "@/components/clients/LinkProjectForm";
import { formatMoney } from "@/lib/finance/currency";

export default async function ClientProjectsPage({
  params,
}: {
  params: Promise<{ companySlug: string; clientId: string }>;
}) {
  const { companySlug, clientId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: client } = await supabase.from("clients").select("company_id").eq("id", clientId).maybeSingle();
  if (!client) return null;

  const [{ data: projects }, { data: unlinked }, canUpdate] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, project_code, status, target_date, project_value_minor, currency_code")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id, name")
      .eq("company_id", client.company_id)
      .is("client_id", null)
      .order("name")
      .limit(50),
    hasPermission(client.company_id, PERMISSIONS.PROJECTS_UPDATE),
  ]);

  return (
    <div className="flex flex-col gap-4">
      {canUpdate && (unlinked?.length ?? 0) > 0 && (
        <div className="ox-card px-5 py-4">
          <LinkProjectForm clientId={clientId} candidateProjects={unlinked ?? []} />
        </div>
      )}

      {!projects || projects.length === 0 ? (
        <EmptyState title="No projects linked yet." body="Link an existing project above, or set the client from the project's Overview." />
      ) : (
        <table className="ox-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Status</th>
              <th>Target Date</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/${companySlug}/projects/${p.id}`} className="ox-focus-ring hover:underline">
                    {p.name}
                  </Link>
                  <span className="ml-2 num text-[10.5px] text-[var(--text-muted)]">{p.project_code}</span>
                </td>
                <td><span className="ox-pill ox-pill-neutral">{p.status.replace(/_/g, " ")}</span></td>
                <td className="num text-[var(--text-secondary)]">{p.target_date ?? "—"}</td>
                <td className="num text-[var(--text-secondary)]">
                  {p.project_value_minor != null && p.currency_code ? formatMoney(p.project_value_minor, p.currency_code) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
