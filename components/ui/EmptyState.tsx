import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="ox-empty">
      {icon && <div className="ox-empty-icon">{icon}</div>}
      <div className="ox-empty-title">{title}</div>
      {body && <p className="ox-empty-body">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
