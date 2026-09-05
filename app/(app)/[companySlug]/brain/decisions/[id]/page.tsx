import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/lib/database/companies";
import { createServerSupabaseClient } from "@/lib/database/server";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { DecisionReviewForm } from "@/components/decisions/DecisionReviewForm";

export default async function DecisionDetailPage({
  params,
}: {
  params: Promise<{ companySlug: string; id: string }>;
}) {
  const { companySlug, id } = await params;
  const company = await getCompanyBySlug(companySlug);
  if (!company) notFound();

  const supabase = await createServerSupabaseClient();
  const [{ data: decision }, { data: reviews }, canReview] = await Promise.all([
    supabase
      .from("decisions")
      .select("id, title, status, situation, chosen_action, expected_result, decision_date, review_date")
      .eq("id", id)
      .eq("company_id", company.id)
      .maybeSingle(),
    supabase
      .from("decision_reviews")
      .select("id, review_date, actual_result, lesson")
      .eq("decision_id", id)
      .order("review_date", { ascending: false }),
    hasPermission(company.id, PERMISSIONS.DECISIONS_REVIEW),
  ]);

  if (!decision) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-semibold">{decision.title}</h1>
        <p className="mt-1 font-mono text-xs text-[var(--muted)]">{decision.status}</p>
      </header>

      <div className="border-b border-[var(--border)] px-6 py-4 text-sm">
        <p className="whitespace-pre-wrap">{decision.situation}</p>
        {decision.chosen_action && (
          <p className="mt-3 text-[var(--muted)]">
            <span className="font-medium text-[var(--foreground)]">Chosen action: </span>
            {decision.chosen_action}
          </p>
        )}
        {decision.expected_result && (
          <p className="mt-1 text-[var(--muted)]">
            <span className="font-medium text-[var(--foreground)]">Expected result: </span>
            {decision.expected_result}
          </p>
        )}
      </div>

      <div className="border-b border-[var(--border)] px-6 py-4">
        <h2 className="mb-2 text-sm font-medium">Review history</h2>
        {(reviews ?? []).length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No reviews yet.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {(reviews ?? []).map((r) => (
              <li key={r.id} className="rounded-md border border-[var(--border)] p-3">
                <p className="font-mono text-xs text-[var(--muted)]">{r.review_date}</p>
                <p className="mt-1">{r.actual_result}</p>
                {r.lesson && <p className="mt-1 text-[var(--muted)]">Lesson: {r.lesson}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canReview && <DecisionReviewForm decisionId={decision.id} companyId={company.id} />}
    </div>
  );
}
