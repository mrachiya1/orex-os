import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/app/actions/sessions";
import { listMessages } from "@/app/actions/messages";
import { ChatSessionView } from "@/components/intelligence/ChatSessionView";

export default async function ChatSessionPage({
  params,
}: {
  params: Promise<{ companySlug: string; sessionId: string }>;
}) {
  const { companySlug, sessionId } = await params;
  const session = await getSession(sessionId);
  if (!session) notFound();

  const messages = await listMessages(sessionId);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-1.5 border-b border-[var(--border-subtle)] px-8 py-3 text-[12px] text-[var(--text-muted)]">
        <Link href={`/${companySlug}/intelligence/chat`} className="ox-focus-ring hover:text-[var(--text-primary)]">
          Orex Intelligence
        </Link>
        <span>/</span>
        <span className="text-[var(--text-secondary)]">{session.title}</span>
      </div>
      <ChatSessionView sessionId={sessionId} initialMessages={messages as never} />
    </div>
  );
}
