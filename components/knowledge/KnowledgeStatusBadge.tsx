import type { KnowledgeVerificationStatus, KnowledgeLifecycleStatus } from "@/lib/knowledge/types";

const VERIFICATION_STYLE: Record<KnowledgeVerificationStatus, string> = {
  verified: "text-[var(--success)]",
  candidate: "text-[var(--warning)]",
  rejected: "text-[var(--danger)]",
};

const VERIFICATION_LABEL: Record<KnowledgeVerificationStatus, string> = {
  verified: "Verified",
  candidate: "AI candidate — unverified",
  rejected: "Rejected",
};

export function VerificationBadge({
  status,
  originType,
}: {
  status: KnowledgeVerificationStatus;
  originType?: "human" | "ai_extracted" | "system";
}) {
  const label =
    status === "candidate" && originType && originType !== "ai_extracted"
      ? "Unverified"
      : VERIFICATION_LABEL[status];
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs ${VERIFICATION_STYLE[status]}`}>{label}</span>
  );
}

const LIFECYCLE_STYLE: Record<KnowledgeLifecycleStatus, string> = {
  current: "text-[var(--success)]",
  stale: "text-[var(--warning)]",
  superseded: "text-[var(--muted)]",
  archived: "text-[var(--muted)]",
};

export function FreshnessBadge({ status }: { status: KnowledgeLifecycleStatus }) {
  return <span className={`rounded-md px-2 py-0.5 text-xs ${LIFECYCLE_STYLE[status]}`}>{status}</span>;
}
