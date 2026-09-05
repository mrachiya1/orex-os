import { notFound } from "next/navigation";
import Link from "next/link";
import { getCompanyBySlug } from "@/lib/database/companies";
import { createServerSupabaseClient } from "@/lib/database/server";
import { StatusBadge } from "@/components/projects/ProjectStatusBadge";
import { PageHeader, Card } from "@/components/ui/Surface";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconDelivery } from "@/components/ui/icons";

export default async function DeliveryReadyPage({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const company = await getCompanyBySlug(companySlug);
  if (!company) notFound();

  const supabase = await createServerSupabaseClient();
  const { data: rows } = await supabase
    .from("projects")
    .select("id, name, project_code, status")
    .eq("company_id", company.id)
    .in("status", ["active", "review", "delivery_ready"])
    .order("target_date", { ascending: true, nullsFirst: false });

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Delivery Ready"
        description="Every project approaching delivery, with its readiness status at a glance."
      />
      <div className="p-8 pt-6">
        <Card>
          {(rows ?? []).length === 0 ? (
            <EmptyState
              icon={<IconDelivery width={16} height={16} />}
              title="No projects currently approaching delivery."
            />
          ) : (
            <table className="ox-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(rows ?? []).map((row) => (
                  <tr key={row.id}>
                    <td className="font-semibold">{row.name}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/${companySlug}/projects/${row.id}/readiness`}
                        className="ox-focus-ring text-[11.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      >
                        View readiness →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
