"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAgentEnabled, setAgentMode } from "@/app/actions/agents";
import { Card, CardHeader } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";

export interface AgentCardAgent {
  agentId: string;
  name: string;
  description: string;
  enabled: boolean;
  mode: "OFF" | "MANUAL" | "SCHEDULED" | "AUTO_SAFE";
  autonomyMode: string;
  maxRiskLevel: number;
}

const MODES = ["OFF", "MANUAL", "SCHEDULED", "AUTO_SAFE"] as const;

export function AgentCard({
  companyId,
  agent,
  spend,
  canManage,
}: {
  companyId: string;
  agent: AgentCardAgent;
  spend: { today: number; month: number };
  canManage: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleEnabled() {
    setError(null);
    startTransition(async () => {
      const result = await setAgentEnabled({ companyId, agentKey: agent.agentId, enabled: !agent.enabled });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function changeMode(mode: string) {
    setError(null);
    startTransition(async () => {
      const result = await setAgentMode({ companyId, agentKey: agent.agentId, mode });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader
        title={agent.name}
        action={
          <span className={`ox-pill ${agent.enabled ? "ox-pill-success" : "ox-pill-neutral"}`}>
            {agent.enabled ? "Enabled" : "Disabled"}
          </span>
        }
      />
      <div className="flex flex-col gap-3 px-1 py-1">
        <p className="text-[12px] text-[var(--text-muted)]">{agent.description}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-muted)]">
          <span>Mode: <span className="text-[var(--text-secondary)]">{agent.mode}</span></span>
          <span>Autonomy: <span className="text-[var(--text-secondary)]">{agent.autonomyMode}</span></span>
          <span>Max risk: <span className="text-[var(--text-secondary)]">{agent.maxRiskLevel}</span></span>
        </div>
        <div className="flex gap-4 text-[11px] text-[var(--text-muted)]">
          <span>Today: <span className="text-[var(--text-secondary)]">${spend.today.toFixed(4)}</span></span>
          <span>Month: <span className="text-[var(--text-secondary)]">${spend.month.toFixed(4)}</span></span>
        </div>
        {error && <p className="ox-error">{error}</p>}
        {canManage && (
          <div className="flex items-center gap-2">
            <Button type="button" variant={agent.enabled ? "secondary" : "primary"} size="sm" disabled={isPending} onClick={toggleEnabled}>
              {agent.enabled ? "Disable" : "Enable"}
            </Button>
            <select
              value={agent.mode}
              disabled={isPending || !agent.enabled}
              onChange={(e) => changeMode(e.target.value)}
              className="ox-input h-8 py-0 text-[11.5px]"
            >
              {MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </Card>
  );
}
