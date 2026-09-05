# Projects Intelligence Strip, Richer Rows, Bottom Panels

## Status

IMPLEMENTED, PARTIAL (2026-09-05). Continuation of `prompts/007`/`008`. This pass adds the page-level intelligence layer (top insight strip, Urgent & Upcoming, bottom Recent Activity/Upcoming Deadlines/Client Requests panels), a richer Project cell (thumbnail placeholder + headline + client/code), a `client_requests` column, and a combined "+ New" (Project/Folder) menu. No new schema this round — pure UI + reuse of existing actions/data already verified in prior passes. Filter tabs (My Projects/Due This Week/Delivery Ready/Archived) were **not** built this round — flagged, not silently dropped.

## What's real vs. omitted

Per the explicit "do not show fake values" instruction: Urgent Projects, Near Deadlines, Active Projects, and Pending Client Requests are all real counts over the same rows the table renders (`lib/projects/insights.ts`, unit-tested). "Project Value in Pipeline" and "Reviews Needed" are **omitted entirely** — both need schema (`projects.value_amount`, `last_reviewed_at`) that was explicitly deferred in `prompts/007`'s Remaining Gaps and still hasn't been approved, so showing them with a fake or "—" value would be worse than not showing the card at all.

## Files created

`lib/projects/insights.ts` (+test file), `components/projects/database/{ProjectsInsights,ProjectsBottomPanels,NewMenu}.tsx`.

## Files modified

`app/(app)/[companySlug]/projects/page.tsx` (fetches company-wide activity/deadlines/scope-changes for the new panels), `components/projects/database/ProjectDatabase.tsx` (richer project cell, `client_requests` column, `NewMenu` in place of the plain New Project button), `lib/projects/system-properties.ts` (+`client_requests`). Deleted (dead code, fully superseded): `components/projects/NewProjectButton.tsx`.

## Remaining Gaps

- Filter tabs (My Projects / Due This Week / Delivery Ready / Archived) — not built; folder filtering is the only quick-filter today.
- Board/Gallery views — not built (Table remains the only view, as explicitly permitted by "may be implemented only if the underlying architecture supports them safely").
- Multi-avatar "Assigned" (currently a single `lead_id`, unchanged since `prompts/007`).
- Thumbnails remain icon placeholders — no Storage integration yet.
- Project Value in Pipeline / Reviews Needed insight cards — omitted, need the deferred schema.
