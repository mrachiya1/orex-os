"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markDeliveryReady } from "@/app/actions/projects";
import { IconCheck } from "@/components/ui/icons";

export function MarkDeliveryReadyAction({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function go() {
    setError(null);
    startTransition(async () => {
      try {
        await markDeliveryReady({ projectId });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Not ready for delivery");
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={go}
        className="ox-focus-ring flex w-full items-center gap-2 rounded-[var(--radius-s)] border border-[var(--border-medium)] bg-[var(--accent)] px-3 py-2 text-[12px] font-semibold text-[var(--accent-foreground)] disabled:opacity-50"
      >
        <IconCheck width={12} height={12} />
        {isPending ? "Checking readiness…" : "Mark delivery ready"}
      </button>
      {error && <p className="ox-error mt-1.5">{error}</p>}
    </div>
  );
}
