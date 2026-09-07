"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { linkProjectToClient } from "@/app/actions/clients";
import { Button } from "@/components/ui/Button";

export function LinkProjectForm({
  clientId,
  candidateProjects,
}: {
  clientId: string;
  candidateProjects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(candidateProjects[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (candidateProjects.length === 0) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await linkProjectToClient({ projectId, clientId, clientBrandId: null, primaryClientContactId: null });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to link project");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div className="ox-field flex-1">
        <label className="ox-label" htmlFor="link-project">Link an existing project</label>
        <select id="link-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="ox-select">
          {candidateProjects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="secondary" disabled={isPending}>
        {isPending ? "Linking…" : "Link"}
      </Button>
      {error && <p className="ox-error">{error}</p>}
    </form>
  );
}
