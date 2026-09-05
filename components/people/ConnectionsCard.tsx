import { Card, CardHeader } from "@/components/ui/Surface";

const PROVIDERS: { key: string; label: string }[] = [
  { key: "notion", label: "Notion" },
  { key: "google_calendar", label: "Google Calendar" },
  { key: "gmail", label: "Gmail" },
  { key: "google_drive", label: "Google Drive" },
];

/**
 * Architecture-ready placeholder, not a working integration -- no OAuth
 * flow exists yet (see prompts/010 "Deferred Items"). Never claims a
 * connection is active when it isn't; every provider honestly reads "Not
 * connected" until a real OAuth flow is built for it.
 */
export function ConnectionsCard() {
  return (
    <Card>
      <CardHeader title="Connections" />
      <div className="flex flex-col gap-2 px-5 pb-5">
        <p className="text-[11px] text-[var(--text-muted)]">
          Connect specific workspaces or calendars you choose to share with Orex OS. Nothing is imported automatically.
        </p>
        {PROVIDERS.map((p) => (
          <div key={p.key} className="flex items-center justify-between rounded-[var(--radius-m)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3.5 py-2.5">
            <span className="text-[12.5px] text-[var(--text-secondary)]">{p.label}</span>
            <div className="flex items-center gap-2">
              <span className="ox-pill ox-pill-neutral">Not connected</span>
              <button type="button" disabled className="ox-btn ox-btn-ghost ox-btn-sm opacity-50" title="Coming soon">
                Connect
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
