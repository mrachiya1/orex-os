"use client";

import { useSyncExternalStore } from "react";

/**
 * Renders the viewer's real local time, ticking client-side. No location or
 * weather is attached -- that infrastructure doesn't exist yet, and the
 * dashboard must never fabricate it (AGENTS.md "Data Honesty"). Uses
 * useSyncExternalStore (not a setState-in-effect clock) so the server-
 * rendered snapshot and the first client render agree, then it ticks.
 */
function subscribe(callback: () => void) {
  const id = setInterval(callback, 30_000);
  return () => clearInterval(id);
}

function getClientSnapshot() {
  return new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function getServerSnapshot() {
  return "—";
}

export function LiveClock() {
  const time = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  return (
    <div className="text-right">
      <div className="num text-[22px] font-medium leading-none text-[var(--text-primary)]">{time}</div>
    </div>
  );
}
