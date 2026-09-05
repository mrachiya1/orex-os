"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A small anchored popover for inline cell editors (status/priority/health/
 * assigned/select pickers) -- closes on outside click or Escape. Not a full
 * floating-ui setup; the panel just renders below-left of the trigger,
 * which is enough for a table cell context.
 */
export function Popover({ trigger, children, align = "left" }: { trigger: ReactNode; children: (close: () => void) => ReactNode; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="ox-focus-ring block w-full text-left">
        {trigger}
      </button>
      {open && (
        <div
          className={`absolute z-30 mt-1 min-w-[160px] overflow-hidden rounded-[var(--radius-m)] border border-[var(--border-medium)] bg-[var(--surface-raised)] py-1 shadow-xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function PopoverOption({ onClick, active, children }: { onClick: () => void; active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ox-focus-ring flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-[var(--surface-3)] ${
        active ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
      }`}
    >
      {children}
    </button>
  );
}
