"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCredential } from "@/app/actions/clients";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { IconPlus } from "@/components/ui/icons";

export function AddCredentialButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [credentialType, setCredentialType] = useState("website_login");
  const [provider, setProvider] = useState("");
  const [usernameHint, setUsernameHint] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createCredential({ clientId, label, credentialType, provider: provider || undefined, usernameHint: usernameHint || undefined });
        setLabel("");
        setProvider("");
        setUsernameHint("");
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add credential reference");
      }
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <IconPlus width={12} height={12} /> Add Credential Reference
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add credential reference">
        <p className="ox-help mb-3">
          This stores metadata only (label, type, provider, username hint) -- never a password, API key, or
          access token. Secure credential storage is not configured yet.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="ox-field">
            <label className="ox-label" htmlFor="cred-label">Label</label>
            <input id="cred-label" required value={label} onChange={(e) => setLabel(e.target.value)} className="ox-input" placeholder="WordPress admin" />
          </div>
          <div className="ox-field">
            <label className="ox-label" htmlFor="cred-type">Type</label>
            <select id="cred-type" value={credentialType} onChange={(e) => setCredentialType(e.target.value)} className="ox-select">
              <option value="website_login">Website Login</option>
              <option value="hosting">Hosting</option>
              <option value="social_media">Social Media</option>
              <option value="server">Server</option>
              <option value="dns">DNS</option>
              <option value="email">Email</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="ox-field">
            <label className="ox-label" htmlFor="cred-provider">Provider (optional)</label>
            <input id="cred-provider" value={provider} onChange={(e) => setProvider(e.target.value)} className="ox-input" placeholder="GoDaddy, AWS, Instagram…" />
          </div>
          <div className="ox-field">
            <label className="ox-label" htmlFor="cred-username">Username hint (optional)</label>
            <input id="cred-username" value={usernameHint} onChange={(e) => setUsernameHint(e.target.value)} className="ox-input" />
          </div>
          {error && <p className="ox-error">{error}</p>}
          <Button type="submit" variant="primary" disabled={isPending} className="self-start">
            {isPending ? "Adding…" : "Add reference"}
          </Button>
        </form>
      </Modal>
    </>
  );
}
