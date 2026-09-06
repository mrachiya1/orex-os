"use client";

import { Button } from "@/components/ui/Button";

const RISK_TONE: Record<string, string> = {
  "Read Only": "ox-pill-neutral",
  Safe: "ox-pill-success",
  Important: "ox-pill-warning",
  Critical: "ox-pill-danger",
};

/**
 * Structured proposal card, styled like Project Detail's own card language
 * (prompts/015 Decisions #8/#18). Every field shown -- agent, tool, summary,
 * risk -- is real data returned by the Action Engine; nothing here is
 * synthesized per-request. "Edit" is intentionally omitted: rephrasing a
 * proposal isn't a trivial operation on the current single-tool flow, so
 * it's left out rather than half-built (disclosed as deferred).
 */
export function ActionProposalCard({
  agentName,
  toolName,
  summary,
  riskLabel,
  onApprove,
  onReject,
  disabled,
}: {
  agentName: string;
  toolName: string;
  summary: string;
  riskLabel: string | null;
  onApprove: () => void;
  onReject: () => void;
  disabled: boolean;
}) {
  return (
    <div className="max-w-xl rounded-[var(--radius-m)] border border-[var(--border-medium)] bg-[var(--surface-raised)] p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{agentName}</span>
        {riskLabel && <span className={`ox-pill ${RISK_TONE[riskLabel] ?? "ox-pill-neutral"}`}>{riskLabel}</span>}
      </div>
      <p className="mt-2 text-[10.5px] uppercase tracking-wide text-[var(--text-muted)]">{toolName}</p>
      <p className="mt-1 text-[13px] text-[var(--text-primary)]">{summary}</p>
      <div className="mt-3 flex gap-2">
        <Button type="button" variant="primary" size="sm" disabled={disabled} onClick={onApprove}>
          Confirm
        </Button>
        <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={onReject}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
