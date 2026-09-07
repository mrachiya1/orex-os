"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFeedback } from "@/app/actions/clients";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { IconPlus } from "@/components/ui/icons";

export function AddFeedbackButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [sentiment, setSentiment] = useState("positive");
  const [feedbackType, setFeedbackType] = useState("positive");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createFeedback({ clientId, content, sentiment, feedbackType });
        setContent("");
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to record feedback");
      }
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <IconPlus width={12} height={12} /> Record Feedback
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Record feedback">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="ox-field">
            <label className="ox-label" htmlFor="fb-content">What happened</label>
            <textarea id="fb-content" required value={content} onChange={(e) => setContent(e.target.value)} className="ox-textarea" />
          </div>
          <div className="ox-field">
            <label className="ox-label" htmlFor="fb-sentiment">Sentiment</label>
            <select id="fb-sentiment" value={sentiment} onChange={(e) => setSentiment(e.target.value)} className="ox-select">
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </div>
          <div className="ox-field">
            <label className="ox-label" htmlFor="fb-type">Type</label>
            <select id="fb-type" value={feedbackType} onChange={(e) => setFeedbackType(e.target.value)} className="ox-select">
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="concern">Concern</option>
              <option value="disappointment">Disappointment</option>
              <option value="misunderstanding">Misunderstanding</option>
              <option value="scope_issue">Scope Issue</option>
              <option value="communication_issue">Communication Issue</option>
              <option value="delivery_issue">Delivery Issue</option>
            </select>
          </div>
          {error && <p className="ox-error">{error}</p>}
          <Button type="submit" variant="primary" disabled={isPending} className="self-start">
            {isPending ? "Recording…" : "Record feedback"}
          </Button>
        </form>
      </Modal>
    </>
  );
}
