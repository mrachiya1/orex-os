"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/actions/clients";
import { Button } from "@/components/ui/Button";

export function CreateClientForm({
  organisationId,
  companyId,
  onDone,
}: {
  organisationId: string;
  companyId: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [status, setStatus] = useState("lead");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createClient({
          organisationId,
          companyId,
          name,
          status,
          website: website || undefined,
          industry: industry || undefined,
        });
        router.refresh();
        onDone?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create client");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="ox-field">
        <label className="ox-label" htmlFor="client-name">Client / company name</label>
        <input
          id="client-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="ox-input"
          placeholder="Nova Labs"
        />
      </div>
      <div className="ox-field">
        <label className="ox-label" htmlFor="client-status">Status</label>
        <select id="client-status" value={status} onChange={(e) => setStatus(e.target.value)} className="ox-select">
          <option value="lead">Lead</option>
          <option value="negotiating">Negotiating</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <div className="ox-field">
        <label className="ox-label" htmlFor="client-industry">Industry (optional)</label>
        <input id="client-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} className="ox-input" />
      </div>
      <div className="ox-field">
        <label className="ox-label" htmlFor="client-website">Website (optional)</label>
        <input id="client-website" value={website} onChange={(e) => setWebsite(e.target.value)} className="ox-input" placeholder="https://" />
      </div>
      {error && <p className="ox-error">{error}</p>}
      <Button type="submit" variant="primary" disabled={isPending} className="self-start">
        {isPending ? "Creating…" : "Create client"}
      </Button>
    </form>
  );
}
