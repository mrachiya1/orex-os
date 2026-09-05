"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { extractCandidatesFromText } from "@/app/actions/knowledge";

export function PasteTextIngestForm({
  organisationId,
  companyId,
  domain,
}: {
  organisationId: string;
  companyId: string | null;
  domain: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const res = await extractCandidatesFromText({
          organisationId,
          companyId,
          domain,
          classification: "internal",
          pastedText: text,
        });
        setResult(res.knowledgeItemIds.length);
        setText("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to extract candidates");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 border-t border-[var(--border)] p-4">
      <p className="text-xs text-[var(--muted)]">
        Paste text and AI will propose candidate facts — unverified until a Director/Founder reviews them.
      </p>
      <textarea
        required
        placeholder="Paste text (e.g. a draft SOP, notes, a policy)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
      />
      <div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md border border-[var(--border)] px-4 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {isPending ? "Extracting..." : "Extract candidate facts"}
        </button>
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {result !== null && (
        <p className="text-sm text-[var(--success)]">
          {result} candidate item{result === 1 ? "" : "s"} created — pending verification.
        </p>
      )}
    </form>
  );
}
