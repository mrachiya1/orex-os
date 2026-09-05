"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ProjectTabs({ base, tabs }: { base: string; tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 border-b border-[var(--border-subtle)] px-8 py-2 text-[12.5px]">
      {tabs.map((t) => {
        const isActive = t.href === base ? pathname === base : pathname?.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`ox-focus-ring rounded-[var(--radius-s)] px-2.5 py-1.5 font-medium transition-colors ${
              isActive
                ? "bg-[var(--surface-raised)] text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
