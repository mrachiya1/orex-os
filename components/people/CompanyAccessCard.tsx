"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteMember } from "@/app/actions/team";
import { Card, CardHeader } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export interface CompanyMembershipRow {
  id: string;
  companyName: string;
  companySlug: string;
  roleLabel: string;
  status: string;
}

export function CompanyAccessCard({
  memberships,
  orgRoleLabel,
  memberEmail,
  availableCompanies,
  roles,
  canManage,
}: {
  memberships: CompanyMembershipRow[];
  orgRoleLabel: string | null;
  memberEmail: string;
  availableCompanies: { id: string; name: string }[];
  roles: { id: string; label: string }[];
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader
        title="Company Access"
        action={
          canManage && (
            <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
              + Add Company Access
            </Button>
          )
        }
      />
      <div className="flex flex-col gap-2 px-5 pb-5">
        {orgRoleLabel && (
          <div className="flex items-center justify-between rounded-[var(--radius-m)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3.5 py-2.5">
            <span className="text-[12.5px] font-semibold text-[var(--text-primary)]">Orex Group (organisation-wide)</span>
            <span className="ox-pill ox-pill-neutral">{orgRoleLabel}</span>
          </div>
        )}
        {memberships.length === 0 && !orgRoleLabel ? (
          <p className="text-[12px] text-[var(--text-muted)]">No company access yet.</p>
        ) : (
          memberships.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-[var(--radius-m)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3.5 py-2.5">
              <span className="text-[12.5px] font-semibold text-[var(--text-primary)]">{m.companyName}</span>
              <div className="flex items-center gap-2">
                <span className="ox-pill ox-pill-neutral">{m.roleLabel}</span>
                <span className="ox-pill ox-pill-success">{m.status}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add company access">
        <AddAccessForm email={memberEmail} companies={availableCompanies} roles={roles} onDone={() => setOpen(false)} />
      </Modal>
    </Card>
  );
}

function AddAccessForm({
  email,
  companies,
  roles,
  onDone,
}: {
  email: string;
  companies: { id: string; name: string }[];
  roles: { id: string; label: string }[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await inviteMember({ companyId, roleId, email });
        router.refresh();
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to grant access");
      }
    });
  }

  if (companies.length === 0) {
    return <p className="text-[12px] text-[var(--text-muted)]">This person already has access to every company you can grant.</p>;
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-[11.5px] text-[var(--text-muted)]">
        Sends a new invitation to <span className="text-[var(--text-secondary)]">{email}</span> for the selected company. If they already have an
        Orex OS account, accepting it just adds this company&apos;s membership — no new account is created.
      </p>
      <div className="ox-field">
        <label className="ox-label">Company</label>
        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="ox-select">
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="ox-field">
        <label className="ox-label">Role</label>
        <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="ox-select">
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
      </div>
      {error && <p className="ox-error">{error}</p>}
      <Button type="submit" variant="primary" disabled={isPending} className="self-start">
        {isPending ? "Sending…" : "Send invitation"}
      </Button>
    </form>
  );
}
