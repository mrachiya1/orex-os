"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { renameSession, archiveSession } from "@/app/actions/sessions";
import { IconClose, IconSearch, IconPlus } from "@/components/ui/icons";

export interface HistorySessionRow {
  id: string;
  title: string;
  status: "active" | "archived";
  last_message_at: string;
}

function groupLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 7) return "Previous 7 Days";
  return "Older";
}

/**
 * Feels like ChatGPT/Claude history but in Orex visual language (prompts/015
 * Decisions #12/#13). Titles only, never raw session ids. The old standalone
 * /intelligence/sessions route still exists as a redirect for bookmarks --
 * this drawer is the only history UX normal users see.
 */
export function ConversationHistoryDrawer({
  companySlug,
  sessions,
  activeSessionId,
  open,
  onClose,
}: {
  companySlug: string;
  sessions: HistorySessionRow[];
  activeSessionId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isPending, startTransition] = useTransition();

  const grouped = useMemo(() => {
    const visible = sessions
      .filter((s) => s.status === "active")
      .filter((s) => s.title.toLowerCase().includes(query.trim().toLowerCase()));
    const groups: Record<string, HistorySessionRow[]> = {};
    for (const s of visible) {
      const g = groupLabel(s.last_message_at);
      groups[g] = groups[g] ?? [];
      groups[g].push(s);
    }
    return groups;
  }, [sessions, query]);

  if (!open) return null;

  function openSession(id: string) {
    onClose();
    router.push(`/${companySlug}/intelligence/chat/${id}`);
  }

  function submitRename(id: string) {
    const title = renameValue.trim();
    setRenamingId(null);
    if (!title) return;
    startTransition(async () => {
      await renameSession({ sessionId: id, title });
      router.refresh();
    });
  }

  function archive(id: string) {
    startTransition(async () => {
      await archiveSession({ sessionId: id, archived: true });
      router.refresh();
    });
  }

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/40" onClick={onClose} aria-hidden />
      <div className="fixed inset-y-0 left-0 z-40 flex w-80 flex-col border-r border-[var(--border-medium)] bg-[var(--surface-1)] shadow-xl md:absolute md:inset-y-0">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
          <span className="text-[12px] font-semibold text-[var(--text-primary)]">Conversations</span>
          <button type="button" onClick={onClose} className="ox-focus-ring text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <IconClose width={14} height={14} />
          </button>
        </div>
        <div className="flex flex-col gap-2 p-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push(`/${companySlug}/intelligence`);
            }}
            className="ox-focus-ring flex items-center gap-1.5 rounded-[var(--radius-s)] border border-[var(--border-medium)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
          >
            <IconPlus width={12} height={12} /> New Chat
          </button>
          <div className="flex items-center gap-1.5 rounded-[var(--radius-s)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-2.5 py-1.5">
            <IconSearch width={12} height={12} className="text-[var(--text-muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations"
              className="flex-1 bg-transparent text-[11.5px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {Object.keys(grouped).length === 0 && (
            <p className="px-2 py-4 text-[12px] text-[var(--text-muted)]">No conversations yet.</p>
          )}
          {(["Today", "Yesterday", "Previous 7 Days", "Older"] as const)
            .filter((g) => grouped[g]?.length)
            .map((g) => (
              <div key={g} className="mb-3">
                <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{g}</div>
                <div className="flex flex-col gap-0.5">
                  {grouped[g].map((s) => (
                    <div
                      key={s.id}
                      className={`group flex items-center gap-1 rounded-[var(--radius-s)] px-2 py-1.5 ${
                        s.id === activeSessionId ? "bg-[var(--surface-raised)]" : "hover:bg-[var(--surface-2)]"
                      }`}
                    >
                      {renamingId === s.id ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => submitRename(s.id)}
                          onKeyDown={(e) => e.key === "Enter" && submitRename(s.id)}
                          className="ox-input h-6 flex-1 py-0 text-[12px]"
                        />
                      ) : (
                        <button type="button" onClick={() => openSession(s.id)} className="ox-focus-ring flex-1 truncate text-left text-[12px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
                          {s.title}
                        </button>
                      )}
                      {renamingId !== s.id && (
                        <div className="hidden shrink-0 items-center gap-1 group-hover:flex">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => {
                              setRenamingId(s.id);
                              setRenameValue(s.title);
                            }}
                            className="ox-focus-ring text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => archive(s.id)}
                            className="ox-focus-ring text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          >
                            Archive
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
