function initials(name: string | null | undefined, fallback: string | null | undefined) {
  const source = name?.trim() || fallback?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function Avatar({
  name,
  fallback,
  size = 28,
}: {
  name?: string | null;
  fallback?: string | null;
  size?: number;
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border border-[var(--border-medium)] bg-[var(--surface-raised)] text-[10.5px] font-semibold text-[var(--text-primary)]"
      style={{ width: size, height: size }}
    >
      {initials(name, fallback)}
    </div>
  );
}
