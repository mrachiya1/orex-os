"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconClose, IconClock } from "@/components/ui/icons";
import { setAgentEnabled } from "@/app/actions/agents";
import type { IntelligenceContextSummary } from "@/lib/intelligence/context";
import type { RecentActivityRow } from "@/app/actions/agents";
import type { SelectableAgent } from "./AgentSelector";

const SUGGESTIONS = ["What needs my attention?", "Prepare tomorrow", "Review active projects", "What decisions need me?"];

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

/**
 * Current Context, Active AI (with real inline enable/disable), Recent
 * Activity, Suggested. No metric dashboards, no fabricated numbers -- every
 * count/row here is either permission-gated real data (`null`/empty is
 * omitted rather than guessed) or the toggle's own live server state.
 */
export function ContextRail({
  companyId,
  companyName,
  context,
  agents,
  activeAgentId,
  isThinking,
  manageHref,
  canManageAgents,
  recentActivity,
  open,
  onClose,
  onSuggestion,
}: {
  companyId: string;
  companyName: string;
  context: IntelligenceContextSummary;
  agents: SelectableAgent[];
  activeAgentId: string | null;
  isThinking: boolean;
  manageHref: string;
  canManageAgents: boolean;
  recentActivity: RecentActivityRow[];
  open: boolean;
  onClose: () => void;
  onSuggestion: (text: string) => void;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  const contextRows: Array<{ label: string; value: number }> = [];
  if (context.activeProjects !== null) contextRows.push({ label: "Active Projects", value: context.activeProjects });
  if (context.knowledgeItems !== null) contextRows.push({ label: "Company Brain", value: context.knowledgeItems });
  if (context.openDecisions !== null) contextRows.push({ label: "Open Decisions", value: context.openDecisions });

  function toggleAgent(agentId: string, enabled: boolean) {
    setPendingId(agentId);
    startTransition(async () => {
      await setAgentEnabled({ companyId, agentKey: agentId, enabled: !enabled });
      router.refresh();
      setPendingId(null);
    });
  }

  return (
    <aside className="flex w-[300px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-[var(--border-subtle)] bg-[var(--background-secondary)] p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Context</span>
        <button type="button" onClick={onClose} className="ox-focus-ring text-[var(--text-muted)] hover:text-[var(--text-primary)] lg:hidden">
          <IconClose width={13} height={13} />
        </button>
      </div>

      <section className="flex flex-col gap-1.5">
        <h3 className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Current Context</h3>
        <div className="flex items-center justify-between rounded-[var(--radius-s)] px-2 py-1.5">
          <span className="text-[12px] text-[var(--text-secondary)]">Company</span>
          <span className="ox-pill ox-pill-success">{companyName}</span>
        </div>
        {contextRows.map((row) => (
          <div key={row.label} className="flex items-center justify-between rounded-[var(--radius-s)] px-2 py-1">
            <span className="text-[12px] text-[var(--text-secondary)]">{row.label}</span>
            <span className="num text-[12px] text-[var(--text-primary)]">{row.value}</span>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-1.5">
        <h3 className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">AI Agents</h3>
        {agents.length === 0 && <p className="px-0.5 text-[11.5px] text-[var(--text-muted)]">No agents configured.</p>}
        {agents.map((a) => {
          const isActive = activeAgentId === null || activeAgentId === a.agentId;
          const status = !a.enabled ? "Disabled" : isActive && isThinking ? "Working" : "Ready";
          const tone = !a.enabled ? "ox-pill-neutral" : status === "Working" ? "ox-pill-warning" : "ox-pill-success";
          return (
            <div key={a.agentId} className="flex items-center justify-between rounded-[var(--radius-s)] px-2 py-1.5">
              <div className="flex flex-col">
                <span className="text-[12px] text-[var(--text-secondary)]">{a.name}</span>
                <span className={`ox-pill ${tone} mt-0.5 w-fit`}>{status}</span>
              </div>
              {canManageAgents ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={a.enabled}
                  disabled={isPending && pendingId === a.agentId}
                  onClick={() => toggleAgent(a.agentId, a.enabled)}
                  title={a.enabled ? "Disable agent" : "Enable agent"}
                  className={`ox-focus-ring relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                    a.enabled ? "bg-[var(--success)]" : "bg-[var(--surface-raised)]"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-[var(--text-primary)] transition-transform ${
                      a.enabled ? "translate-x-[18px]" : "translate-x-0.5"
                    }`}
                  />
                </button>
              ) : null}
            </div>
          );
        })}
        <Link href={manageHref} className="ox-focus-ring self-start px-0.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          Manage Agents →
        </Link>
      </section>

      {recentActivity.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h3 className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Recent Activity</h3>
          <div className="flex flex-col gap-1">
            {recentActivity.map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-[var(--radius-s)] px-2 py-1 text-[11.5px] text-[var(--text-secondary)]">
                <IconClock width={11} height={11} className="shrink-0 text-[var(--text-muted)]" />
                <span className="flex-1 truncate">{r.toolName}</span>
                <span className="shrink-0 text-[10.5px] text-[var(--text-muted)]">{timeAgo(r.createdAt)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-1.5">
        <h3 className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Suggested</h3>
        <div className="flex flex-col gap-1">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSuggestion(s)}
              className="ox-focus-ring rounded-[var(--radius-s)] px-2 py-1.5 text-left text-[12px] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
            >
              {s}
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
