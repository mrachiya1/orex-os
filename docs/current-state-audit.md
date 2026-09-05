# Current State Audit

Date: 2026-09-05
Scope: full repository inspection prior to Phase 001 (Multi-Company Security Foundation).

## Repository Overview

Orex OS is currently an unmodified `create-next-app` output. There is one commit in git history ("Initial commit from Create Next App"). No product functionality has been built yet. The repository does contain a full planning layer (`AGENTS.md`, `.claude/commands/`, `.agents/skills/`, `docs/`, `prompts/`) but, as of this audit, every file under `docs/`, every `.agents/skills/*/SKILL.md`, and `prompts/001-foundation.md` contained only the meta-instructions used to generate them, not actual finished content. This audit, and the docs generated alongside it, are the first real content in that layer.

## Current Technology Stack

- Next.js 16.3.4, App Router (`app/`) — EXISTS (default scaffold only)
- React 19.2.8 / react-dom 19.2.8 — EXISTS
- TypeScript ~5, strict mode on (`tsconfig.json`) — EXISTS
- Tailwind CSS v4 via `@tailwindcss/postcss` (`postcss.config.mjs`) — EXISTS
- ESLint 9 + `eslint-config-next` (`eslint.config.mjs`) — EXISTS
- Supabase (client, auth, Postgres) — MISSING. `supabase/config.toml` says "Orex OS Supabase configuration is not yet defined." No `@supabase/*` packages in `package.json`.
- OpenRouter — MISSING. No package, no client code. `.env.example` reserves `OPENROUTER_API_KEY` / `OPENROUTER_DEFAULT_MODEL` only.
- PostHog — MISSING. `.env.example` reserves `POSTHOG_KEY` only.
- Zod — MISSING. Not in `package.json`.
- Test runner (Jest/Vitest/Playwright) — MISSING. No test package, no test files, no `test` script in `package.json`.

## Current Application Structure

```
app/
  favicon.ico
  globals.css
  layout.tsx      (default create-next-app layout, Geist fonts, title "Create Next App")
  page.tsx        (default create-next-app landing page)
components/       (empty directory, no files)
lib/
  ai/             (empty)
  audit/          (empty)
  auth/           (empty)
  database/       (empty)
  integrations/   (empty)
  permissions/    (empty)
  validation/     (empty)
public/           (default Next.js svg assets)
supabase/
  config.toml     (placeholder comment only)
  migrations/     (empty directory)
  seed.sql        (placeholder comment only)
```

`lib/` already has the directory shape implied by `docs/architecture.md`'s "Shared Libraries" section (auth, permissions, audit, database, validation, ai, integrations), but every directory is empty — no `.ts` files exist anywhere under `lib/` or `components/`.

## Existing Routes

None beyond the framework default `/` (`app/page.tsx`), which renders the stock create-next-app marketing page. No route groups, no `(auth)` segment, no API routes (`app/api/`), no server actions.

## Existing Screens

None of the product screens listed in AGENTS.md §3 (Today, Advisor Chat, Projects, Render Queue, Finance, Slip Inbox, Companies, Clients, Payments, Team, Ideas Inbox, Learning, Daily Logs, Astro Lab, Sleep Cycle, Rules, Settings) exist in code. AGENTS.md describes them as the product's target/existing screen list, but nothing in `app/` implements any of them — they are MISSING from the repository, not merely undiscovered.

## Existing Components

None. `components/` is empty. There is no shared UI kit, no button/input/table primitives, nothing to reuse yet.

## Existing Authentication

MISSING. No Supabase Auth client, no session handling, no login/logout routes, no middleware (`middleware.ts` does not exist), no cookie/session utilities in `lib/auth/`.

## Existing Authorization

MISSING. `lib/permissions/` is empty. No permission constants, no role definitions, no server-side permission-check helpers.

## Existing Database

MISSING. No live Supabase project is connected (`.env.example` values are all blank). No migrations exist (`supabase/migrations/` is empty). No ORM/query client code in `lib/database/`.

## Existing API Layer

MISSING. No `app/api/*/route.ts` files exist.

## Existing Server Actions

MISSING. No `"use server"` files anywhere in the repository.

## Existing AI Integration

MISSING. `lib/ai/` is empty. No OpenRouter client, no Advisor Chat implementation, no AI agent registry.

## Existing Environment Variables

