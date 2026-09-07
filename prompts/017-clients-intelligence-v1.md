# 017 — Clients Intelligence V1

Status: **DRAFT — AWAITING APPROVAL. No code has been written.**

This is a schema + permissions + Action Engine + UI change. Per AGENTS.md working
loop, this document is written, then implementation stops for approval.

---

## 0. Current state audit (grounded facts, not assumptions)

Gathered by inspecting the repo directly (migrations, permission catalog, RLS
helpers, Action Engine, Company Brain, UI components) — not guessed.

**Migrations**: 38 exist (`0001`–`0038`), sequential, no gaps. Next migration
starts at **`0039`**.

**Projects schema** (`0019_projects_and_delivery.sql`): `projects` has exactly
one client-related column — `client_display_name text` (free text, no FK, no
referential integrity to anything). No `client_id`, no brand, no contact
columns anywhere. No monetary "value" column either — money is only
representable through the generic custom-property engine added in `0027`
(`project_property_values`, `value jsonb`, keyed by a per-company
`property_definitions` row). There is no guarantee any company has defined a
monetary property. **This means "client lifetime value" cannot be derived from
a guaranteed schema field — see §Client Value below.**

**Permissions**: `clients.read`, `clients.create`, `clients.update`,
`clients.delete` **already exist** in `lib/permissions/catalog.ts`, seeded in
migration `0002` (Phase 001), and are already wired into the
`role_permissions` matrix (founder/director/manager/project_manager get full
access, creative_lead/member/viewer get read-only, contractor gets none).
They are **dormant** — no table or RLS policy uses them today (confirmed by
`0038`'s own comment: "Finance/Clients/Team are deliberately NOT included [in
advisor tools]... no migration creates a clients... table"). **V1 reuses these
four keys directly** rather than reinventing them, and adds new keys only for
genuinely new capability surfaces (contacts, relationship/preferences,
credentials — see §Permissions).

**RLS pattern** (from `0006`, `0019`, `0013`): every table gets
`has_company_permission(company_id, key)` / `has_org_permission(org_id, key)`
branch policies (company-scoped vs. org-wide nullable-company pattern), named
per-operation policies (`_select`/`_insert`/`_update`, no blanket `for all`),
and append-only tables (audit_logs, project_activity) get no UPDATE/DELETE
policy at all. Resource-scoped contractor access is additive-only via
`has_project_access()` + `project_members` (only `contractor` role has
`roles.is_resource_scoped = true`).

**Provenance model** (Company Brain, `knowledge_items` in `0013`): the exact
verified/observed/inference pattern the spec asks for already exists —
`origin_type` (`human | ai_extracted | system`) × `verification_status`
(`candidate | verified | rejected`) × `confidence numeric(4,3)` ×
`classification` (`public..secret`), with a **hard DB constraint**
(`knowledge_items_ai_never_preverified`) preventing AI-authored rows from ever
being inserted or left as pre-verified. Client preferences/knowledge should
mirror this exact column shape and constraint style rather than inventing new
terminology.

**Secrets/vault**: **no encrypted-secret infrastructure exists anywhere in the
repo.** `secrets.read/reveal/manage` are dormant catalog-only permission keys.
The one existing precedent for "defer real secret storage" is
`user_connections` (`0030`) — an OAuth-connection placeholder with **no token
column at all**, whose migration comment states plainly that real credential
storage was deliberately deferred pending an approved encryption/KMS decision.
**V1 follows this exact precedent for `client_credentials`: metadata only, no
secret column.**

**Supabase Storage**: zero usage anywhere in the codebase — no bucket, no
storage RLS policy, no client/server storage call. Client file uploads are
building from scratch, so v1 **defers actual file upload** and only documents
the intended design (§Files below), per the spec's explicit instruction not to
expand scope with binary uploads this phase.

