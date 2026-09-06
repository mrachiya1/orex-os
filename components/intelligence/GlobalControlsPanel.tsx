"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateGlobalControls } from "@/app/actions/agents";
import { Button } from "@/components/ui/Button";
import type { GlobalAIControls } from "@/lib/ai/agents/global-controls";

const TOGGLES: Array<{ key: keyof GlobalAIControls; label: string; invert?: boolean }> = [
  { key: "paused", label: "Pause All Agents" },
  { key: "backgroundAgentsEnabled", label: "Background Agents" },
  { key: "scheduledAgentsEnabled", label: "Scheduled Agents" },
  { key: "autoSafeActionsEnabled", label: "Auto Safe Actions" },
];

export function GlobalControlsPanel({
  companyId,
  controls,
  canManage,
}: {
  companyId: string;
  controls: GlobalAIControls;
  canManage: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(key: keyof GlobalAIControls, current: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await updateGlobalControls({ companyId, [key]: !current });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Global AI</h3>
      {error && <p className="ox-error">{error}</p>}
      <div className="flex flex-col gap-1">
        {TOGGLES.map((t) => {
          const value = controls[t.key];
          return (
            <div key={t.key} className="flex items-center justify-between rounded-[var(--radius-s)] px-2 py-2 hover:bg-[var(--surface-2)]">
              <span className="text-[12.5px] text-[var(--text-secondary)]">{t.label}</span>
              {canManage ? (
                <Button
                  type="button"
                  variant={value ? (t.key === "paused" ? "danger" : "primary") : "secondary"}
                  size="sm"
                  disabled={isPending}
                  onClick={() => toggle(t.key, value)}
                >
                  {t.key === "paused" ? (value ? "Paused" : "Pause all") : value ? "On" : "Off"}
                </Button>
              ) : (
                <span className="ox-pill ox-pill-neutral">{value ? "On" : "Off"}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
