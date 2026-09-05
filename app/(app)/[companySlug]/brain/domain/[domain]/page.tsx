import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/lib/database/companies";
import { createServerSupabaseClient } from "@/lib/database/server";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { KnowledgeTable } from "@/components/knowledge/KnowledgeTable";
import { KnowledgeForm } from "@/components/knowledge/KnowledgeForm";
import { PasteTextIngestForm } from "@/components/knowledge/PasteTextIngestForm";

const VALID_DOMAINS = ["identity", "business", "strategy", "goals", "operations", "sales", "knowledge"];

export default async function DomainPage({
  params,
}: {
  params: Promise<{ companySlug: string; domain: string }>;
}) {
  const { companySlug, domain } = await params;
  if (!VALID_DOMAINS.includes(domain)) notFound();

  const company = await getCompanyBySlug(companySlug);
  if (!company) notFound();

  const supabase = await createServerSupabaseClient();
  const [{ data: rows }, canCreate, canVerify] = await Promise.all([
    supabase
      .from("knowledge_items")
      .select("id, title, item_type, origin_type, verification_status, lifecycle_status, confidence, updated_at")
      .eq("company_id", company.id)
      .eq("domain", domain)
      .neq("lifecycle_status", "archived")
      .order("updated_at", { ascending: false }),
    hasPermission(company.id, PERMISSIONS.KNOWLEDGE_CREATE),
    hasPermission(company.id, PERMISSIONS.KNOWLEDGE_VERIFY),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-semibold capitalize">
          {company.name} — {domain}
        </h1>
      </header>

      {canCreate && (
        <div className="border-b border-[var(--border)]">
          <KnowledgeForm
            organisationId={company.organisation_id}
            companyId={company.id}
            domain={domain}
            canVerify={canVerify}
          />
          <PasteTextIngestForm organisationId={company.organisation_id} companyId={company.id} domain={domain} />
        </div>
      )}

      <div className="flex-1 overflow-x-auto">
        <KnowledgeTable rows={(rows ?? []) as never} companySlug={companySlug} />
      </div>
    </div>
  );
}
