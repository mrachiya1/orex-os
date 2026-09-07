# 017 — Navigation & Route Performance Optimization

## Problem

Sidebar navigation (Today, Projects, Company Brain, Orex Intelligence, Decisions,
People) feels slow in production on Vercel — a noticeable delay between click and
next screen.

This is a **performance-only** change. No UI redesign, no new features, no schema
changes, no security relaxation.

## Files inspected

- `components/shell/Sidebar.tsx`, `components/company/CompanySwitcher.tsx`
- `app/layout.tsx`, `app/(app)/layout.tsx`, `app/(app)/[companySlug]/layout.tsx`,
  `app/(app)/group/layout.tsx`
- `middleware.ts`
- `lib/auth/session.ts` (`getCurrentUser`, `requireCurrentUser`)
- `lib/database/companies.ts` (`getCompanyBySlug`)
- `lib/database/profile.ts` (`getSidebarIdentity`)
- `lib/database/server.ts` (`createServerSupabaseClient`)
- `lib/permissions/index.ts` (`hasPermission`, `hasOrgPermission`, `hasProjectAccess`, `require*`)
- Route pages: `app/(app)/[companySlug]/page.tsx` (Today),
  `app/(app)/[companySlug]/projects/page.tsx`,
  `app/(app)/[companySlug]/brain/page.tsx`,
  `app/(app)/[companySlug]/intelligence/page.tsx`,
  `app/(app)/[companySlug]/brain/decisions/page.tsx`,
  `app/(app)/[companySlug]/team/page.tsx`
- `app/actions/agents.ts`, `app/actions/team.ts`, `lib/intelligence/context.ts`
- Repo-wide grep for `force-dynamic`, `noStore`, `revalidate = 0`, `cache: 'no-store'`,
  `loading.tsx` — none found anywhere.

## Root causes found (measured via code inspection, not runtime profiling — no
APM/tracing is wired into this project, so timings below are structural, not ms-measured)

1. **No `loading.tsx` anywhere in the app.** Every click blocks on the full
   server response with zero instant feedback. This is the single biggest
   perceived-latency contributor.
2. **No request-level memoization** of `getCurrentUser`/`requireCurrentUser`,
   `getCompanyBySlug`, `getSidebarIdentity`, or the `hasPermission`/`hasOrgPermission`
   family. Each call creates a fresh Supabase client and does a fresh network/DB
   round trip, even when called multiple times for the same request with the same
   arguments.
   - `requireCurrentUser()` → `auth.getUser()` is called 3–7+ times per single
     navigation (once in `(app)/layout.tsx`, once in `[companySlug]/layout.tsx`,
     once inside `listMyCompanies()`, once again in the page itself, and once
     more per server action the page calls that re-resolves the user —
     Intelligence is worst, at ~5 extra).
   - `getCompanyBySlug(slug)` is called once in `[companySlug]/layout.tsx` and
     again in every page under it (20 call sites total) — same row, fetched twice.
   - `getSidebarIdentity(...)` is called once in the layout (for the sidebar) and
     again in the Today page (for the greeting) — same data, fetched twice.
3. **Middleware is already correctly optimized** (`middleware.ts` uses
   `getSession()`, not `getUser()`, specifically to avoid a network round trip on
   every navigation — documented in its own comment). The redundant `getUser()`
   calls happen *downstream* in layouts/pages/actions, undoing that optimization.
4. Today page has a **3-stage sequential waterfall**: company →
   (`Promise.all` of user+identity+org) → projects query → (`Promise.all` of
   tasks/decisions/activity/deliverables). The projects query is a genuine
   dependency (need `projectIds` for the next stage) so this stage can't be fully
   flattened, but it is currently not parallelized with anything else it could be.
5. Existing parallelization is mostly good: every route already groups its
   independent queries into `Promise.all` at each stage. No N+1 loops were found
   in any of the 6 target routes — all multi-row lookups use batched
   `.in("project_id", projectIds)` queries.
6. Sidebar is a `"use client"` component using `usePathname()` (expected, needed
   for active-link styling) with no heavy third-party libraries — bundle size is
   not a meaningful contributor.
7. No explicit `force-dynamic`/`noStore`/`revalidate=0` found anywhere — dynamism
   comes implicitly from every page reading cookies via the Supabase SSR client.
   This is required for per-user/per-company data and must not change.
8. Vercel function region and Supabase project region are not discoverable from
   the repo (no `vercel.json`, no region docs). **Flagging, not changing** — if
   they differ, cross-region round trips would compound every one of the auth/DB
   calls above. Founder should check both dashboards; I can wire up `vercel.json`
   `regions` once told the Supabase project's region.

## Decisions / approach

1. **Add `React.cache()` wrappers** around the per-request-hot helpers so that
   multiple calls with the same arguments within a single request resolve to one
   underlying network/DB call, instead of one per call site:
   - `getCurrentUser` / `requireCurrentUser` (`lib/auth/session.ts`)
   - `getCompanyBySlug` (`lib/database/companies.ts`)
   - `getSidebarIdentity` (`lib/database/profile.ts`)
   - `createServerSupabaseClient` itself is **not** cached (it must stay
     per-invocation-safe since it reads cookies via `await cookies()`, and RLS
     correctness must not depend on client reuse) — only the *result* of read
     helpers built on top of it is cached.
   - `React.cache()` is scoped to a single server render pass (per request, per
     server) and is never shared across users or requests — it does not create
     cross-user cache leakage. This is the correct primitive per Next.js docs for
     this exact "same data needed in layout and page" case.
   - `hasPermission`/`hasOrgPermission`/`hasProjectAccess` will also get
     `React.cache()` wrappers keyed on their exact arguments (user id implicit via
     the authenticated Supabase client + companyId/permission strings) so repeated
     identical checks within one request dedupe, while different arguments
     (different permission strings) still each individually check the DB —
     no permission check is skipped or weakened.
