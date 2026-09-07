import { createServerSupabaseClient } from "@/lib/database/server";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { Card, CardHeader } from "@/components/ui/Surface";
import { EmptyState } from "@/components/ui/EmptyState";
import { AddContactButton } from "@/components/clients/AddContactButton";
import { AddPreferenceButton } from "@/components/clients/AddPreferenceButton";
import { AddFeedbackButton } from "@/components/clients/AddFeedbackButton";
import { AddIssueButton, ResolveIssueButton } from "@/components/clients/AddIssueButton";

export default async function ClientRelationshipPage({
  params,
}: {
  params: Promise<{ companySlug: string; clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: client } = await supabase.from("clients").select("company_id").eq("id", clientId).maybeSingle();
  if (!client) return null;

  const [canManagePrivate, { data: contacts }, { data: preferences }, { data: feedback }, { data: issues }] =
    await Promise.all([
      hasPermission(client.company_id, PERMISSIONS.CLIENT_CONTACTS_READ_PRIVATE),
      supabase
        .from("client_contacts")
        .select("id, first_name, last_name, job_title, business_email, business_phone, is_primary_contact")
        .eq("client_id", clientId)
        .order("is_primary_contact", { ascending: false }),
      supabase
        .from("client_preferences")
        .select("id, statement, sentiment, knowledge_type, confidence")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
      supabase
        .from("client_feedback")
        .select("id, content, sentiment, feedback_type, received_at")
        .eq("client_id", clientId)
        .order("received_at", { ascending: false }),
      supabase
        .from("client_relationship_issues")
        .select("id, type, severity, reason, status, resolution, occurred_at")
        .eq("client_id", clientId)
        .order("occurred_at", { ascending: false }),
    ]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Contacts" action={<AddContactButton clientId={clientId} />} />
        <div className="px-5 pb-4">
          {!contacts || contacts.length === 0 ? (
            <EmptyState title="No contacts yet." />
          ) : (
            <div className="flex flex-col">
              {contacts.map((c) => (
                <div key={c.id} className="flex items-center justify-between border-b border-[var(--border-subtle)] py-2.5 text-[12px] last:border-0">
                  <div>
                    <span className="font-medium text-[var(--text-primary)]">
                      {[c.first_name, c.last_name].filter(Boolean).join(" ")}
                    </span>
                    {c.is_primary_contact && <span className="ox-pill ox-pill-info ml-2">primary</span>}
                    {c.job_title && <span className="ml-2 text-[var(--text-muted)]">{c.job_title}</span>}
                  </div>
                  <span className="text-[var(--text-muted)]">{c.business_email ?? "—"}</span>
                </div>
              ))}
            </div>
          )}
          {!canManagePrivate && (contacts?.length ?? 0) > 0 && (
            <p className="ox-help mt-2">Personal contact details (birthday, personal phone/email) require the private-contact permission.</p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Working Preferences" action={<AddPreferenceButton clientId={clientId} />} />
        <div className="px-5 pb-4">
          {!preferences || preferences.length === 0 ? (
            <EmptyState title="No preferences recorded yet." />
          ) : (
            <div className="flex flex-col">
              {preferences.map((p) => (
                <div key={p.id} className="flex items-center justify-between border-b border-[var(--border-subtle)] py-2.5 text-[12px] last:border-0">
                  <div>
                    <span className="ox-pill ox-pill-neutral mr-2">{p.sentiment}</span>
                    <span className="text-[var(--text-primary)]">{p.statement}</span>
                  </div>
                  <span
                    className={`ox-pill ${p.knowledge_type === "verified" ? "ox-pill-success" : p.knowledge_type === "inference" ? "ox-pill-warning" : "ox-pill-neutral"}`}
                  >
                    {p.knowledge_type === "verified" ? "VERIFIED" : p.knowledge_type === "inference" ? `AI INFERENCE${p.confidence ? ` ${Math.round(p.confidence * 100)}%` : ""}` : "OBSERVED"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Feedback" action={<AddFeedbackButton clientId={clientId} />} />
        <div className="px-5 pb-4">
          {!feedback || feedback.length === 0 ? (
            <EmptyState title="No feedback recorded yet." />
          ) : (
            <div className="flex flex-col">
              {feedback.map((f) => (
                <div key={f.id} className="border-b border-[var(--border-subtle)] py-2.5 text-[12px] last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="ox-pill ox-pill-neutral">{f.feedback_type.replace(/_/g, " ")}</span>
                    <span className="num text-[10.5px] text-[var(--text-muted)]">{new Date(f.received_at).toLocaleDateString()}</span>
                  </div>
                  <p className="mt-1 text-[var(--text-secondary)]">{f.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Relationship Issues" action={<AddIssueButton clientId={clientId} />} />
        <div className="px-5 pb-4">
          {!issues || issues.length === 0 ? (
            <EmptyState title="No relationship issues recorded." />
          ) : (
            <div className="flex flex-col">
              {issues.map((i) => (
                <div key={i.id} className="border-b border-[var(--border-subtle)] py-2.5 text-[12px] last:border-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`ox-pill ${i.status === "open" ? "ox-pill-danger" : "ox-pill-neutral"}`}>{i.status}</span>
                      <span className="ox-pill ox-pill-neutral">{i.type.replace(/_/g, " ")}</span>
                    </div>
                    {i.status === "open" && <ResolveIssueButton issueId={i.id} />}
                  </div>
                  <p className="mt-1 text-[var(--text-secondary)]">{i.reason}</p>
                  {i.resolution && <p className="mt-1 text-[11px] text-[var(--text-muted)]">Resolution: {i.resolution}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
