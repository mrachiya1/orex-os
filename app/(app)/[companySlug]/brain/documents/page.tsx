import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/lib/database/companies";
import { createServerSupabaseClient } from "@/lib/database/server";
import { KnowledgeTable } from "@/components/knowledge/KnowledgeTable";

const DOCUMENT_TYPES = ["document", "sop", "process", "policy"];

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const company = await getCompanyBySlug(companySlug);
  if (!company) notFound();

  const supabase = await createServerSupabaseClient();
  const { data: rows } = await supabase
    .from("knowledge_items")
    .select("id, title, item_type, origin_type, verification_status, lifecycle_status, confidence, updated_at")
    .eq("company_id", company.id)
    .in("item_type", DOCUMENT_TYPES)
    .neq("lifecycle_status", "archived")
    .order("updated_at", { ascending: false });

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-semibold">{company.name} — Documents</h1>
      </header>
      <div className="flex-1 overflow-x-auto">
        <KnowledgeTable rows={(rows ?? []) as never} companySlug={companySlug} />
      </div>
    </div>
  );
}
