"use client";

import { IconCheck } from "@/components/ui/icons";
import type { CatalogPermission } from "@/lib/database/permissions-catalog";

/**
 * Checkboxes seeded from a role's default permission set; `overrides` only
 * ever holds keys that differ from that default (checked box ==
 * roleDefaults XOR overrides[key]). Keeping overrides role-relative (rather
 * than an absolute copy of every permission) means a later role change
 * still cascades naturally for everything the actor didn't explicitly
 * customize.
 */
export function EditablePermissionsMatrix({
  permissions,
  roleDefaults,
  overrides,
  onChange,
  disabledKeys,
}: {
  permissions: CatalogPermission[];
  roleDefaults: Set<string>;
  overrides: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
  /** Keys the current actor cannot grant (they don't hold them) -- shown but not checkable into "on". */
  disabledKeys?: Set<string>;
}) {
  const byCategory = new Map<string, CatalogPermission[]>();
  for (const p of permissions) {
    const list = byCategory.get(p.category) ?? [];
    list.push(p);
    byCategory.set(p.category, list);
  }

  function effective(key: string): boolean {
    return key in overrides ? overrides[key] : roleDefaults.has(key);
  }

  function toggle(key: string) {
    const roleDefault = roleDefaults.has(key);
    const next = !effective(key);
    const nextOverrides = { ...overrides };
    if (next === roleDefault) {
      delete nextOverrides[key];
    } else {
      nextOverrides[key] = next;
    }
    onChange(nextOverrides);
  }

  return (
    <div className="flex max-h-96 flex-col gap-3 overflow-y-auto">
      {Array.from(byCategory.entries()).map(([category, items]) => (
        <div key={category}>
          <div className="mb-1 text-[9.5px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {category.replace(/_/g, " ")}
          </div>
          <div className="flex flex-col">
            {items.map((p) => {
              const has = effective(p.key);
              const isOverride = p.key in overrides;
              const cannotGrant = !has && disabledKeys?.has(p.key);
              return (
                <button
                  type="button"
                  key={p.key}
                  disabled={cannotGrant}
                  onClick={() => toggle(p.key)}
                  className="ox-focus-ring flex items-center justify-between rounded-[var(--radius-s)] px-2 py-1.5 text-left hover:bg-[var(--surface-2)] disabled:opacity-40"
                >
                  <span className="text-[11.5px] text-[var(--text-secondary)]">
                    {p.label}
                    {isOverride && <span className="ml-1.5 text-[9px] uppercase text-[var(--info)]">custom</span>}
                  </span>
                  <span
                    className={`grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border ${
                      has ? "border-[var(--success)] bg-[var(--success-dim)] text-[var(--success)]" : "border-[var(--border-medium)]"
                    }`}
                  >
                    {has && <IconCheck width={10} height={10} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