2. **Do not touch RLS, do not touch the service role, do not weaken any
   permission check.** Caching is strictly request-scoped and per-authenticated-
   session; nothing is cached across users, across companies, or across requests.
3. **Add `loading.tsx`** for the 6 target route segments (or their shared
   `[companySlug]` parent segment plus per-route overrides where content differs
   enough to warrant it) using existing Orex OS skeleton/loading patterns already
   in the design system (checking `components/ui` for an existing skeleton
   primitive first; if none exists, build a minimal skeleton matching current
   card/table layout density — not a spinner).
4. **Flatten the Today-page waterfall where safe**: keep the
   company→user+identity+org stage as-is (genuine dependency), but move the
   `projects` query to start in parallel with that first `Promise.all` instead of
   after it, since `projects` only depends on `company.id` (already available
   after the `getCompanyBySlug` call), not on the user/identity/org results.
5. **De-duplicate the layout↔page double-fetch**: rather than re-fetching
   `getCompanyBySlug` and `getSidebarIdentity` in each page, the `React.cache()`
   wrapper (point 1) makes the second call free (same request, same args) without
   needing to thread props down or restructure the component tree — smallest,
   safest change.
6. **Sidebar `<Link>` prefetching**: confirm default Next.js prefetch behavior is
   sufficient (it is, for static parts of the route); do not add manual
   `router.prefetch()` calls, since the actual bottleneck is server-side data
   fetching, not missing prefetch — adding prefetch on top of a slow server
   response would just move Supabase load earlier without fixing perceived
   latency as effectively as `loading.tsx` + caching does. (Will revisit if
   founder wants hover-prefetch after measuring the above fixes.)
7. **Streaming secondary content**: wrap clearly-secondary sections (Today's
   "recent activity"/AI recommendations equivalent, Intelligence's
   `getRecentActivity`/`getControlRoomSummary`, Projects' activity feed) in
   `<Suspense>` with a lightweight fallback so primary content (project
   table/list, page title) can paint before secondary widgets resolve — only
   where this doesn't change data shape or break existing error handling
   (the `.catch()`-wrapped calls in Intelligence are natural Suspense
   candidates).
8. **Do not** add `unstable_cache`/ISR/`revalidate` to any of these routes — all
   6 routes render per-user, per-company, permission-gated data; caching across
   requests would be a security regression (stale permission state, cross-session
   data). Explicitly out of scope per AGENTS.md §7.

## Security implications

- `React.cache()` is per-request/per-render only (Next.js request-scoped memoization
  via React's server-only cache), never persisted, never shared across users,
  never shared across concurrent requests. It does not touch RLS. It does not
  bypass any permission check — it only avoids re-running an *identical* check
  (same user session, same arguments) twice in the same request.
  Different companies, different users, different permission strings all still
  independently hit the database.
- No service-role client is introduced or reused for these reads.
- No permission check is removed, weakened, or short-circuited.
- Middleware behavior is unchanged.

## Acceptance criteria

- [ ] `getCurrentUser`, `requireCurrentUser`, `getCompanyBySlug`, `getSidebarIdentity`,
      `hasPermission`, `hasOrgPermission`, `hasProjectAccess` wrapped in `React.cache()`.
- [ ] `loading.tsx` present for the 6 target routes (or shared parent + overrides),
      using skeleton UI consistent with existing card/table density — no giant spinners.
- [ ] Today page's `projects` query runs in parallel with the first `Promise.all`
      stage rather than after it.
- [ ] Secondary/non-critical data (recent activity, AI/agent summaries) streamed
      via `Suspense` where it doesn't change existing error-handling behavior.
- [ ] No `force-dynamic`, `noStore`, or `revalidate` directives added or removed.
- [ ] No RLS policy changes. No service-role usage introduced.
- [ ] Query count per route documented before/after (from code inspection, since
      no APM is wired in).
- [ ] `npm run typecheck`, `npm run lint`, `npm run build` pass. Existing test
      suite (if any) passes.

## Manual test steps (post-implementation)

1. Sign in as a normal (non-founder) user in Orextic; click through all 6 sidebar
   routes; confirm each still shows only Orextic-scoped data.
2. Repeat as an Orex Studios user; confirm no Orextic data leaks.
3. Confirm a contractor/limited-permission user still gets permission-gated
   redirects/early-returns on Intelligence/Team exactly as before (no
   permission check silently passing due to caching).
4. Confirm sign-out then sign back in as a different user in the same browser
   session shows the correct new user's data (no stale cached identity from
   `React.cache()` — this should be structurally impossible since the cache is
   per-request, but verify).
5. Visually confirm `loading.tsx` skeletons appear immediately on click for each
   of the 6 routes and match existing dark theme / spacing / density.
6. Confirm deep links (e.g. a shared Decisions URL) still work.

## Out of scope (explicitly)

- Any UI redesign or visual change beyond adding loading skeletons.
- Changing Vercel or Supabase region (flagged only — needs founder's Supabase
  dashboard region to act on).
- ISR/ `revalidate`/cross-request caching of any private data.
- Database index changes (no slow-query evidence gathered yet — would need
  `EXPLAIN` output from the founder's Supabase project, which isn't accessible
  from this environment).
