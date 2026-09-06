"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { IconPlus, IconMic, IconSend, IconClose } from "@/components/ui/icons";
import { listAttachable, attachReference } from "@/app/actions/attachments";

export interface PendingAttachment {
  id: string;
  type: "project_ref" | "knowledge_ref" | "decision_ref" | "session_ref";
  title: string;
}

const ATTACH_TYPES: Array<{ type: PendingAttachment["type"]; label: string }> = [
  { type: "project_ref", label: "Attach Project" },
  { type: "knowledge_ref", label: "Attach Company Brain record" },
  { type: "decision_ref", label: "Attach Decision" },
  { type: "session_ref", label: "Attach Conversation" },
];

/**
 * The most premium interaction on the page (prompts/015 Decisions #14).
 * Image/PDF/file upload and voice are given a permanent, visible home here
 * so the composer never needs a redesign when Tier B lands -- they render
 * disabled with "Coming soon" today rather than being hidden or faked.
 */
export function Composer({
  value,
  onChange,
  onSubmit,
  disabled,
  companyId,
  organisationId,
  sessionId,
  onAttach,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  companyId: string | null;
  organisationId: string;
  sessionId: string | null;
  onAttach: (attachment: PendingAttachment) => void;
}) {
  const attachDisabled = !sessionId;
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerType, setPickerType] = useState<PendingAttachment["type"] | null>(null);
  const [pickerItems, setPickerItems] = useState<Array<{ id: string; title: string }>>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setPickerType(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSubmit();
    }
  }

  async function openPicker(type: PendingAttachment["type"]) {
    setPickerType(type);
    if (!companyId) {
      setPickerItems([]);
      return;
    }
    setPickerLoading(true);
    const items = await listAttachable(companyId, organisationId, type);
    setPickerItems(items);
    setPickerLoading(false);
  }

  async function pick(item: { id: string; title: string }) {
    if (!pickerType || !sessionId) return;
    const result = await attachReference({ sessionId, attachmentType: pickerType, referenceId: item.id });
    if (result.ok) onAttach({ id: item.id, type: pickerType, title: item.title });
    setMenuOpen(false);
    setPickerType(null);
  }

  return (
    <div className="rounded-[var(--radius-l)] border border-[var(--border-medium)] bg-[var(--surface-1)] p-2.5 shadow-sm">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask, analyze, plan or command Orex OS…"
        rows={2}
        disabled={disabled}
        className="w-full resize-none bg-transparent px-1.5 py-1 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
      />
      <div className="flex items-center justify-between px-1 pt-1">
        <div ref={menuRef} className="relative flex items-center gap-1">
          <button
            type="button"
            disabled={attachDisabled}
            onClick={() => {
              setMenuOpen((v) => !v);
              setPickerType(null);
            }}
            title={attachDisabled ? "Send a message first to attach references" : "Attach"}
            className="ox-focus-ring grid h-7 w-7 place-items-center rounded-[var(--radius-s)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <IconPlus width={14} height={14} />
          </button>
          <button
            type="button"
            disabled
            title="Voice input — coming soon"
            className="ox-focus-ring grid h-7 w-7 cursor-not-allowed place-items-center rounded-[var(--radius-s)] text-[var(--text-muted)] opacity-40"
          >
            <IconMic width={14} height={14} />
          </button>

          {menuOpen && !pickerType && (
            <div className="absolute bottom-full left-0 z-20 mb-1.5 w-64 rounded-[var(--radius-m)] border border-[var(--border-medium)] bg-[var(--surface-1)] p-1 shadow-lg">
              {ATTACH_TYPES.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => openPicker(t.type)}
                  className="ox-focus-ring block w-full rounded-[var(--radius-s)] px-2.5 py-1.5 text-left text-[12px] text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
                >
                  {t.label}
                </button>
              ))}
              <div className="my-1 border-t border-[var(--border-subtle)]" />
              {["Upload Image", "Upload PDF", "Upload File"].map((label) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-[var(--radius-s)] px-2.5 py-1.5 text-[12px] text-[var(--text-muted)] opacity-60"
                >
                  <span>{label}</span>
                  <span className="text-[10px] uppercase tracking-wide">Coming soon</span>
                </div>
              ))}
            </div>
          )}

          {menuOpen && pickerType && (
            <div className="absolute bottom-full left-0 z-20 mb-1.5 max-h-64 w-72 overflow-y-auto rounded-[var(--radius-m)] border border-[var(--border-medium)] bg-[var(--surface-1)] p-1 shadow-lg">
              <div className="flex items-center justify-between px-2 py-1 text-[10.5px] uppercase tracking-wide text-[var(--text-muted)]">
                <button type="button" onClick={() => setPickerType(null)} className="ox-focus-ring hover:text-[var(--text-primary)]">
                  ← Back
                </button>
              </div>
              {pickerLoading && <div className="px-2.5 py-2 text-[12px] text-[var(--text-muted)]">Loading…</div>}
              {!pickerLoading && pickerItems.length === 0 && (
                <div className="px-2.5 py-2 text-[12px] text-[var(--text-muted)]">Nothing available to attach.</div>
              )}
              {!pickerLoading &&
                pickerItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => pick(item)}
                    className="ox-focus-ring block w-full truncate rounded-[var(--radius-s)] px-2.5 py-1.5 text-left text-[12px] text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
                  >
                    {item.title}
                  </button>
                ))}
            </div>
          )}
        </div>
        <button
          type="button"
          disabled={disabled || !value.trim()}
          onClick={onSubmit}
          className="ox-focus-ring flex h-7 items-center gap-1.5 rounded-[var(--radius-s)] bg-[var(--accent)] px-2.5 text-[11.5px] font-medium text-[var(--accent-foreground)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {disabled ? "Thinking…" : "Send"}
          {!disabled && <IconSend width={12} height={12} />}
        </button>
      </div>
    </div>
  );
}

export function AttachmentChip({ attachment, onRemove }: { attachment: PendingAttachment; onRemove?: () => void }) {
  return (
    <span className="ox-pill ox-pill-neutral inline-flex items-center gap-1">
      {attachment.title}
      {onRemove && (
        <button type="button" onClick={onRemove} className="ox-focus-ring">
          <IconClose width={9} height={9} />
        </button>
      )}
    </span>
  );
}
