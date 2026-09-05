"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createKnowledgeItem } from "@/app/actions/knowledge";

const ITEM_TYPES = [
  "fact", "document", "vision", "mission", "goal", "service", "strategy",
  "rule", "policy", "process", "sop", "lesson", "win", "failure", "research",
];

export function KnowledgeForm({
  organisationId,
  companyId,
  domain,
  canVerify,
}: {
  organisationId: string;
  companyId: string | null;
  domain: string;
  canVerify: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [itemType, setItemType] = useState("fact");
  const [classification, setClassification] = useState("internal");
  const [markVerified, setMarkVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createKnowledgeItem({
          organisationId,
          companyId,
          domain,
          itemType,
          title,
          content,
          classification,
          markVerified,
        });
        setTitle("");
        setContent("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create knowledge item");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-4">
      <input
        required
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
      />
      <textarea
        required
        placeholder="Content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={itemType}
          onChange={(e) => setItemType(e.target.value)}
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
        >
          {ITEM_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={classification}
          onChange={(e) => setClassification(e.target.value)}
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
        >
          {["public", "internal", "confidential", "restricted"].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {canVerify && (
          <label className="flex items-center gap-1 text-xs text-[var(--muted)]">
            <input
              type="checkbox"
              checked={markVerified}
              onChange={(e) => setMarkVerified(e.target.checked)}
            />
            Mark verified immediately
          </label>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-black disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Add knowledge"}
        </button>
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
    </form>
  );
}
