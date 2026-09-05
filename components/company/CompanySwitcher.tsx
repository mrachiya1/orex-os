"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { companyAccent } from "@/lib/theme/company-accent";
import { IconChevronDown } from "@/components/ui/icons";

export interface SwitcherCompany {
  id: string;
  name: string;
  slug: string;
  accent_color_key: string;
}

export function CompanySwitcher({
  companies,
  activeSlug,
}: {
  companies: SwitcherCompany[];
  activeSlug?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = companies.find((c) => c.slug === activeSlug) ?? companies[0] ?? null;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (companies.length === 0) {
    return <p className="px-2 text-[12px] text-[var(--text-muted)]">No companies yet</p>;
  }

  const otherNames = companies.filter((c) => c.id !== active?.id).map((c) => c.name);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ox-focus-ring flex w-full items-center gap-2.5 rounded-[var(--radius-m)] border border-[var(--border-medium)] bg-[var(--surface-2)] px-2.5 py-2 text-left"
      >
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: companyAccent(active?.accent_color_key) }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-semibold text-[var(--text-primary)]">
            {active?.name ?? "Select company"}
          </span>
          {otherNames.length > 0 && (
            <span className="block truncate text-[10.5px] text-[var(--text-muted)]">
              {otherNames.join(" · ")}
            </span>
          )}
        </span>
        <IconChevronDown width={13} height={13} className="shrink-0 text-[var(--text-muted)]" />
      </button>

      {open && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-[var(--radius-m)] border border-[var(--border-medium)] bg-[var(--surface-raised)] py-1 shadow-xl">
          {companies.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(`/${c.slug}`);
                }}
                className="ox-focus-ring flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] hover:bg-[var(--surface-3)]"
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: companyAccent(c.accent_color_key) }}
                />
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
