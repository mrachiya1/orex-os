import { createServerSupabaseClient } from "@/lib/database/server";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function ClientTimelinePage({
  params,
}: {
  params: Promise<{ companySlug: string; clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: events } = await supabase
    .from("client_activity")
    .select("id, event_type, summary, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!events || events.length === 0) {
    return <EmptyState title="No activity yet." body="Timeline events appear here as the relationship progresses." />;
  }

  return (
    <div className="flex flex-col">
      {events.map((e) => (
        <div key={e.id} className="flex items-start gap-3 border-b border-[var(--border-subtle)] py-3 text-[12px] last:border-0">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--info)]" />
          <div className="min-w-0 flex-1">
            <div className="text-[var(--text-primary)]">{e.summary}</div>
            <div className="mt-0.5 num text-[10.5px] text-[var(--text-muted)]">
              {e.event_type.replace(/\./g, " · ").replace(/_/g, " ")} — {new Date(e.created_at).toLocaleString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
