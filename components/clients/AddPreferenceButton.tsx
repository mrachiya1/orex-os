"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPreference } from "@/app/actions/clients";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { IconPlus } from "@/components/ui/icons";

export function AddPreferenceButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [statement, setStatement] = useState("");
  const [sentiment, setSentiment] = useState("preference");
  const [category, setCategory] = useState("general");
  const [origin, setOrigin] = useState("human");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createPreference({ clientId, statement, sentiment, category, origin });
        setStatement("");
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add preference");
      }
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <IconPlus width={12} height={12} /> Add Preference
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add preference">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="ox-field">
            <label className="ox-label" htmlFor="pref-statement">Statement</label>
            <textarea id="pref-statement" required value={statement} onChange={(e) => setStatement(e.target.value)} className="ox-textarea" placeholder="Prefers concise weekly updates" />
          </div>
          <div className="ox-field">
            <label className="ox-label" htmlFor="pref-sentiment">Sentiment</label>
            <select id="pref-sentiment" value={sentiment} onChange={(e) => setSentiment(e.target.value)} className="ox-select">
              <option value="like">Like</option>
              <option value="dislike">Dislike</option>
              <option value="preference">Preference</option>
              <option value="avoid">Avoid</option>
            </select>
          </div>
          <div className="ox-field">
            <label className="ox-label" htmlFor="pref-category">Category</label>
            <select id="pref-category" value={category} onChange={(e) => setCategory(e.target.value)} className="ox-select">
              <option value="communication">Communication</option>
              <option value="creative">Creative</option>
              <option value="delivery">Delivery</option>
              <option value="process">Process</option>
              <option value="meeting">Meeting</option>
              <option value="presentation">Presentation</option>
              <option value="general">General</option>
            </select>
          </div>
          <div className="ox-field">
            <label className="ox-label" htmlFor="pref-origin">Where did this come from?</label>
            <select id="pref-origin" value={origin} onChange={(e) => setOrigin(e.target.value)} className="ox-select">
              <option value="client_direct">Client said this directly (marks as Verified)</option>
              <option value="human">Team observation</option>
              <option value="project">Observed during a project</option>
              <option value="meeting">Observed during a meeting</option>
            </select>
          </div>
          {error && <p className="ox-error">{error}</p>}
          <Button type="submit" variant="primary" disabled={isPending} className="self-start">
            {isPending ? "Adding…" : "Add preference"}
          </Button>
        </form>
      </Modal>
    </>
  );
}
