# /sync

Purpose: check that Orex OS's documentation, specifications, and actual implementation still agree — catch drift before it misleads the next planning pass.

## Read

- `AGENTS.md`, `CLAUDE.md`
- Everything under `docs/` (including `docs/ai/`)
- Every `prompts/NNN-*.md` whose Status is IMPLEMENTED or CLOSED
- Relevant `.agents/skills/*/SKILL.md` files
- The actual implementation: migrations, `lib/`, `app/actions/`, `app/(app)/`, `components/`

Never trust a planning document's description of "what exists" without checking the code — prior phases have shown docs can describe a Future Entity that's already been built, or claim an area is "not applicable" after a later phase implemented it.

## Compare

- Documentation vs. code (does `docs/*.md` describe what's actually there?)
- Data model docs vs. real migrations (table/column names, constraints)
- `docs/permissions.md` vs. `lib/permissions/catalog.ts` vs. seeded `role_permissions` rows
- Permissions vs. RLS (does every permission check in server actions have a matching RLS policy, and vice versa?)
- UI-visible actions vs. actual permission gates (does a hidden/shown button match what the server would actually allow?)
- AI tools/aliases vs. `docs/ai/ai-action-policy.md` and `docs/ai/model-routing.md`
- Environment variables referenced in code vs. `.env.example`
- Test file coverage vs. actual current behavior (a test asserting behavior that code no longer has)
- `docs/design-system.md` vs. components actually implemented under `components/`

## Identify

For each area compared, classify as one of:

- **MATCHES** — documentation accurately reflects the current implementation.
- **OUT OF SYNC** — documentation exists but contradicts the current implementation (wrong field name, wrong permission, wrong table).
- **STALE** — documentation was accurate for an earlier phase but hasn't been updated to reflect a later phase that changed the area (e.g., "not applicable — out of scope for this phase" after a later phase implemented it).
- **MISSING** — the implementation exists but no documentation describes it, or documentation describes a planned area with no corresponding real content.

## Rules

- Do not modify application code from this command.
- Only update documentation directly if the task that invoked `/sync` explicitly authorizes documentation synchronization (e.g., a phase-closure instruction saying "correct any documentation drift found"). Otherwise, report proposed updates and stop — let the founder decide whether to apply them.
- Be specific: name the file, the section, and the exact discrepancy — "docs/permissions.md doesn't list scope_changes.approve" not "permissions docs may be incomplete."

## Output

```
# SYNC STATUS

# MATCHING AREAS

# OUT-OF-SYNC AREAS

# STALE DOCUMENTATION

# MISSING DOCUMENTATION

# RECOMMENDED UPDATES
```

Then stop.
