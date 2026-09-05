import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/lib/database/companies";
import { createServerSupabaseClient } from "@/lib/database/server";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { DecisionTable } from "@/components/decisions/DecisionTable";
import { DecisionForm } from "@/components/decisions/DecisionForm";

export default async function DecisionsPage({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const company = await getCompanyBySlug(companySlug);
  if (!company) notFound();

  const supabase = await createServerSupabaseClient();
  const [{ data: rows }, canCreate] = await Promise.all([
    supabase
      .from("decisions")
      .select("id, title, status, decision_date, review_date")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false }),
    hasPermission(company.id, PERMISSIONS.DECISIONS_CREATE),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-semibold">{company.name} — Decisions</h1>
      </header>
      {canCreate && (
        <div className="border-b border-[var(--border)]">
          <DecisionForm organisationId={company.organisation_id} companyId={company.id} />
        </div>
      )}
      <div className="flex-1 overflow-x-auto">
        <DecisionTable rows={(rows ?? []) as never} companySlug={companySlug} />
      </div>
    </div>
  );
}
