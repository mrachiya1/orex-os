import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/lib/database/companies";
import { createServerSupabaseClient } from "@/lib/database/server";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { VerificationBadge, FreshnessBadge } from "@/components/knowledge/KnowledgeStatusBadge";
import { VerifyActions } from "@/components/knowledge/VerifyActions";

export default async function KnowledgeItemPage({
  params,
}: {
  params: Promise<{ companySlug: string; id: string }>;
}) {
  const { companySlug, id } = await params;
  const company = await getCompanyBySlug(companySlug);
  if (!company) notFound();

  const supabase = await createServerSupabaseClient();
  const [{ data: item }, canVerify, canManage] = await Promise.all([
    supabase
      .from("knowledge_items")
      .select(
        "id, title, content, domain, item_type, origin_type, verification_status, lifecycle_status, classification, confidence, verified_at, created_at, updated_at, knowledge_sources(source_type, source_label)"
      )
      .eq("id", id)
      .eq("company_id", company.id)
      .maybeSingle(),
    hasPermission(company.id, PERMISSIONS.KNOWLEDGE_VERIFY),
    hasPermission(company.id, PERMISSIONS.KNOWLEDGE_MANAGE),
  ]);

  if (!item) notFound();

  const source = Array.isArray(item.knowledge_sources) ? item.knowledge_sources[0] : item.knowledge_sources;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-semibold">{item.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <VerificationBadge status={item.verification_status} originType={item.origin_type} />
          <FreshnessBadge status={item.lifecycle_status} />
          <span className="rounded-md border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)]">
            {item.classification}
          </span>
          <span className="font-mono text-xs text-[var(--muted)]">{item.item_type} / {item.domain}</span>
        </div>
      </header>

      <div className="flex-1 px-6 py-4 text-sm">
        <p className="whitespace-pre-wrap">{item.content}</p>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-[var(--muted)]">
          <dt>Source</dt>
          <dd>{source?.source_label ?? source?.source_type ?? "—"}</dd>
          <dt>Origin</dt>
          <dd>{item.origin_type}</dd>
          {item.confidence != null && (
            <>
              <dt>AI confidence</dt>
              <dd>{Math.round(item.confidence * 100)}%</dd>
            </>
          )}
          <dt>Verified at</dt>
          <dd>{item.verified_at ? new Date(item.verified_at).toLocaleString() : "—"}</dd>
          <dt>Created</dt>
          <dd>{new Date(item.created_at).toLocaleString()}</dd>
          <dt>Updated</dt>
          <dd>{new Date(item.updated_at).toLocaleString()}</dd>
        </dl>
      </div>

      <VerifyActions
        knowledgeItemId={item.id}
        companyId={company.id}
        canVerify={canVerify && item.verification_status === "candidate"}
        canArchive={canManage && item.lifecycle_status !== "archived"}
      />
    </div>
  );
}
