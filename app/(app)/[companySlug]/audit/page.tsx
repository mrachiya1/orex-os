import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/lib/database/companies";
import { listAuditLog } from "@/app/actions/organisation";
import { AuditLogTable } from "@/components/audit/AuditLogTable";
import { PageHeader, Card } from "@/components/ui/Surface";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconAudit } from "@/components/ui/icons";

export default async function AuditPage({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const company = await getCompanyBySlug(companySlug);
  if (!company) notFound();

  let rows: Awaited<ReturnType<typeof listAuditLog>> = [];
  let forbidden = false;
  try {
    rows = await listAuditLog(company.id);
  } catch {
    forbidden = true;
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Audit Log" description="Every traceable mutation across this company." />
      <div className="p-8 pt-6">
        <Card>
          {forbidden ? (
            <EmptyState
              icon={<IconAudit width={16} height={16} />}
              title="You don't have permission to view this company's audit log."
            />
          ) : (
            <AuditLogTable rows={rows as never} />
          )}
        </Card>
      </div>
    </div>
  );
}
