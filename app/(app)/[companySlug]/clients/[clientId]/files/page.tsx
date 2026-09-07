import { createServerSupabaseClient } from "@/lib/database/server";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { Card, CardHeader } from "@/components/ui/Surface";
import { EmptyState } from "@/components/ui/EmptyState";
import { AddCredentialButton } from "@/components/clients/AddCredentialButton";

export default async function ClientFilesPage({
  params,
}: {
  params: Promise<{ companySlug: string; clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: client } = await supabase.from("clients").select("company_id").eq("id", clientId).maybeSingle();
  if (!client) return null;

  const canReadCredentials = await hasPermission(client.company_id, PERMISSIONS.CLIENT_CREDENTIALS_READ_METADATA);
  const canManageCredentials = await hasPermission(client.company_id, PERMISSIONS.CLIENT_CREDENTIALS_MANAGE);

  const { data: credentials } = canReadCredentials
    ? await supabase
        .from("client_credentials")
        .select("id, label, credential_type, provider, username_hint, updated_at")
        .eq("client_id", clientId)
        .order("updated_at", { ascending: false })
    : { data: [] };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Files" />
        <div className="px-5 pb-5">
          <EmptyState
            title="File storage is not configured yet."
            body="Briefs, proposals, agreements, and reference imagery will live here once secure file storage is set up."
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Credentials"
          action={canManageCredentials ? <AddCredentialButton clientId={clientId} /> : undefined}
        />
        <div className="px-5 pb-5">
          {!canReadCredentials ? (
            <EmptyState title="You don't have permission to view credential references for this client." />
          ) : !credentials || credentials.length === 0 ? (
            <EmptyState
              title="Secure credential storage is not configured yet."
              body="You can still add a reference (label, type, provider) to remember what exists -- never a password or key."
              action={canManageCredentials ? <AddCredentialButton clientId={clientId} /> : undefined}
            />
          ) : (
            <div className="flex flex-col">
              {credentials.map((c) => (
                <div key={c.id} className="flex items-center justify-between border-b border-[var(--border-subtle)] py-2.5 text-[12px] last:border-0">
                  <div>
                    <span className="font-medium text-[var(--text-primary)]">{c.label}</span>
                    <span className="ml-2 ox-pill ox-pill-neutral">{c.credential_type.replace(/_/g, " ")}</span>
                  </div>
                  <span className="text-[var(--text-muted)]">{c.provider ?? "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
