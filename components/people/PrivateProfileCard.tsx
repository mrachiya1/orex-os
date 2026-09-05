"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMyPrivateProfile } from "@/app/actions/people";
import { Card, CardHeader } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";

export interface PrivateProfileData {
  personal_email: string | null;
  personal_phone: string | null;
  birthday: string | null;
  address: string | null;
  private_notes: string | null;
}

/**
 * Rendered ONLY for the current authenticated user viewing their own
 * profile -- the page decides that, and RLS backs it up independently:
 * updateMyPrivateProfile() has no userId parameter at all, it always
 * writes to auth.uid()'s own row.
 */
export function PrivateProfileCard({ initial }: { initial: PrivateProfileData | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(initial?.personal_email ?? "");
  const [phone, setPhone] = useState(initial?.personal_phone ?? "");
  const [birthday, setBirthday] = useState(initial?.birthday ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [notes, setNotes] = useState(initial?.private_notes ?? "");
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await updateMyPrivateProfile({
        personalEmail: email || null,
        personalPhone: phone || null,
        birthday: birthday || null,
        address: address || null,
        privateNotes: notes || null,
      });
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader
        title="Private Profile"
        action={
          <button type="button" onClick={() => setEditing((v) => !v)} className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            {editing ? "Cancel" : "Edit"}
          </button>
        }
      />
      <div className="flex flex-col gap-3 px-5 pb-5">
        <p className="text-[11px] text-[var(--text-muted)]">
          Only visible to you. Your company and Founder access never grants anyone else a way to read this.
        </p>
        {!editing ? (
          <>
            <Field label="Personal email" value={initial?.personal_email ?? "—"} />
            <Field label="Personal phone" value={initial?.personal_phone ?? "—"} />
            <Field label="Birthday" value={initial?.birthday ?? "—"} />
            <Field label="Address" value={initial?.address ?? "—"} />
            <Field label="Private notes" value={initial?.private_notes ?? "—"} />
          </>
        ) : (
          <>
            <div className="ox-field"><label className="ox-label">Personal email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="ox-input" /></div>
            <div className="ox-field"><label className="ox-label">Personal phone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} className="ox-input" /></div>
            <div className="ox-field"><label className="ox-label">Birthday</label><input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className="ox-input" /></div>
            <div className="ox-field"><label className="ox-label">Address</label><input value={address} onChange={(e) => setAddress(e.target.value)} className="ox-input" /></div>
            <div className="ox-field"><label className="ox-label">Private notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="ox-textarea" /></div>
            <Button variant="primary" size="sm" disabled={isPending} onClick={save} className="self-start">
              {isPending ? "Saving…" : "Save"}
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="text-[var(--text-secondary)]">{value}</span>
    </div>
  );
}
