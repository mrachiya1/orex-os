"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createIssue, resolveIssue } from "@/app/actions/clients";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { IconPlus } from "@/components/ui/icons";

export function AddIssueButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("misunderstanding");
  const [severity, setSeverity] = useState("medium");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createIssue({ clientId, type, severity, reason });
        setReason("");
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to record issue");
      }
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <IconPlus width={12} height={12} /> Record Issue
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Record relationship issue">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="ox-field">
            <label className="ox-label" htmlFor="issue-type">Type</label>
            <select id="issue-type" value={type} onChange={(e) => setType(e.target.value)} className="ox-select">
              <option value="misunderstanding">Misunderstanding</option>
              <option value="scope_conflict">Scope Conflict</option>
              <option value="communication_delay">Communication Delay</option>
              <option value="delivery_concern">Delivery Concern</option>
              <option value="payment_concern">Payment Concern</option>
            </select>
          </div>
          <div className="ox-field">
            <label className="ox-label" htmlFor="issue-severity">Severity</label>
            <select id="issue-severity" value={severity} onChange={(e) => setSeverity(e.target.value)} className="ox-select">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="ox-field">
            <label className="ox-label" htmlFor="issue-reason">What happened</label>
            <textarea id="issue-reason" required value={reason} onChange={(e) => setReason(e.target.value)} className="ox-textarea" />
          </div>
          {error && <p className="ox-error">{error}</p>}
          <Button type="submit" variant="primary" disabled={isPending} className="self-start">
            {isPending ? "Recording…" : "Record issue"}
          </Button>
        </form>
      </Modal>
    </>
  );
}

export function ResolveIssueButton({ issueId }: { issueId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await resolveIssue({ issueId, resolution });
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to resolve issue");
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="ox-focus-ring text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
        Resolve
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Resolve issue">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="ox-field">
            <label className="ox-label" htmlFor="resolve-resolution">Resolution</label>
            <textarea id="resolve-resolution" required value={resolution} onChange={(e) => setResolution(e.target.value)} className="ox-textarea" />
          </div>
          {error && <p className="ox-error">{error}</p>}
          <Button type="submit" variant="primary" disabled={isPending} className="self-start">
            {isPending ? "Resolving…" : "Mark resolved"}
          </Button>
        </form>
      </Modal>
    </>
  );
}
