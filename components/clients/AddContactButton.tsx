"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createContact } from "@/app/actions/clients";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { IconPlus } from "@/components/ui/icons";

export function AddContactButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [isPrimaryContact, setIsPrimaryContact] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createContact({
          clientId,
          firstName,
          lastName: lastName || undefined,
          jobTitle: jobTitle || undefined,
          businessEmail: businessEmail || undefined,
          isPrimaryContact,
        });
        setFirstName("");
        setLastName("");
        setJobTitle("");
        setBusinessEmail("");
        setIsPrimaryContact(false);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add contact");
      }
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <IconPlus width={12} height={12} /> Add Contact
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add contact">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="ox-field">
            <label className="ox-label" htmlFor="contact-first-name">First name</label>
            <input id="contact-first-name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="ox-input" />
          </div>
          <div className="ox-field">
            <label className="ox-label" htmlFor="contact-last-name">Last name</label>
            <input id="contact-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="ox-input" />
          </div>
          <div className="ox-field">
            <label className="ox-label" htmlFor="contact-job-title">Job title</label>
            <input id="contact-job-title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="ox-input" />
          </div>
          <div className="ox-field">
            <label className="ox-label" htmlFor="contact-email">Business email</label>
            <input id="contact-email" type="email" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} className="ox-input" />
          </div>
          <label className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
            <input type="checkbox" checked={isPrimaryContact} onChange={(e) => setIsPrimaryContact(e.target.checked)} />
            Primary contact
          </label>
          {error && <p className="ox-error">{error}</p>}
          <Button type="submit" variant="primary" disabled={isPending} className="self-start">
            {isPending ? "Adding…" : "Add contact"}
          </Button>
        </form>
      </Modal>
    </>
  );
}
