# Orex OS Product Scope

## Product Definition

Orex OS is the private, secure, multi-company AI operating system for Orex Group. It is a company intelligence and decision-support system — not a generic project management tool. It connects operational data, company knowledge, projects, clients, finance, people, meetings, risks, performance, and controlled AI actions into one command layer for the group and its companies.

## Product Vision

Over time, Orex OS becomes the operational memory, management layer, intelligence layer, and decision-support system of Orex Group: a single place where the founder and team can see what is true across every company, get evidence-based recommendations, and take controlled actions (including AI-assisted ones) without losing security, auditability, or company boundaries.

## Core Problem

Orex Group runs multiple companies (Orextic, Orex Studios, and future companies) whose operational truth — projects, clients, finances, risks, team capacity — currently lives scattered across tools, chats, and memory. There is no single, secure, permission-aware system that lets the founder and team members see the right data for the right company, get trustworthy AI-assisted analysis, and act on it with a full audit trail.

## Product Principles

Same as AGENTS.md §2, restated for product scope: preserve working features; build modularly; scope all operational data to a company; enforce authorization server-side and in the database; never trust frontend filtering; least privilege by default; AI is controlled decision support, not an unrestricted administrator; every mutation is traceable; risky AI mutations require an approval step; secrets never enter notes/logs/prompts; use real evidence, never astrology/numerology/inferred personality as business fact; separate personal reflection from evidence-based intelligence; never invent data; no placeholder functionality; no overbuilding beyond approved scope.

## User Types

- Founder CEO — group-wide access via explicit permissions, not a bypass
- Director — company-level leadership access
- Manager — operational management within a company
- Finance — finance-scoped access
- Project Manager — project-scoped operational access
- Creative Lead — delivery/creative-scoped access
- Team Member — assigned-work access
- Contractor — narrow, often project-scoped access; typically no finance, no secrets, no cross-company access
- Viewer — read-only

These are the default roles Orex OS ships with (see `docs/permissions.md`); companies are not limited to only these role names long-term, but Phase 001 implements exactly this set.

## Organisation Model

One organisation: **Orex Group**. It owns one or more companies. A user has exactly one identity (one login) but can hold different company memberships, each with its own role, inside that identity.

## Multi-Company Model

Current companies:

1. **Orextic** — AI transformation, automation, web development, creative marketing, hospitality technology, SaaS, digital products.
2. **Orex Studios** — 3D visual engineering, 3D product films, architectural visualisation, motion design, VFX, commercial visuals, creative production.

Future companies (Orex Productions, Orex Content Creation Studio, additional AI/automation/SaaS products, others) must be addable as data rows, never as code forks. No module may assume there are exactly two companies.

## Command Layer

- **Today** — the daily operational dashboard (ongoing projects, meetings, deadlines, risks, AI recommendations)
- **Founder Command Centre** — group-wide rollup across all companies the founder has access to
- **Advisor** — the AI chat interface for decision support (a Phase 002+ concern; Phase 001 does not implement it, but the company/permission model it will depend on is built here)

## Operations Layer

Projects, Delivery Ready, Clients, Calendar, Meetings, Daily Log — the company-scoped operational modules that consume the company/role/permission foundation. None of these are implemented in Phase 001; Phase 001 only builds the security foundation they will sit on top of.

## Business Layer

Finance, Transactions, Accounts, Goals — company-scoped financial modules, gated behind explicit `finance.*` permissions. Not implemented in Phase 001 beyond reserving the permission names.

## People Layer

Teams, Roles, Permissions, Performance. Phase 001 implements the foundational parts of this layer directly: user profiles, company memberships, roles, granular permissions, role-permission mapping, and invitations. Performance tracking itself is out of scope for Phase 001.

## Intelligence Layer

Decisions, Risk Analysis, Opportunity Detection, Weekly Improvement, Monthly Improvement — future evidence-based intelligence modules. Out of scope for Phase 001.

## Knowledge Layer

Company Brain, Company Knowledge, Company Rules, Vision, Mission, Services, Future Plans, Goals, Decisions, Lessons, Daily Memory — future knowledge modules that will feed AI context. Out of scope for Phase 001 (see AGENTS.md — Company Brain is explicitly excluded from this phase).

## AI Layer

