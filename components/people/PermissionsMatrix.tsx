import { IconCheck } from "@/components/ui/icons";
import type { CatalogPermission } from "@/lib/database/permissions-catalog";

export function PermissionsMatrix({
  permissions,
  granted,
}: {
  permissions: CatalogPermission[];
  granted: Set<string>;
}) {
  const byCategory = new Map<string, CatalogPermission[]>();
  for (const p of permissions) {
    const list = byCategory.get(p.category) ?? [];
    list.push(p);
    byCategory.set(p.category, list);
  }

  return (
    <div className="flex flex-col gap-4">
      {Array.from(byCategory.entries()).map(([category, items]) => (
        <div key={category}>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {category.replace(/_/g, " ")}
          </div>
          <div className="flex flex-col gap-1">
            {items.map((p) => {
              const has = granted.has(p.key);
              return (
                <div key={p.key} className="flex items-center justify-between rounded-[var(--radius-s)] px-2 py-1.5 hover:bg-[var(--surface-2)]">
                  <span className="text-[12px] text-[var(--text-secondary)]">{p.label}</span>
                  <span
                    className={`grid h-4 w-4 place-items-center rounded-[4px] border ${
                      has ? "border-[var(--success)] bg-[var(--success-dim)] text-[var(--success)]" : "border-[var(--border-medium)]"
                    }`}
                  >
                    {has && <IconCheck width={10} height={10} />}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
