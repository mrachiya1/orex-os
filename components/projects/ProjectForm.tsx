"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "@/app/actions/projects";
import { Button } from "@/components/ui/Button";

export function ProjectForm({
  organisationId,
  companyId,
  companySlug,
  folderId,
}: {
  organisationId: string;
  companyId: string;
  companySlug: string;
  folderId?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [projectType, setProjectType] = useState("");
  const [clientDisplayName, setClientDisplayName] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await createProject({
          organisationId,
          companyId,
          folderId,
          name,
          projectCode,
          projectType,
          clientDisplayName: clientDisplayName || undefined,
          targetDate: targetDate || undefined,
        });
        router.push(`/${companySlug}/projects/${res.projectId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create project");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="ox-field">
        <label className="ox-label" htmlFor="proj-name">Name</label>
        <input id="proj-name" required value={name} onChange={(e) => setName(e.target.value)} className="ox-input" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="ox-field">
          <label className="ox-label" htmlFor="proj-code">Code</label>
          <input
            id="proj-code"
            required
            value={projectCode}
            onChange={(e) => setProjectCode(e.target.value)}
            placeholder="OS-2026-014"
            className="ox-input"
          />
        </div>
        <div className="ox-field">
          <label className="ox-label" htmlFor="proj-type">Type</label>
          <input
            id="proj-type"
            required
            value={projectType}
            onChange={(e) => setProjectType(e.target.value)}
            placeholder="3d_animation, website…"
            className="ox-input"
          />
        </div>
      </div>
      <div className="ox-field">
        <label className="ox-label" htmlFor="proj-client">Client (display)</label>
        <input
          id="proj-client"
          value={clientDisplayName}
          onChange={(e) => setClientDisplayName(e.target.value)}
          className="ox-input"
        />
      </div>
      <div className="ox-field">
        <label className="ox-label" htmlFor="proj-date">Target date</label>
        <input
          id="proj-date"
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          className="ox-input"
        />
      </div>
      {error && <p className="ox-error">{error}</p>}
      <Button type="submit" variant="primary" disabled={isPending} className="self-start">
        {isPending ? "Creating…" : "Create project"}
      </Button>
    </form>
  );
}