AI Gateway (OpenRouter), AI Agents, AI Recommendations, AI Actions, AI Memory, AI Usage Tracking — entirely out of scope for Phase 001. The permission names `ai.use`, `ai.approve`, `ai.manage` are reserved in the permission model now so future AI work has somewhere to attach, but no AI code, gateway, or agent is built in this phase.

## Create / Builder Layer

A-Z Case Audit, Workflow Mapper, Process Improvement, Proposal Builder, Quotation Builder, Strategy Builder, Case Study Builder, Meeting Brief Builder, Project Plan Builder, Weekly/Monthly Report builders. Out of scope for Phase 001.

## System Layer

Companies, Roles, Permissions, Integrations, Plugins, Skills, Security, Audit Logs, Settings. Phase 001 builds the core of this layer: companies, roles, permissions, security foundation, and audit logging. Integrations, plugin registry, and settings UI beyond what's needed for the company switcher are out of scope.

## Data Categories

Operational (projects, clients, finance, etc. — future), Identity (user profiles, memberships — Phase 001), Authorization (roles, permissions — Phase 001), Audit (Phase 001 foundation only), Knowledge (future), Secrets (future dedicated vault, explicitly not ordinary tables).

## Data Sensitivity Categories

- **Public** — non-sensitive, safe to display broadly within the org
- **Internal** — normal operational data, company-scoped
- **Confidential** — sensitive business data (e.g., financial detail, client disappointment logs)
- **Restricted** — permission-gated data requiring explicit elevated access (e.g., finance approval records)
- **Secret** — credentials, API keys, tokens — never stored in ordinary tables, never sent to AI, never logged

Phase 001 tables (`companies`, `user_profiles`, `company_members`, `roles`, `permissions`, `audit_logs`) are Internal/Confidential. No Secret-classified data is handled in Phase 001.

## Core Product Relationships

Company → Client → Project → Tasks → Team → Finance → Delivery → Feedback → Knowledge → Decision. Phase 001 only establishes the left edge of this chain: Organisation → Company → Membership → Role → Permission, plus the Audit thread that will run underneath every future stage.

## Non-Goals

Orex OS is not: a public SaaS product, a generic project-management tool, a CRM sold to third parties, an astrology or numerology tool used as business evidence (Astro Lab is an explicitly separate personal-reflection feature, never conflated with client/business intelligence), or a system where AI can act autonomously without approval gates on risky actions.

## Phase Boundaries

**Long-term vision**: the full layered system described above (Command, Operations, Business, People, Intelligence, Knowledge, AI, Create/Builder, System layers).

**Current implementation scope (Phase 001 only)**: Orex Group organisation, companies, user profiles, company memberships, roles, permissions, role-permissions, invitation-based registration, company switcher, founder group-access foundation, server-side permission helpers, company data isolation, RLS, audit log foundation, and the minimal UI needed to exercise all of that (sign-in, company switcher, a bare authenticated shell).

This document does not authorize implementation of any layer beyond Phase 001. Each subsequent phase requires its own approved `prompts/NNN-*.md`.

## Success Definition

Phase 001 succeeds if: a real user can sign in, see only the companies/data they are authorized for, a founder can see authorized group-wide data, permission and company-isolation boundaries are enforced server-side and in the database (not just hidden in the UI), every meaningful mutation is audited with the correct actor, and all of this is verified by real tests, not claimed from inspection alone.

## Product Risks

1. Over-scoping Phase 001 into operational modules (projects/clients/finance) before the security foundation is proven — mitigated by this document's explicit Phase Boundaries section and AGENTS.md's "no silent scope expansion" rule.
2. Under-scoping the permission model (too coarse) forcing a breaking migration later — mitigated by `docs/permissions.md`'s granular permission design.
3. Treating founder access as a bypass instead of explicit permissions, which would undermine the entire audit/security model for the one account most likely to hold sensitive data — explicitly disallowed in `docs/permissions.md`.

## Open Product Questions

1. Should Phase 001 provision a live Supabase project, or remain schema/migration-only until the founder connects one? (Also flagged in `docs/current-state-audit.md`.)
2. Are there already-known future companies beyond Orextic/Orex Studios that should shape naming/slug conventions now, even though only two companies are seeded?
3. Should contractors be invitable by non-founder roles (e.g., a Director) in Phase 001, or should all invitations require founder/director-level `team.invite` permission regardless of company?

Use `docs/current-state-audit.md` for what exists today; nothing in this document should be read as describing already-built functionality.
