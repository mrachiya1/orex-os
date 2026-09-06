const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "ox-pill-warning" },
  accepted: { label: "Accepted", className: "ox-pill-success" },
  revoked: { label: "Revoked", className: "ox-pill-danger" },
  expired: { label: "Expired", className: "ox-pill-neutral" },
};

export function InvitationStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? { label: status, className: "ox-pill-neutral" };
  return <span className={`ox-pill ${style.className}`}>{style.label}</span>;
}
