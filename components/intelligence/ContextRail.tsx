"use client";

import Link from "next/link";
import { IconClose } from "@/components/ui/icons";
import type { IntelligenceContextSummary } from "@/lib/intelligence/context";
import type { SelectableAgent } from "./AgentSelector";

const SUGGESTIONS = ["What needs my attention?", "Prepare tomorrow", "Review active projects", "What decisions need me?"];

/**
 * Maximum three compact sections (prompts/015 Decisions #7): Current
 * Context, Active AI, Suggested. No metric dashboards, no fabricated
 * numbers -- every count in `context` was already permission-gated by the
 * server and is `null` (omitted) rather than guessed when unavailable.
 */
export function ContextRail({
  companyName,
  context,
  agents,
  activeAgentId,
  isThinking,
  manageHref,
  open,
  onClose,
  onSuggestion,
}: {
  companyName: string;
  context: IntelligenceContextSummary;
  agents: SelectableAgent[];
  activeAgentId: string | null;
  isThinking: boolean;
  manageHref: string;
  open: boolean;
  onClose: () => void;
  onSuggestion: (text: string) => void;
}) {
  if (!open) return null;

  const contextRows: Array<{ label: string; value: number }> = [];
  if (context.activeProjects !== null) contextRows.push({ label: "Active Projects", value: context.activeProjects });
  if (context.knowledgeItems !== null) contextRows.push({ label: "Company Brain", value: context.knowledgeItems });
  if (context.openDecisions !== null) contextRows.push({ label: "Open Decisions", value: context.openDecisions });

  return (
    <aside className="flex w-[300px] shrink-0 flex-col gap-4 border-l border-[var(--border-subtle)] bg-[var(--background-secondary)] p-4">
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
        <h3 className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Active AI</h3>
        {agents.length === 0 && <p className="px-0.5 text-[11.5px] text-[var(--text-muted)]">No agents configured.</p>}
        {agents.map((a) => {
          const isActive = activeAgentId === null || activeAgentId === a.agentId;
          const status = !a.enabled ? "Disabled" : isActive && isThinking ? "Working" : "Ready";
          const tone = !a.enabled ? "ox-pill-neutral" : status === "Working" ? "ox-pill-warning" : "ox-pill-success";
          return (
            <div key={a.agentId} className="flex items-center justify-between rounded-[var(--radius-s)] px-2 py-1">
              <span className="text-[12px] text-[var(--text-secondary)]">{a.name}</span>
              <span className={`ox-pill ${tone}`}>{status}</span>
            </div>
          );
        })}
        <Link href={manageHref} className="ox-focus-ring self-start px-0.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          Manage Agents →
        </Link>
      </section>

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
