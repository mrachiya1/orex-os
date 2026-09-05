import type { ReactNode } from "react";
import Link from "next/link";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`ox-card ${className}`}>{children}</div>;
}

export function CardHeader({
  title,
  icon,
  action,
  href,
  actionLabel,
}: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  href?: string;
  actionLabel?: string;
}) {
  return (
    <div className="ox-card-head">
      <div className="flex items-center gap-2 ox-card-title">
        {icon && <span className="text-[var(--text-muted)]">{icon}</span>}
        <span className="uppercase tracking-wide text-[11px]">{title}</span>
      </div>
      {action}
      {!action && href && actionLabel && (
        <Link href={href} className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          {actionLabel} →
        </Link>
      )}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] px-8 py-6">
      <div>
        <h1 className="text-[17px] font-semibold text-[var(--text-primary)]">{title}</h1>
        {description && <p className="mt-1 text-[12.5px] text-[var(--text-secondary)]">{description}</p>}
      </div>
      {action}
    </header>
  );
}
