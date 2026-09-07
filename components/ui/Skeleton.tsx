import type { CSSProperties } from "react";

/**
 * Shared loading-state building blocks for route loading.tsx files.
 * Deliberately not a spinner -- mirrors the density/shape of the real
 * card/table layouts so navigation feels instant rather than blank.
 */
export function SkeletonBlock({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <div className={`ox-skel ${className}`} style={style} />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="ox-card px-5 py-4.5">
      <SkeletonBlock className="mb-4 h-3 w-28" />
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonBlock key={i} className="h-3" style={{ width: `${85 - i * 12}%` }} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="ox-card overflow-hidden">
      <div className="ox-card-head">
        <SkeletonBlock className="h-3 w-32" />
      </div>
      <div className="flex flex-col gap-0 px-5 py-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-[var(--border-subtle)] py-2.5 last:border-0">
            <SkeletonBlock className="h-3 flex-1" />
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonPageHeader() {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] px-8 py-6">
      <div>
        <SkeletonBlock className="h-4 w-40" />
        <SkeletonBlock className="mt-2 h-3 w-64" />
      </div>
    </header>
  );
}
