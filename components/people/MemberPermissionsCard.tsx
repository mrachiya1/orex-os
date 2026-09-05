"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMemberPermissionOverrides } from "@/app/actions/team";
import { listMyEffectivePermissionKeysAction } from "@/app/actions/people";
import { Card, CardHeader } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { PermissionsMatrix } from "@/components/people/PermissionsMatrix";
import { EditablePermissionsMatrix } from "@/components/people/EditablePermissionsMatrix";
import type { CatalogPermission } from "@/lib/database/permissions-catalog";

export function MemberPermissionsCard({
  companyId,
  membershipId,
  allPermissions,
  roleDefaults,
  savedOverrides,
  canManage,
}: {
  companyId: string;
  membershipId: string;
  allPermissions: CatalogPermission[];
  roleDefaults: Set<string>;
  savedOverrides: Record<string, boolean>;
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, boolean>>(savedOverrides);
  const [myPermissions, setMyPermissions] = useState<Set<string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const effectiveGranted = new Set(
    allPermissions.map((p) => p.key).filter((key) => (key in savedOverrides ? savedOverrides[key] : roleDefaults.has(key)))
  );

  function startEditing() {
    setOverrides(savedOverrides);
    setEditing(true);
    if (!myPermissions) {
      listMyEffectivePermissionKeysAction(companyId).then((keys) => setMyPermissions(new Set(keys)));
    }
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updateMemberPermissionOverrides({ companyId, membershipId, permissionOverrides: overrides });
        setEditing(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update permissions");
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title="Permissions"
        action={
          canManage && (
            <button
              type="button"
              onClick={() => (editing ? setEditing(false) : startEditing())}
              className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              {editing ? "Cancel" : "Edit"}
            </button>
          )
        }
      />
      <div className="px-5 pb-5">
        {allPermissions.length === 0 ? (
          <p className="text-[12px] text-[var(--text-muted)]">No active role in this company.</p>
        ) : editing ? (
          <>
            <p className="mb-2 text-[10.5px] text-[var(--text-muted)]">
              Custom overrides relative to this person&apos;s role. You can only turn on a permission you hold yourself.
            </p>
            <EditablePermissionsMatrix
              permissions={allPermissions}
              roleDefaults={roleDefaults}
              overrides={overrides}
              onChange={setOverrides}
              disabledKeys={myPermissions ? new Set(allPermissions.map((p) => p.key).filter((k) => !myPermissions.has(k))) : undefined}
            />
            {error && <p className="ox-error mt-2">{error}</p>}
            <Button variant="primary" size="sm" disabled={isPending} onClick={save} className="mt-3">
              {isPending ? "Saving…" : "Save"}
            </Button>
          </>
        ) : (
          <PermissionsMatrix permissions={allPermissions} granted={effectiveGranted} />
        )}
      </div>
    </Card>
  );
}