`.env.example` currently declares (values blank, as expected for an example file):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTER_API_KEY`
- `OPENROUTER_DEFAULT_MODEL`
- `POSTHOG_KEY`
- `APP_URL`

No `.env` or `.env.local` file is present in the working tree (and `.gitignore` correctly excludes `.env*`). No secret values were found anywhere in source, docs, or prompts during this audit.

## Existing Working Features

None beyond the default Next.js scaffold page rendering correctly. There is nothing product-specific to preserve yet — this is a genuine greenfield build, not a brownfield one.

## Existing Placeholder Features

None found — there is no placeholder UI pretending to be functional (e.g., no dashboard cards backed by fake data). The repository is honestly empty rather than deceptively scaffolded, which is good: there is no misleading functionality to strip out before Phase 001.

## Existing Data Models

MISSING. No TypeScript types, no Zod schemas, no SQL table definitions exist anywhere in the repo.

## Existing Company Architecture

MISSING. No concept of organisation, company, membership, or role exists in code. `docs/product-scope.md`'s template referenced "Orex Group / Orextic / Orex Studios" only as planning text, not implemented data.

## Existing Security Controls

MISSING (nothing to secure yet, but also nothing enforcing isolation yet). No RLS policies (no migrations exist to hold them). No middleware-based route protection. No CSRF/session handling.

## Existing Testing Setup

MISSING. No test framework installed, no `__tests__` directories, no CI config (no `.github/workflows/`).

## Existing Design System

PARTIAL, in intent only. `docs/design-system.md` template names the visual direction (premium, dense, calm, silver/graphite for Orex Studios, coral/orange for Orextic) but no tokens, no Tailwind theme extension, and no components exist yet to embody it. `app/globals.css` was not yet inspected for custom tokens — recommend checking before Phase 001 UI work (see Unknowns).

## Existing Integrations

MISSING. No n8n, no calendar integration, no storage integration.

## Technical Debt

None yet — the codebase is too young to have debt. The main "debt" is process debt: the planning-doc layer (`docs/*.md`, `.agents/skills/*/SKILL.md`, `prompts/001-foundation.md`) was checked in as unexecuted templates rather than finished documents, which could mislead a future contributor (or agent) into thinking real architecture/permission/security decisions had already been made and approved. This audit and its sibling docs correct that.

## Security Risks

1. RISK — none of the "must never happen" safeguards in AGENTS.md (RLS, server-side permission checks, audit logging, secret isolation) exist yet, so there is currently zero enforcement of any kind. This is expected pre-Phase-001, but means Phase 001 is genuinely foundational, not incremental.
2. RISK (process) — because prior "generated" docs were actually unexecuted templates, any future agent skimming `docs/` without verifying content (as this audit does) could implement against assumptions that were never actually decided or approved. Recommend always cross-checking a doc's own content, not just its filename, before treating it as authoritative.

## Architecture Risks

1. No chosen deployment target has been confirmed (Vercel is implied by `README.md`'s boilerplate deploy links, not decided). Not blocking for Phase 001 (local/dev only), but should be an explicit decision before Supabase project provisioning.
2. `next.config.ts` is empty — no image domains, no security headers, no experimental flags configured. Not a Phase 001 blocker.

## Features That Must Be Preserved

None from a product-feature standpoint (nothing exists yet). From a tooling standpoint, preserve: the `.claude/commands/*` workflow commands, the `.agents/skills/*` skill scaffolding, the existing `tsconfig.json` path alias (`@/*` → project root), and the Tailwind v4 + ESLint 9 toolchain already configured in `package.json`.

## Missing Foundations

Everything required for Phase 001 is missing and must be built from zero:

- Supabase project connection and client setup (browser + server)
- `organisations`, `companies`, `user_profiles`, `company_members`, `roles`, `permissions`, `role_permissions`, `invitations`, `audit_logs` tables and migrations
- Auth (sign-in, session, middleware route protection)
- Server-side permission-resolution helpers (`lib/permissions/`)
- RLS policies for every company-scoped table
- Audit logging helper (`lib/audit/`)
- Company switcher UI and any base layout/shell components
- Zod validation schemas (`lib/validation/`)
- A test framework and first security/permission tests

## Unknowns Requiring Verification

1. Whether the founder wants Supabase provisioned now (a live project) or whether Phase 001 should stay schema/migration-only until a project is connected (`.env.example` values are currently blank).
2. Whether `app/globals.css` contains any custom design tokens worth preserving — not yet read in full; should be checked before design-system implementation work begins.
3. Deployment target (Vercel vs other) — not required for Phase 001 but affects `next.config.ts` decisions later.
4. Preferred package manager — `package-lock.json` present (npm), no `pnpm-lock.yaml`/`yarn.lock` — npm is the de facto choice unless corrected.

## Recommended Next Investigation

Before writing `prompts/001-foundation.md`, confirm the Unknowns above with the founder where they affect Phase 001 scope (primarily #1 — whether to provision a live Supabase project as part of this phase or stop at migration files).

---

**Summary**

1. Files inspected: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `.env.example`, `.gitignore`, `README.md`, `skills-lock.json`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css` (existence only), `components/` (empty), `lib/**` (all empty), `public/` (default assets), `supabase/config.toml`, `supabase/seed.sql`, `supabase/migrations/` (empty), all of `docs/*.md`, all of `.agents/skills/orex-*/SKILL.md`, all of `.claude/commands/*.md`, `AGENTS.md`, `CLAUDE.md`.
2. Major findings: repository is a genuine greenfield Next.js scaffold with zero product code; the entire planning-doc layer was previously unexecuted templates rather than real content.
3. Critical risks: none from existing code (nothing to break); the process risk of treating template stubs as approved decisions is the main hazard, now addressed by this audit.
4. Missing foundations: all of Supabase, auth, company/role/permission data model, RLS, audit logging, and UI shell — full list above.
5. Unknowns: live Supabase provisioning timing, `globals.css` contents, deployment target, package manager confirmation.
