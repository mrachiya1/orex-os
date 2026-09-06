"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CompanySwitcher, type SwitcherCompany } from "@/components/company/CompanySwitcher";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Avatar } from "@/components/ui/Avatar";
import {
  IconToday,
  IconInbox,
  IconCalendar,
  IconAdvisor,
  IconProjects,
  IconDelivery,
  IconClients,
  IconMeetings,
  IconBrain,
  IconDecisions,
  IconOpportunities,
  IconReports,
  IconFinance,
  IconTransactions,
  IconTeams,
  IconSettings,
  IconSearch,
  IconSparkle,
} from "@/components/ui/icons";

interface NavItem {
  label: string;
  href?: string;
  icon: (p: { width?: number; height?: number; className?: string }) => ReactNode;
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

function buildNav(slug: string, hasGroupAccess: boolean, canViewTeam: boolean): NavGroup[] {
  return [
    {
      label: "Essentials",
      items: [
        { label: "Today", href: `/${slug}`, icon: IconToday },
        ...(hasGroupAccess ? [{ label: "Group", href: "/group", icon: IconTeams }] : []),
        { label: "Inbox", icon: IconInbox },
        { label: "Calendar", icon: IconCalendar },
        { label: "Advisor", icon: IconAdvisor },
      ],
    },
    {
      label: "Operations",
      items: [
        { label: "Projects", href: `/${slug}/projects`, icon: IconProjects },
        { label: "Delivery", href: `/${slug}/delivery-ready`, icon: IconDelivery },
        { label: "Clients", icon: IconClients },
        { label: "Meetings", icon: IconMeetings },
      ],
    },
    {
      label: "Intelligence",
      items: [
        { label: "Orex Intelligence", href: `/${slug}/intelligence`, icon: IconSparkle },
        { label: "Company Brain", href: `/${slug}/brain`, icon: IconBrain },
        { label: "Decisions", href: `/${slug}/brain/decisions`, icon: IconDecisions },
        { label: "Opportunities", icon: IconOpportunities },
        { label: "Reports", icon: IconReports },
      ],
    },
    {
      label: "Finance",
      items: [
        { label: "Finance", icon: IconFinance },
        { label: "Transactions", icon: IconTransactions },
      ],
    },
    // Team management is UX visibility only, per docs/security.md -- direct
    // navigation to /team is still independently denied server-side/RLS for
    // anyone without team.read, whether or not this link is shown.
    ...(canViewTeam
      ? [{ label: "Team", items: [{ label: "Teams", href: `/${slug}/team`, icon: IconTeams }] }]
      : []),
    {
      label: "Admin",
      items: [{ label: "Settings", href: `/${slug}/settings`, icon: IconSettings }],
    },
  ];
}

export function Sidebar({
  companies,
  activeSlug,
  displayName,
  roleLabel,
  email,
  hasGroupAccess = false,
  canViewTeam = false,
}: {
  companies: SwitcherCompany[];
  activeSlug: string;
  displayName: string | null;
  roleLabel: string | null;
  email: string | null;
  hasGroupAccess?: boolean;
  canViewTeam?: boolean;
}) {
  const pathname = usePathname();
  const groups = buildNav(activeSlug, hasGroupAccess, canViewTeam);

  return (
    <aside className="sticky top-0 flex h-screen w-[236px] shrink-0 flex-col gap-5 border-r border-[var(--border-subtle)] bg-[var(--background-secondary)] px-3.5 pb-4 pt-5">
      <Link href={`/${activeSlug}`} className="ox-focus-ring flex items-center gap-2.5 rounded-[var(--radius-s)] px-1.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--radius-s)] border border-[var(--border-strong)]">
          <span className="h-2 w-2 rounded-full bg-[var(--text-primary)]" />
        </span>
        <span>
          <span className="block text-[13px] font-semibold leading-tight">Orex OS</span>
          <span className="block text-[10px] leading-tight text-[var(--text-muted)]">Build. Deliver. Grow.</span>
        </span>
      </Link>

      <CompanySwitcher companies={companies} activeSlug={activeSlug} />

      <div className="ox-focus-ring flex items-center gap-2 rounded-[var(--radius-m)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-2.5 py-2 text-[11.5px] text-[var(--text-muted)]">
        <IconSearch width={13} height={13} />
        <span className="flex-1">Search anything…</span>
        <kbd className="rounded border border-[var(--border-medium)] bg-[var(--surface-raised)] px-1.5 py-0.5 font-mono text-[9.5px]">
          Ctrl K
        </kbd>
      </div>

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto pr-0.5">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="mb-1 px-2 text-[9.5px] font-semibold uppercase tracking-[0.09em] text-[var(--text-muted)]">
              {group.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const isActive =
                  !!item.href &&
                  (pathname === item.href || (item.href !== `/${activeSlug}` && pathname.startsWith(`${item.href}/`)));
                const Icon = item.icon;
                if (!item.href) {
                  return (
                    <div
                      key={item.label}
                      className="flex items-center gap-2.5 rounded-[var(--radius-s)] px-2 py-[7px] text-[12px] text-[var(--text-muted)] opacity-50"
                      title="Coming later"
                    >
                      <Icon width={14} height={14} />
                      <span className="flex-1">{item.label}</span>
                      <span className="text-[9px] uppercase tracking-wide">Soon</span>
                    </div>
                  );
                }
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`ox-focus-ring flex items-center gap-2.5 rounded-[var(--radius-s)] border px-2 py-[7px] text-[12px] transition-colors ${
                      isActive
                        ? "border-[var(--border-strong)] bg-[var(--surface-raised)] text-[var(--text-primary)]"
                        : "border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Icon width={14} height={14} className={isActive ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-2.5 border-t border-[var(--border-subtle)] pl-1 pt-3">
        <Link href={`/${activeSlug}/settings`} className="ox-focus-ring flex min-w-0 flex-1 items-center gap-2.5 rounded-[var(--radius-s)]">
          <Avatar name={displayName} fallback={email} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold">{displayName ?? email ?? "You"}</div>
            <div className="truncate text-[10.5px] text-[var(--text-muted)]">{roleLabel ?? "Member"}</div>
          </div>
        </Link>
        <SignOutButton />
      </div>
    </aside>
  );
}
