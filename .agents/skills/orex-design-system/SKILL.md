# Orex Design System

## Purpose

Reusable checklist for building any new Orex OS screen so it looks and behaves like the rest of the product, not like a bolted-on generic admin panel. Full visual language lives in `docs/design-system.md`; this skill is the actionable procedure to follow before writing a new component.

## Product Character

Premium, dense, calm, precise, operational. This is an internal command centre for people who already know their business — not a public SaaS marketing surface. Avoid generic-SaaS patterns (giant hero cards, oversized whitespace, glassmorphism, cyberpunk gradients, playful illustration) in favor of dense, information-rich, quickly scannable views, matching the existing `AuditLogTable`/`MemberTable` density.

## Brand Architecture

One shared `--accent` CSS variable (currently `#f97316`, orange) plus per-company accent-dot hints (`CompanySwitcher.tsx`'s `ACCENT_DOT` map: Orextic = orange, Orex Studios = zinc/graphite, neutral = zinc). A full per-company theme swap is documented as a future intention in `app/globals.css` but not yet implemented — do not build a new per-company theming mechanism as a side effect of an unrelated feature; if a new page needs a company-color accent, reuse the existing `ACCENT_DOT`-style mapping rather than inventing a second one.

## Before Designing a New Component

1. Check `components/` for an existing component that already does this (a dense table, a form, a badge, a detail panel) — reuse and extend before creating a new one. `AuditLogTable` is the canonical dense-table pattern; `InviteForm` is the canonical inline-form pattern.
2. Check whether the new view needs a new design token — it almost never does. `--background`, `--foreground`, `--surface`, `--overlay`, `--border`, `--muted`, `--accent`, `--success`, `--warning`, `--danger` cover status/emphasis/surface needs for the whole app so far, including Phase 003's verification/freshness badges.
3. Confirm the new route sits inside the existing `app/(app)/[companySlug]/` shell (sidebar + company switcher) rather than introducing a parallel layout.

## Design Tokens

Defined in `app/globals.css` as raw CSS custom properties (`--surface`, `--border`, etc.), consumed directly in Tailwind class names via `bg-[var(--surface)]` rather than as Tailwind theme tokens (only background/foreground/fonts are wired into `@theme inline`). Follow this same raw-var convention for new components rather than adding hard-coded hex values or a parallel token system.

## Component Rules

Server Components by default; `"use client"` only where interactivity requires it (forms, dropdowns) — matches `InviteForm.tsx`/`CompanySwitcher.tsx`'s split. A list/table view is a Server Component that fetches data directly; any mutation goes through a `"use server"` action imported and called from a small client wrapper, never a client-side direct Supabase call for a protected mutation.

## Data Density

Prefer a dense `<table>` over a card grid for anything resembling a list of records (this is an operational tool, not a marketing gallery). Use `AuditLogTable`'s column conventions: monospace for ids/timestamps/technical strings, plain text for human-facing labels, a small colored status pill for state.

## Table Design

Columns should be scannable at a glance: identity/title first, then status/state badges, then secondary metadata (source, dates), with row-level actions (view/edit/verify) either as a trailing column or reached via row click into a detail view — never buried behind a menu for a single common action like "view."

## AI Components

Any UI element showing an AI-produced result (a recommendation, an extracted candidate fact, a Q&A answer) must visibly show: the content, that it's AI-generated (never presented identically to human-verified content), its confidence where applicable, its source/evidence, and freshness where relevant. Never render AI output with the same visual weight/certainty as a verified fact — a distinct badge or label (e.g. "AI — unverified") is required, not optional styling polish.

## Accessibility

Sufficient color contrast for status colors against both light and dark surfaces (reuse the existing `--success`/`--warning`/`--danger` tokens rather than inventing new ones with unverified contrast). Every interactive element reachable by keyboard; every table has a real `<table>`/`<th>` structure (not divs styled to look like a table), matching the existing `AuditLogTable` markup.

## Reuse Rules

Never fork an existing component to add one new prop's worth of behavior — extend it. Never introduce a second table/badge/form pattern that does the same job as an existing one with slightly different styling.

## Review Checklist

Does this screen live inside the existing `[companySlug]` shell? Does it reuse an existing table/form/badge pattern rather than inventing a new one? Does every AI-sourced element look visually distinct from human-verified content? Does every list/table have an explicit empty state (not a blank area) and a loading state? Does color usage stay within the existing token set?

## Anti-Patterns

A new standalone layout that bypasses the sidebar/company-switcher shell. A card-grid dashboard for what should be a dense table. A confidence score shown next to verified/human-authored content. A second design-token set "just for this one feature."

## Example Component Decision Process

Building the Phase 003 knowledge list: reuse `AuditLogTable`'s table shell and status-pill convention → add a verification-status badge and a freshness badge using the same pill styling with `--success`/`--warning`/`--muted` → reuse `InviteForm`'s inline-form pattern for the "create knowledge" flow → no new design tokens, no new layout, no new table component from scratch.
