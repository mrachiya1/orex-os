/**
 * One consistent inline icon set for the whole app (docs/design-system.md
 * "Icon System") — outline strokes, 1.6 width, sized to inline text. No
 * external icon package is installed yet, so these are hand-authored rather
 * than mixing families; swap for a package wholesale later if one is
 * approved, never per-icon.
 */
import type { SVGProps } from "react";

function Base(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

export const IconToday = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><circle cx="12" cy="12" r="4.2" /><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8L6 18M18 6l1.8-1.8" /></Base>
);
export const IconInbox = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 8.5h18" /></Base>
);
export const IconCalendar = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></Base>
);
export const IconAdvisor = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M12 2.5l7 3.6v5.4c0 4.6-3 7.6-7 9-4-1.4-7-4.4-7-9V6.1z" /></Base>
);
export const IconProjects = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><rect x="3" y="3" width="7.5" height="7.5" rx="1.2" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.2" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.2" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.2" /></Base>
);
export const IconDelivery = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M21 16V8a2 2 0 00-1-1.7l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.7l7 4a2 2 0 002 0l7-4a2 2 0 001-1.7z" /><path d="M3.3 7L12 12l8.7-5M12 22V12" /></Base>
);
export const IconClients = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M17 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8" /></Base>
);
export const IconMeetings = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 12h8M8 16h5" /></Base>
);
export const IconBrain = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M9.5 2A2.5 2.5 0 007 4.5v15A2.5 2.5 0 009.5 22h5a2.5 2.5 0 002.5-2.5v-15A2.5 2.5 0 0014.5 2" /><path d="M7 8H4.5A1.5 1.5 0 003 9.5v5A1.5 1.5 0 004.5 16H7M17 8h2.5A1.5 1.5 0 0121 9.5v5a1.5 1.5 0 01-1.5 1.5H17" /></Base>
);
export const IconDecisions = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></Base>
);
export const IconOpportunities = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M23 6l-9.5 9.5-5-5L1 18" /><path d="M17 6h6v6" /></Base>
);
export const IconReports = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M4 19V5a2 2 0 012-2h12a2 2 0 012 2v14l-3-2-3 2-3-2-3 2-3-2z" /></Base>
);
export const IconFinance = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></Base>
);
export const IconTransactions = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" /></Base>
);
export const IconTeams = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8" /></Base>
);
export const IconSettings = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.9 2.9l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.9-2.9l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.9-2.9l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.9 2.9l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></Base>
);
export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></Base>
);
export const IconChevronDown = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M6 9l6 6 6-6" /></Base>
);
export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M20 6L9 17l-5-5" /></Base>
);
export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M12 5v14M5 12h14" /></Base>
);
export const IconClose = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M18 6L6 18M6 6l12 12" /></Base>
);
export const IconAlert = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M12 2L1 21h22L12 2z" /><path d="M12 9v5M12 17h.01" /></Base>
);
export const IconSparkle = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" /></Base>
);
export const IconClock = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></Base>
);
export const IconAudit = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M4 19V5a2 2 0 012-2h8l6 6v10a2 2 0 01-2 2H6a2 2 0 01-2-2z" /><path d="M14 3v6h6" /></Base>
);
export const IconDownload = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 19h16" /></Base>
);
export const IconUpload = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M12 21V9M7 14l5-5 5 5" /><path d="M4 19h16" /></Base>
);
