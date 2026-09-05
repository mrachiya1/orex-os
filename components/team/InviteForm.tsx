"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { inviteMember } from "@/app/actions/team";
import {
  listAllPermissionsAction,
  getRolePermissionKeysAction,
  listMyEffectivePermissionKeysAction,
} from "@/app/actions/people";
import { Button } from "@/components/ui/Button";
import { EditablePermissionsMatrix } from "@/components/people/EditablePermissionsMatrix";
import type { CatalogPermission } from "@/lib/database/permissions-catalog";

export function InviteForm({
  companyId,
  roles,
  onDone,
}: {
  companyId: string;
  roles: { id: string; label: string }[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ inviteUrl: string; emailSent: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  const [customizing, setCustomizing] = useState(false);
  const [allPermissions, setAllPermissions] = useState<CatalogPermission[]>([]);
  const [roleDefaults, setRoleDefaults] = useState<Set<string>>(new Set());
  const [myPermissions, setMyPermissions] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!customizing) return;
    listAllPermissionsAction().then(setAllPermissions);
    listMyEffectivePermissionKeysAction(companyId).then((keys) => setMyPermissions(new Set(keys)));
  }, [customizing, companyId]);

  useEffect(() => {
    if (!customizing || !roleId) return;
    getRolePermissionKeysAction(roleId).then((keys) => setRoleDefaults(new Set(keys)));
  }, [customizing, roleId]);

  function handleRoleChange(nextRoleId: string) {
    setRoleId(nextRoleId);
    setOverrides({});
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const res = await inviteMember({
          companyId,
          roleId,
          email,
          permissionOverrides: Object.keys(overrides).length > 0 ? overrides : undefined,
        });
        setResult({ inviteUrl: res.inviteUrl, emailSent: res.emailSent });
        setEmail("");
        setOverrides({});
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to invite");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="ox-field">
        <label className="ox-label" htmlFor="invite-email">Email</label>
        <input
          id="invite-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="ox-input"
          placeholder="name@company.com"
        />
      </div>
      <div className="ox-field">
        <label className="ox-label" htmlFor="invite-role">Role</label>
        <select id="invite-role" value={roleId} onChange={(e) => handleRoleChange(e.target.value)} className="ox-select">
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {!result && (
        <div className="ox-field">
          <button
            type="button"
            onClick={() => setCustomizing((v) => !v)}
            className="ox-focus-ring self-start text-[11.5px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            {customizing ? "Hide" : "Optional: customize permissions"}
          </button>
          {customizing && (
            <div className="mt-1 rounded-[var(--radius-m)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3">
              <p className="mb-2 text-[10.5px] text-[var(--text-muted)]">
                Starts from {roles.find((r) => r.id === roleId)?.label ?? "this role"}&apos;s defaults. Toggle any permission on or off just for
                this person — you can only turn on what you yourself have.
              </p>
              <EditablePermissionsMatrix
                permissions={allPermissions}
                roleDefaults={roleDefaults}
                overrides={overrides}
                onChange={setOverrides}
                disabledKeys={
                  new Set(allPermissions.map((p) => p.key).filter((k) => !myPermissions.has(k)))
                }
              />
            </div>
          )}
        </div>
      )}

      {error && <p className="ox-error">{error}</p>}
      {result ? (
        <div className="ox-field">
          <p className="text-[12px] text-[var(--success)]">
            Invitation created{result.emailSent ? " and emailed" : ""}.
          </p>
          <p className="ox-help break-all font-mono">{result.inviteUrl}</p>
          <Button type="button" variant="secondary" className="mt-1 self-start" onClick={onDone}>
            Done
          </Button>
        </div>
      ) : (
        <Button type="submit" variant="primary" disabled={isPending} className="self-start">
          {isPending ? "Inviting…" : "Send invitation"}
        </Button>
      )}
    </form>
  );
}
