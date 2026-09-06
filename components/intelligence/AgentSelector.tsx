"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { IconChevronDown, IconSparkle, IconCheck } from "@/components/ui/icons";

export interface SelectableAgent {
  agentId: string;
  name: string;
  enabled: boolean;
  description?: string;
}

/**
 * "AUTO" is a real routing abstraction, not hard-coded display text
 * (prompts/015 Decisions #2): it always resolves to whichever enabled
 * agent(s) the caller passes in via `resolveAuto`. Today that list has one
 * member (Founder Advisor), so AUTO and it are equivalent -- multi-agent
 * routing slots in later by changing `resolveAuto` alone, no UI rework.
 * Disabled agents are shown, never hidden, but cannot be selected. No
 * agent that doesn't exist in `agents` is ever fabricated here.
 */
export function AgentSelector({
  agents,
  selectedAgentId,
  onSelect,
  manageHref,
}: {
  agents: SelectableAgent[];
  selectedAgentId: string | null;
  onSelect: (agentId: string | null) => void;
  manageHref: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const selected = agents.find((a) => a.agentId === selectedAgentId);
  const label = selectedAgentId === null ? "AUTO" : (selected?.name ?? "AUTO");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ox-focus-ring flex items-center gap-1.5 rounded-[var(--radius-s)] border border-[var(--border-medium)] bg-[var(--surface-raised)] px-2.5 py-1 text-[11.5px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        <IconSparkle width={12} height={12} />
        <span className="font-medium">{label}</span>
        <IconChevronDown width={11} height={11} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-[var(--radius-m)] border border-[var(--border-medium)] bg-[var(--surface-1)] p-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setOpen(false);
            }}
            className="ox-focus-ring flex w-full items-center justify-between gap-2 rounded-[var(--radius-s)] px-2.5 py-1.5 text-left text-[12px] text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
          >
            <span>
              <span className="block font-medium">AUTO</span>
              <span className="block text-[10.5px] text-[var(--text-muted)]">Orex chooses the best enabled specialist</span>
            </span>
            {selectedAgentId === null && <IconCheck width={13} height={13} />}
          </button>
          <div className="my-1 border-t border-[var(--border-subtle)]" />
          {agents.map((a) => (
            <button
              key={a.agentId}
              type="button"
              disabled={!a.enabled}
              onClick={() => {
                if (!a.enabled) return;
                onSelect(a.agentId);
                setOpen(false);
              }}
              className="ox-focus-ring flex w-full items-center justify-between gap-2 rounded-[var(--radius-s)] px-2.5 py-1.5 text-left text-[12px] text-[var(--text-primary)] hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:text-[var(--text-muted)] disabled:hover:bg-transparent"
            >
              <span>{a.name}</span>
              {!a.enabled ? (
                <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Disabled</span>
              ) : (
                selectedAgentId === a.agentId && <IconCheck width={13} height={13} />
              )}
            </button>
          ))}
          <div className="my-1 border-t border-[var(--border-subtle)]" />
          <Link
            href={manageHref}
            className="ox-focus-ring block rounded-[var(--radius-s)] px-2.5 py-1.5 text-[11.5px] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
          >
            Manage Agents →
          </Link>
        </div>
      )}
    </div>
  );
}
