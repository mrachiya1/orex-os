import { notFound } from "next/navigation";
import Link from "next/link";
import { getCompanyBySlug } from "@/lib/database/companies";
import { createServerSupabaseClient } from "@/lib/database/server";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { AskCompanyBrainBox } from "@/components/knowledge/AskCompanyBrainBox";
import { PageHeader } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { IconPlus } from "@/components/ui/icons";

const DOMAINS = ["identity", "business", "strategy", "goals", "operations", "sales", "knowledge"] as const;

export default async function BrainOverviewPage({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const company = await getCompanyBySlug(companySlug);
  if (!company) notFound();

  const supabase = await createServerSupabaseClient();
  const [{ count: totalCount }, { count: verifiedCount }, { count: candidateCount }, canUseAi, canCreate] =
    await Promise.all([
      supabase.from("knowledge_items").select("id", { count: "exact", head: true }).eq("company_id", company.id),
      supabase
        .from("knowledge_items")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id)
        .eq("verification_status", "verified"),
      supabase
        .from("knowledge_items")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id)
        .eq("verification_status", "candidate"),
      hasPermission(company.id, PERMISSIONS.AI_USE),
      hasPermission(company.id, PERMISSIONS.KNOWLEDGE_CREATE),
    ]);

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Company Brain"
        description={`${totalCount ?? 0} knowledge items — ${verifiedCount ?? 0} verified, ${candidateCount ?? 0} pending review.`}
        action={
          canCreate ? (
            <Link href={`/${companySlug}/brain/domain/business`}>
              <Button variant="primary">
                <IconPlus width={13} height={13} />
                Add Knowledge
              </Button>
            </Link>
          ) : undefined
        }
      />

      {canUseAi && (
        <div className="border-b border-[var(--border-subtle)] px-8 py-5">
          <AskCompanyBrainBox organisationId={company.organisation_id} companyId={company.id} />
        </div>
      )}

      <nav className="flex flex-wrap gap-2 px-8 py-5 text-[12.5px]">
        {DOMAINS.map((d) => (
          <Link
            key={d}
            href={`/${companySlug}/brain/domain/${d}`}
            className="ox-focus-ring rounded-[var(--radius-s)] border border-[var(--border-medium)] bg-[var(--surface-2)] px-3 py-1.5 capitalize text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
          >
            {d}
          </Link>
        ))}
        <Link
          href={`/${companySlug}/brain/documents`}
          className="ox-focus-ring rounded-[var(--radius-s)] border border-[var(--border-medium)] bg-[var(--surface-2)] px-3 py-1.5 text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
        >
          Documents
        </Link>
        <Link
          href={`/${companySlug}/brain/decisions`}
          className="ox-focus-ring rounded-[var(--radius-s)] border border-[var(--border-medium)] bg-[var(--surface-2)] px-3 py-1.5 text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
        >
          Decisions
        </Link>
      </nav>
    </div>
  );
}