**Action Engine**: `lib/ai/tools/registry.ts`'s `TOOL_REGISTRY` is assembled by
spreading each domain's tool file (`projectsTools`, `decisionsTools`) — adding
`clientsTools` from a new `lib/ai/tools/clients.ts` is the documented extension
point. Tool naming convention is `domain.verb` / `domain.subresource.verb`
(`projects.task.create`, `projects.tasks.create_batch`). Risk levels are
`0` (read-only) / `1` (safe mutation) / `2` (important) / `3` (critical), each
tool declares `scopeType: organisation | company | project` and
`requiredPermission`. **Critically: registering new tools does NOT grant any
existing agent access to them.** The one agent that exists today
(`agent_key = "advisor"`, shown as "Founder Advisor") has an explicit
`allowed_tools` array edited only via targeted migrations (`0037`, `0038`
precedent). Registering `clients.*` tools is safe by default — it cannot
silently expand the advisor's capabilities. **Whether to grant the advisor
agent any `clients.*` tools in this same pass, or defer that to a follow-up
migration once the founder has used the feature, is a decision point — see
§Open Decisions.**

**UI**: Sidebar (`components/shell/Sidebar.tsx`) already has a "Clients" row
under **OPERATIONS** with `IconClients` (already exists) but no `href` — it
renders as a disabled "Soon" row. Making it live is a one-line change (add
`href: \`/${slug}/clients\``). Design system primitives to reuse: `Card`,
`CardHeader`, `PageHeader`, `EmptyState`, `Button` (from `components/ui/`),
plus CSS classes `ox-card`, `ox-pill*`, `ox-table`, `ox-focus-ring`,
`ox-field`/`ox-input`/etc. There is no generic `StatusBadge`/`Table`
component — the existing convention is a small feature-local file
(`components/projects/ProjectStatusBadge.tsx` exports `StatusBadge`+
`HealthBadge` as lookup-table-driven `<span className="ox-pill {tone}">`)
mirrored per-feature; **v1 adds `components/clients/ClientStatusBadge.tsx`
and `ClientHealthBadge.tsx` following this exact pattern**, not a new generic
component. Project Detail's tab pattern (`app/(app)/[companySlug]/projects/
[projectId]/layout.tsx` + route-based sub-pages, `ProjectTabs.tsx` client
component highlighting active tab via `usePathname()`) is the direct template
for the Client Detail page's tabs.

---

## 1. Product principle (unchanged from spec)

Clients Intelligence distinguishes **VERIFIED FACT / OBSERVATION / AI
INFERENCE / FORECAST** at the data model level (mirroring `knowledge_items`'
`origin_type`/`verification_status`/`confidence`), and never silently
upgrades an AI inference into a displayed fact.

---

## 2. Data model

All new tables: `organisation_id not null`, `company_id` (nullable only where
an org-wide record is meaningful — clients themselves are always
company-scoped, since a client relationship belongs to one Orex company),
`created_at`/`updated_at`, RLS enabled immediately, named per-operation
policies, indexes on every FK and `status`/`updated_at`/`last_interaction_at`.

### `clients` (client organisation)
```
id, organisation_id not null, company_id not null,
name not null, legal_name,
status text check in (lead, negotiating, active, paused, inactive, completed, lost) default 'lead',
relationship_stage text check in (new, developing, established, long_term, at_risk, dormant) default 'new',
website, industry, country, timezone,
source, how_we_met,
client_since date,
last_interaction_at timestamptz,
notes_summary,
created_by (fk user_profiles), created_at, updated_at, archived_at
```
`status` and `relationship_stage` are deliberately separate columns (spec §57)
— an Active client can independently be an At-Risk relationship.

### `client_contacts`
```
id, client_id not null, company_id not null,
first_name not null, last_name, preferred_name,
job_title, email, phone,
birthday, timezone, country,
is_primary_contact boolean default false,
last_interaction_at,
created_at, updated_at
```
Deliberately a **separate table from `user_profiles`** (spec §6) — external
people, no auth identity, no company membership. `birthday`/personal
phone/email are present but classified sensitive — see §Personal Data
Privacy for the access boundary.

### `client_brands`
```
id, client_id not null, company_id not null,
name not null, website, category, description,
status text check in (active, inactive) default 'active',
created_at, updated_at
```

### `projects` (additive migration)
```
+ client_id uuid references clients(id) on delete set null
+ client_brand_id uuid references client_brands(id) on delete set null
+ primary_client_contact_id uuid references client_contacts(id) on delete set null
```
`client_display_name` is **kept, untouched**. No backfill/auto-linking is
attempted (spec §76: no destructive conversion, no fuzzy-guess linking) — new
projects can set `client_id`; existing projects keep their free-text name
until a human manually links them via the client profile's "Link Project" UI.
A cross-company integrity constraint (mirroring `0022`'s pattern for
`decisions.project_id`) ensures `projects.client_id`'s `company_id` matches
the project's own `company_id`.

### `client_notes`
```
id, client_id not null, contact_id (fk client_contacts, nullable), company_id not null,
type text check in (general, communication, preference, request, concern, relationship_update),
content not null,
source, created_by not null, created_at
```

### `client_preferences`
```
id, client_id not null, contact_id (fk client_contacts, nullable), company_id not null,
category text check in (communication, creative, delivery, process, meeting, presentation, general),
statement not null,
sentiment text check in (like, dislike, preference, avoid),
origin text check in (human, client_direct, project, meeting, ai) not null,
knowledge_type text check in (verified, observed, inference) not null default 'observed',
confidence numeric(4,3) check (confidence between 0 and 1),
verified boolean not null default false,
source_reference text,
created_by, created_at, updated_at
```
Mirrors `knowledge_items`' provenance columns exactly. Same DB-level
invariant as `knowledge_items_ai_never_preverified`: a CHECK constraint
`client_preferences_ai_never_preverified` — `not (origin = 'ai' and verified)`.

### `client_feedback`
```
id, client_id not null, project_id (fk projects, nullable), contact_id (fk client_contacts, nullable), company_id not null,
rating smallint check (rating between 1 and 5),
sentiment text check in (positive, neutral, negative),
feedback_type text check in (positive, neutral, concern, disappointment, misunderstanding, scope_issue, communication_issue, delivery_issue),
content not null,
received_at not null, recorded_by not null, source,
created_at
```

### `client_relationship_issues`
```
id, client_id not null, project_id (fk projects, nullable), contact_id (fk client_contacts, nullable), company_id not null,
type text check in (misunderstanding, scope_conflict, communication_delay, delivery_concern, payment_concern),
severity text check in (low, medium, high),
reason not null, impact, resolution, lesson,
status text check in (open, resolved) default 'open',
occurred_at not null, resolved_at,
created_by not null, created_at, updated_at
```

### `client_activity` (append-only timeline, mirrors `project_activity`)
```
id, client_id not null, company_id not null,
actor_user_id (fk user_profiles, nullable — null for system-generated),
event_type not null, summary not null,
related_resource_type, related_resource_id,  -- reference, not duplicated payload (spec §18)
metadata jsonb default '{}',
created_at
```
Written exclusively via a service-role helper (`lib/clients/activity.ts`,
mirroring `lib/projects/activity.ts`) — never a client-writable row, same
pattern as `project_activity`/`audit_logs`. Populated automatically by every
mutation above (client created, note added, feedback recorded, issue
opened/resolved, project linked) so no feature duplicates event-writing logic
ad hoc.

### `client_credentials` (metadata only — see §Credential Security)
```
id, client_id not null, project_id (fk projects, nullable), company_id not null,
label not null,
credential_type text check in (website_login, hosting, social_media, server, dns, email, other),
provider,
username_hint,
secret_reference text,  -- opaque pointer only; NEVER a secret value; null until a real vault exists
last_updated_at,
created_by not null, created_at, updated_at
```

**No `client_requests` table** — spec §27/§58 explicitly says reuse
`project_scope_changes` rather than build a competing system. The Client
Detail page's Timeline/Relationship views query `project_scope_changes` for
all projects linked to `client_id` and render them alongside client-native
events. A general non-project `client_request` type is deferred until a real
need is demonstrated (none exists yet).

**No separate `client_outcomes` table for v1** — spec §60 offers a choice;
v1 reuses `client_notes` (`type = 'relationship_update'`) for recording
outcomes (delivered, renewed, testimonial received) rather than adding a
sixth new table for a capability with no concrete UI requirement yet. This
can be split out later without a breaking migration.

---

## 3. Client value

**No fabricated numbers.** Since Projects has no guaranteed monetary column,
v1's value strip reads `project_property_values` for each client's linked
projects, looking for a company-defined custom property whose
`property_definitions.name` matches a small allow-list (e.g. "Value",
"Project Value", "Price") — if no such property is defined for that company,
the value cards render **"Not tracked"**, never `$0` or a guess. This is a
deliberate best-effort derivation, documented as a known limitation (see
§Deferred), not a promise. `Lifetime Project Value`, `Active Project Value`,
`Completed Project Value`, `Average Project Value`, `Projects Completed` are
all derived at read time from linked `projects` (+ matched property values) —
never duplicated/cached as stored columns, so they can't drift.

Pipeline/forecast/expected-future-value are explicitly **deferred** (spec
§15) — no real pipeline data source exists yet.

---

## 4. Client health (deterministic, explainable — spec §28/29)

A pure function (`lib/clients/health.ts`), no AI call, no stored score column
— computed at read time from real signals already in the data model:

```
Strong   — 0 open issues, ≥1 active project healthy/on-track, interacted ≤7 days
Healthy  — 0 open issues, no at-risk project, interacted ≤14 days
Attention— 1 open issue OR any at-risk linked project OR interacted 8-21 days
At Risk  — ≥2 open issues OR interacted >21 days with an active project OR a linked project is blocked
Unknown  — no linked projects and no interaction history yet
```
Every status renders with a "Why:" list of the actual triggering facts (e.g.
"1 open misunderstanding", "Client has not interacted for 12 days"),
never a bare number. Weights/thresholds live in one named constants object
so they're auditable and tunable without touching render logic.

---

## 5. Risks & opportunities

Deterministic, evidence-required, same shape as Health — no separate AI call
on page load (spec §62/63: no background agent, no auto-AI-on-load). Each
finding is generated by a rule function reading real rows (e.g. "3 completed
projects + positive latest feedback" → Case Study opportunity), with the
evidence list always attached. An AI-generated finding (future, deferred) would
require `confidence` and would render distinctly from a deterministic one —
the UI must never blend the two without a visible label, matching §20's
verified/observed/inference distinction.

---

## 6. Company Brain integration

No schema change to `knowledge_items` in v1 (it has no `project_id`/`client_id`
column, and adding resource-level scoping to Company Brain is a bigger
architectural decision than this phase warrants). Instead: `client_preferences`
already carries its own full provenance model (§2 above). A future explicit
human action ("Promote to Company Brain") can create a company-scoped
`knowledge_items` row referencing the client by name in its content — v1 does
**not** build this promotion flow yet (no concrete UI need demonstrated),
just ensures the schema doesn't block it later. `knowledge_sources.source_type`
already includes a `'client'` enum value (added in `0013`, currently unused),
confirming the data model anticipated this — v1 can start using it once a
client note/preference actually needs to enter Company Brain, without a
migration.

---

## 7. Orex Intelligence integration (Action Engine)

New file `lib/ai/tools/clients.ts`, spread into `TOOL_REGISTRY` alongside
`projectsTools`/`decisionsTools`. Tools follow the exact existing `domain.verb`
convention and scope-resolution pattern (`resolveScopeIds` never trusts a
caller-supplied `companyId` — it's always derived from the resolved
`client_id`'s own row, exactly like `hasProjectAccess` derives from the
project row).

| Tool | Risk | Scope | Permission |
|---|---|---|---|
| `clients.search` | 0 | company | `clients.read` |
| `clients.get` | 0 | company | `clients.read` |
| `clients.projects.list` | 0 | company | `clients.read` + `projects.read` |
| `clients.timeline.list` | 0 | company | `clients.read` |
| `clients.preferences.list` | 0 | company | `clients.read` |
| `clients.feedback.list` | 0 | company | `clients.read` |
| `clients.issues.list` | 0 | company | `clients.read` |
| `clients.create` | 1 | company | `clients.create` |
| `clients.update` | 1 | company | `clients.update` |
| `clients.note.create` | 1 | company | `clients.update` |
| `clients.preference.create` | 1 | company | `clients.update` |
| `clients.feedback.create` | 1 | company | `clients.update` |
| `clients.issue.create` | 1 | company | `clients.update` |
| `clients.archive` | 2 | company | `clients.delete` |

No `clients.delete` (hard delete) tool is ever registered — archive only,
per spec §37 ("AI must not permanently delete client records").
`client_credentials.*` tools are **not created in v1** — credential metadata
management stays human-only UI (no AI tool surface at all), per spec §39-42's
explicit caution.

**Every mutation tool writes to `client_activity` and calls `writeAuditLog`**,
exactly like `runCompanyBrainCommand`'s existing project-task flow — no direct
table writes from AI, ever.

**Agent grant**: registering these tools does **not** give the "advisor" agent
access to them (confirmed executor behavior — allow-list is explicit and
migration-edited). Recommend granting the advisor agent the **7 read-only
(risk 0) tools only** in this same migration pass, so `Orex Intelligence` can
immediately answer "Who is Nova Labs?" / "What's active for them?" /
"What does Alex prefer?" — the exact command examples in spec §71 — while
every mutation (`create`/`update`/note/preference/feedback/issue) stays
`propose`-gated by the advisor's existing `CONFIRM_TO_ACT` autonomy mode
+ `maxRiskLevel: 1`, requiring explicit human approval, matching how
`projects.task.create` already works. This is a decision point for you to
confirm — see §Open Decisions.

**Context chip**: `getIntelligenceContext` gets one more optional field,
`activeClients: number | null` (permission-gated count, same pattern as
`activeProjects`). A "current client in view" context chip (spec §72) is
explicitly **not built in v1** — no existing pattern for "current entity in
view" exists anywhere in Orex Intelligence yet (confirmed: `runCompanyBrainCommand`
resolves entities from message text, never from ambient route state), and
building that mechanism generically is a larger change than this phase
warrants. Deferred.

---

## 8. Credential security

No plaintext secret ever enters `clients`, `client_contacts`, `client_notes`,
Company Brain, chat, or `project_property_values` — enforced by:
1. **Schema**: `client_credentials` has no secret-value column, period —
   only `secret_reference text` (an opaque placeholder, null until a real
   vault exists).
2. **UI**: the Credentials section renders "Secure credential storage is not
   configured yet." + "[Add Credential Reference]" (metadata form only — no
   password field ever rendered), exactly per spec §42.
3. **AI**: no `client_credentials.*` tool exists, so the AI cannot read or
   write this table at all in v1 — not even metadata. (Deferred until a
   `client_credentials.read_metadata` permission + read-only tool is
   explicitly approved.)
4. **Redaction defense-in-depth**: even if a future field somehow carried a
   secret-shaped value, `redactSecrets`' key-pattern regex
   (`token|password|secret|api_key|apikey|access_key`) and
   `buildContext`'s unconditional `"secret"`-classification drop both already
   exist and would strip it before it reached any AI call — confirmed
   existing behavior, not new code.

---

## 9. Personal data privacy

`client_contacts.birthday` / `phone` / `email` are stored (legitimate business
purpose per spec §7) but are **not** gated behind a new permission in v1 —
they're ordinary columns on `client_contacts`, visible to anyone with
`clients.read` (same as the rest of the contact record), because splitting
contact fields into a second default-deny table (mirroring
`user_private_profiles`) adds real complexity for a phase that has no
concrete UI need demonstrated for hiding a client contact's phone number from
a `clients.read` holder. **This is a explicit scope decision, flagged for
your review** — if you want client-contact PII split into a stricter tier
(e.g. only `client_relationship.manage` can see birthday/personal phone),
say so and I'll add a `client_contacts_sensitive` table mirroring
`user_private_profiles`'s default-deny pattern before implementation.
Numerology/"Personal Lens" (spec §43-44) is **not built in v1 at all** — not
even as a stub — since the spec itself defers the external API and mandates
it never influence anything real; adding an unused, clearly-labeled
experimental flag now would be dead code with no consumer.

---

## 10. Permissions (new keys, following existing naming convention)

Reused as-is (already seeded, already role-matrixed): `clients.read`,
`clients.create`, `clients.update`, `clients.delete` (used for archive, since
no hard-delete exists).

New keys (added via migration, following the `0020`-style
insert-then-role-matrix pattern):
```
client_contacts.read       -- folded into clients.read in v1 (see below)
client_contacts.manage     -- folded into clients.update in v1 (see below)
client_relationship.read   -- folded into clients.read in v1 (see below)
client_relationship.manage -- folded into clients.update in v1 (see below)
client_credentials.read_metadata
client_credentials.manage
```
**Decision**: rather than fragment into 6 near-duplicate keys as the spec's
§65 "suggested minimum" lists, v1 uses `clients.read`/`clients.update` for
contacts, brands, notes, preferences, feedback, and issues (they're all
sub-resources of the same client record, and the existing role matrix already
expresses the right access shape for founder/director/manager/member/viewer
without new rows) — **except credentials**, which get their own two keys
(`client_credentials.read_metadata`, `client_credentials.manage`) since
spec §41 explicitly requires credential metadata to never be implied by a
broad `clients.read` grant. This matches spec §65's closing instruction:
"Do not over-fragment if existing permission conventions suggest a cleaner
catalog." Role matrix for the two new credential keys: founder/director/
manager get both; everyone else gets neither (credential metadata is
opt-in-visible, not default-visible).

---

## 11. RLS

Every new table gets `enable row level security` immediately + named
`_select`/`_insert`/`_update` policies (no blanket `for all`), following the
`has_company_permission`/`has_org_permission` branch pattern from `0019`/`0013`.
`client_activity` gets no UPDATE/DELETE policy (append-only, service-role-only
writes, same as `project_activity`). `client_credentials` gets its own
distinct policies keyed on `client_credentials.read_metadata`/`.manage`, never
inherited from `clients.read`.

Contractor resource-scoping (spec §67, "a Contractor assigned to Project A
must not automatically gain full client access"): `has_project_access()`
already only narrows for `is_resource_scoped` roles — since `clients` isn't a
`projects` row, this needs a **new** function, `has_client_access(client_id,
permission_key)`, mirroring `has_project_access`'s shape: a normal
`company_members` role grant with `clients.read` works as today; **for a
contractor specifically**, access additionally requires the contractor to be
an active `project_members` row on **at least one project linked to that
client_id** (`projects.client_id = target_client_id`) — i.e., a contractor
sees a client only if they're actually staffed on a project for that client,
and per spec §67's "prefer least privilege," **a resource-scoped contractor
only ever gets the limited fields needed for their assigned project (name,
brand, primary contact, active projects) — never feedback, relationship
issues, credentials, or other clients' data**, enforced by a second, stricter
RLS policy branch specifically for the `is_resource_scoped` case (mirrored
after how `has_project_access` branches internally), not by hiding UI
elements alone.

RLS test matrix (per spec §68/81): same-company read, cross-company denial,
cross-org denial, resource-scoped contractor (staffed vs. not staffed),
viewer (read-only enforced), member, manager, founder, forged `client_id`,
forged `company_id`, forged `contact_id`, cross-company brand reference,
cross-company project/client linkage rejected by the integrity constraint.

---

## 12. Performance

Clients list avoids N+1 by construction: one query for `clients` (filtered/
sorted), one batched `.in("client_id", clientIds)` query each for linked
`projects` (for active/total counts + value derivation), `client_relationship_issues`
(open count), and `client_activity` (`last_interaction_at` — actually stored as
a denormalized column on `clients`, updated by the same service-role activity
writer, so the list page never has to aggregate timeline rows just to sort by
recency). Health is computed in-memory from the already-fetched batch, not a
per-row query. Indexes: `clients(company_id, status)`, `clients(company_id,
last_interaction_at)`, `client_contacts(client_id)`, `client_brands(client_id)`,
`projects(client_id)`, `client_activity(client_id, created_at)`,
`client_relationship_issues(client_id, status)`.

---

## 13. UI

**Sidebar**: one-line change — add `href` to the existing "Clients" entry
under OPERATIONS (`Sidebar.tsx`), removing its "Soon" state. No new nav rows
for Contacts/Brands/Feedback/Issues (spec §46) — all live inside the Client
Detail page.

**`/[companySlug]/clients`** (list): `PageHeader` (title "Clients", action =
"Add Client" button if `clients.create`) → filter/search row (status,
relationship health, has-active-projects, at-risk, recently-active — plain
DB-level filtering, no query builder) → `Card` wrapping a compact `ox-table`
(Client, Primary Contact, Status, Relationship, Active/Total Projects, Client
Since, Last Interaction, Value, Health) sorted with At Risk/Active/Recently
Updated prioritized. Empty state: "No clients yet." + "[Add Client]" (spec
§78, no illustration).

**`/[companySlug]/clients/[clientId]`** (detail): mirrors Project Detail's
`layout.tsx` + route-tab pattern exactly — header block (name, `StatusBadge`,
primary contact, relationship stage, client since, last interaction, actions:
Edit/Add Project/Add Note/Record Feedback) + `ProjectTabs`-style tab bar with
**Overview / Projects / Relationship / Timeline / Files** (spec §47, 5 tabs,
not 10+). `Relationship` tab internally contains Contacts, Preferences,
Feedback, Issues as sections (not sub-tabs) — matching the Team member
profile's flat card-grid convention where it fits better than more route
segments. `Files` tab renders the "not configured yet" deferred state (§Files
below) rather than an upload UI.

**Overview tab**: summary strip (Active Projects, Completed Projects, Lifetime
Value or "Not tracked", Relationship Health with "Why") → Current Projects →
Client Intelligence summary card (spec §32, deterministic) → Recent Timeline
→ Relationship Overview (top issues/preferences digest) → right rail
(Contacts, Brands, Risks, Opportunities) — using existing `Card`/`CardHeader`
components throughout, `ox-card`/`ox-pill` classes, no new visual language.

New feature-local components (following existing convention, not new generics):
`components/clients/ClientStatusBadge.tsx`, `ClientHealthBadge.tsx`,
`ClientTable.tsx`, `ClientForm.tsx` (create/edit), `ContactList.tsx`,
`BrandList.tsx`, `PreferenceList.tsx` (renders provenance chips: VERIFIED/
OBSERVED/AI INFERENCE + confidence), `FeedbackList.tsx`, `IssueList.tsx`,
`ClientTimeline.tsx`, `ClientIntelligenceSummary.tsx`,
`ClientCredentialsSection.tsx` (the "not configured yet" placeholder).

---

## 14. Files (documented, not built)

Supabase Storage has zero existing usage in this repo. Building bucket + RLS
+ upload UI from scratch is real scope beyond this phase (spec §45's own
instruction: "document the Storage/RLS design and defer binary uploads if
this would expand scope too much" — it would). Documented design for later:
a `client-files` bucket, one row per file in a new `client_files` metadata
table (`client_id`, `project_id` nullable, `storage_path`, `label`,
`file_type`, `uploaded_by`), storage RLS mirroring the table's own RLS
(`has_company_permission` check via a Postgres storage policy referencing
the metadata table). **Not implemented in v1** — the Files tab shows an
empty/deferred state.

---

## 15. Audit

Meaningful events audited (spec §64): client created, client archived, client
status changed, contact created/updated, preference verified, feedback added,
relationship issue created/resolved, credential metadata changed. Uses the
existing `writeAuditLog` helper verbatim — no new audit infrastructure.
Preference/note *content* is never put into `audit_logs.after_state` beyond
what's already redacted by `redactSecrets` (defense in depth, same as every
other resource type today).

---

## 16. Migration plan

Additive only, numbered sequentially from `0039`, following the observed
one-concern-per-migration convention:

```
0039_clients_core.sql            -- clients, client_contacts, client_brands + RLS
0040_clients_project_linking.sql -- projects.client_id/client_brand_id/primary_client_contact_id + integrity constraint
0041_clients_relationship.sql    -- client_notes, client_preferences, client_feedback, client_relationship_issues + RLS
0042_clients_activity.sql        -- client_activity (append-only) + RLS
0043_clients_credentials.sql     -- client_credentials (metadata only) + RLS
0044_clients_permissions.sql     -- client_credentials.read_metadata/.manage keys + role matrix
0045_clients_resource_scoping.sql -- has_client_access() function + contractor-narrowed RLS branch
0046_advisor_clients_read_tools.sql -- (pending your decision, §Open Decisions) grants advisor the 7 read-only clients.* tools
```
Each is independently reviewable and revertible; none touches historical
migrations.

---

## 17. Test plan

Mirrors spec §80/81 exactly:
- Unit: client create/update/archive, contact creation, brand creation,
  project/client linking, client value derivation (including "Not tracked"
  path), timeline event writing, preference provenance defaults, feedback
  creation, relationship issue lifecycle, health calculation (all 5 states
  with real fixture data), credential metadata never exposing a secret field
  (schema-level — there is no secret field to leak).
- Integration/RLS: same-company read, cross-company denial, cross-org denial,
  viewer write denial, member policy, contractor resource scope (staffed vs.
  unstaffed), founder full access, forged `client_id`/`company_id`/
  `contact_id`, cross-company brand/project/client linkage rejected.
- Action Engine: AI read tool permission enforcement, AI mutation goes through
  `executeTool`/propose-approve flow (never a direct table write), advisor
  agent's `allowed_tools` unaffected unless migration `0046` is explicitly
  approved, `clients.delete`(archive) requires explicit human approval
  (risk 2 ≥ advisor's `maxRiskLevel: 1`, so it can only ever be proposed by a
  human via the UI directly, never by the AI at all under the current advisor
  config).
- Performance: query count for Clients list (target: O(1) queries, not O(n)
  clients) — report actual count from code inspection post-implementation.

`npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` all run
before reporting done, plus a secret scan of the diff and RLS policy
inspection, matching the existing project workflow.

---

## 18. Deferred (explicitly out of scope this phase)

Calendar, Meeting Intelligence, external social-media research, numerology
API/Personal Lens (not even a stub), autonomous Client Agent, Finance/
Transactions integration, email/Gmail/WhatsApp/Drive/Notion integration,
OAuth connections, real password/secret reveal, forecasts beyond what's
derivable from real linked-project data, automatic personality profiling,
client file uploads (documented only), "current client in view" AI context
chip, promotion-to-Company-Brain flow for preferences, general non-project
`client_request` entity, splitting client-contact PII into a stricter
default-deny tier (flagged as an open decision, not silently deferred).

---

## 19. Open decisions requiring your input before implementation

1. **Advisor agent grant** (§7): grant the advisor the 7 read-only `clients.*`
   tools in this same pass (migration `0046`), or hold off until after you've
   used the feature manually for a while? Both are safe; this is a product
   choice, not a security one.
2. **Client-contact PII tier** (§9): keep birthday/personal phone/email as
   ordinary fields under `clients.read` (simpler, matches how the rest of the
   client record works), or split them into a stricter default-deny table
   like `user_private_profiles` (more consistent with how *internal* team
   PII is protected, but adds a table and a permission check most roles will
   never need)?
3. **Client value property matching** (§3): the "Value"/"Project Value"/
   "Price" custom-property name allow-list is a heuristic given there's no
   fixed schema field — acceptable for v1, or would you rather I add a real
   `estimated_value` column to `projects` in this same pass (a slightly
   bigger, but more correct, change)?

---

## Approval required: YES

This introduces 8 new tables, 2 new permission keys, a new RLS-authorization
function, new Action Engine tools, and new routes. Per AGENTS.md, implementation
does not begin until this document is approved — including the 3 open
decisions above.
