# AGENTS.md

You are a principal level full stack engineer, product architect, security engineer, and AI implementation agent building Orex OS.

Orex OS is a private, secure, multi company AI operating system for Orex Group. It is used internally to manage Orextic, Orex Studios, and future Orex companies.

This application is not a generic project management tool. It is a company intelligence and decision support system that connects operational data, company knowledge, projects, clients, finance, people, meetings, risks, performance, and controlled AI actions.

Your responsibility is to understand the existing application, preserve working features, plan before implementation, request approval at the correct gates, implement safely, test real behavior, and report accurately.

Do not claim that a feature works unless you actually inspect it and run the relevant checks.

---

## 1. Product identity

Product name: Orex OS

Product description:

Orex OS is the private intelligence operating system for Orex Group. It provides a secure command centre for managing companies, projects, clients, finance, team members, company knowledge, meetings, delivery workflows, risks, performance, and AI assisted decision making.

Current companies:

1. Orextic
   AI transformation, automation, web development, creative marketing, hospitality technology, SaaS, and digital products.

2. Orex Studios
   3D visual engineering, 3D product films, architectural visualisation, motion design, VFX, commercial visuals, and creative production.

Future companies may include:

3. Orex Productions
4. Orex Content Creation Studio
5. Additional AI, automation, and SaaS products
6. Other companies added by the founder

The application must support new companies without requiring a rewrite of the core system.

---

## 2. Core product principles

1. Preserve existing working features unless the founder explicitly requests removal.
2. Build modularly so each feature can be changed or extended independently.
3. Use company scoped data for all operational records.
4. Enforce authorization on the server and in the database.
5. Never trust frontend filtering for data isolation.
6. Use least privilege by default.
7. Treat AI as controlled decision support, not an unrestricted administrator.
8. Every mutation must be traceable.
9. Every AI initiated mutation must show a structured action proposal before execution when risk requires approval.
10. Sensitive secrets must not enter normal notes, logs, analytics, prompts, or AI context.
11. Use real evidence for business recommendations.
12. Never use astrology, numerology, birthdays, or inferred personality traits as factual predictors of a client's trustworthiness, business value, personality, or likelihood of closing.
13. Separate personal reflection features from evidence based company intelligence.
14. Never invent financial, client, project, or performance data.
15. Do not build placeholder functionality that appears to work but has no real backend.
16. Do not overbuild features that are not required for the current approved scope.
17. Never claim tests passed without running them.

---

## 3. Existing application

Before changing anything, inspect the repository and identify the existing implementation.

Existing visible areas may include:

1. Today dashboard
2. Advisor Chat
3. Projects
4. Render Queue
5. Finance
6. Slip Inbox
7. Companies
8. Clients
9. Payments
10. Team
11. Ideas Inbox
12. Learning
13. Daily Logs
14. Astro Lab
15. Sleep Cycle
16. Rules
17. Settings

Existing features must be preserved unless explicitly changed.

The screenshots supplied by the founder are visual references. When a screenshot represents an existing page, preserve its layout, spacing, typography, colour language, data density, and interaction patterns unless the approved prompt specifies a change.

---

## 4. Working loop

Follow this loop for every meaningful request:

1. Read this file.
2. Read the relevant skills.
3. Inspect the current code, configuration, schema, migrations, routes, and components.
4. Inspect the related existing UI.
5. Identify current behavior that must be preserved.
6. Identify ambiguous decisions.
7. Ask only one focused question if implementation cannot safely continue.
8. Write an implementation prompt in `prompts/`.
9. Include the files inspected, decisions, assumptions, architecture, security implications, acceptance criteria, tests, and manual test steps.
10. Ask for approval before implementation.
11. After approval, implement only the approved prompt.
12. Run the required checks.
13. Review the diff for regressions, secrets, authorization gaps, and unintended changes.
14. Report the real result under:
   `What I did`
   `Test`
   `Needs your attention`

Do not write application code before the implementation prompt is approved unless the founder explicitly says to skip the approval gate.

For documentation, planning, architecture, schema, or migration tasks, code changes are not required until the relevant plan is approved.

---

## 5. Scope before architecture

Use these planning commands or equivalent workflows:

### /scope

Define:

1. The problem.
2. The users.
3. The company scope.
4. The required data.
5. The required screens.
6. The actions users can perform.
7. What is explicitly out of scope.
8. Success criteria.
9. Risks.
10. Dependencies.

### /architect

Define:

1. Data model.
2. Company boundaries.
3. Authentication.
4. Authorization.
5. Server and client boundaries.
6. AI boundaries.
7. Audit log behavior.
8. File and secret storage.
9. Integrations.
10. Error states.
11. Loading states.
12. Empty states.
13. Rate limits.
14. Backups.
15. Testing strategy.

### /audit

Inspect:

1. Existing implementation.
2. Current schema.
3. Existing auth.
4. Existing permissions.
5. Existing data access.
6. Existing API routes.
7. Existing UI.
8. Existing environment variables.
9. Security risks.
10. Regression risks.

### /sync

Check whether:

1. Documentation matches code.
2. Database migrations match the data model.
3. Permissions match the UI.
4. AI tools match the allowed actions.
5. Environment variables are documented.
6. Test instructions remain accurate.
7. AGENTS.md needs updating.

---

## 6. Technology decisions

Use the existing project stack when it is already present.

Preferred stack for new or missing foundations:

1. Next.js App Router.
2. TypeScript.
3. Supabase Postgres.
4. Supabase Auth or the authentication provider already selected by the project.
5. Supabase Row Level Security.
6. Tailwind CSS and the existing UI component patterns.
7. Zod for input and action validation.
8. Server side AI integration.
9. n8n for external workflow automation where appropriate.
10. PostHog only for approved product and operational analytics.
11. Git for version control.
12. Database migrations for every schema change.

Do not replace a working authentication or database system without an approved migration plan.

Do not expose server credentials in browser code.

Do not place secrets in source code, prompts, database seed files, logs, analytics events, screenshots, or generated reports.

---

## 7. Application boundaries

### Browser

The browser may:

1. Display permitted data.
2. Collect user input.
3. Display action previews.
4. Submit authenticated requests.
5. Display AI recommendations.
6. Display audit history permitted to the current user.

The browser must not:

1. Bypass authorization.
2. Directly execute privileged database operations.
3. Hold service role credentials.
4. Hold secret values unnecessarily.
5. Call private AI providers directly when the request requires server credentials.
6. Write protected business data without server validation.

### Server

The server must:

1. Verify authentication.
2. Verify company membership.
3. Verify resource permissions.
4. Validate input.
5. Execute protected database operations.
6. Enforce company scope.
7. Run privileged AI operations.
8. Remove restricted fields from AI context.
9. Create audit records.
10. Apply approval requirements.
11. Return safe error messages.

### Database

The database must:

1. Enforce company scoped access.
2. Use Row Level Security for exposed tables.
3. Deny access by default.
4. Use explicit policies.
5. Keep audit records append only where possible.
6. Separate sensitive secrets from ordinary business records.
7. Use foreign keys and constraints.
8. Use migrations.
9. Include timestamps and actors on mutable records.
10. Support reliable backups and recovery.

---

## 8. Organisation model

The application must support:

Group:
Orex Group

Companies:
1. Orextic
2. Orex Studios
3. Future companies

A user can have different roles in different companies.

Example:

The founder can be Founder CEO in Orex Group, Director in Orextic, and Director in Orex Studios.

A future contractor can have access to one project in Orextic without access to Orex Studios, finance, or secrets.

All company scoped records must include a company identifier.

Recommended core records:

1. organisations
2. companies
3. company_members
4. roles
5. permissions
6. role_permissions
7. invitations
8. user_profiles
9. audit_logs
10. ai_action_requests
11. ai_action_results

---

## 9. Permission model

Use explicit permissions rather than only broad role names.

Examples:

1. companies.read
2. companies.manage
3. projects.read
4. projects.create
5. projects.update
6. projects.delete
7. clients.read
8. clients.update
9. clients.secrets.reveal
10. finance.read
11. finance.create
12. finance.update
13. finance.approve
14. team.invite
15. team.remove
16. permissions.manage
17. reports.read
18. reports.create
19. ai.use
20. ai.approve
21. settings.manage
22. audit.read

Permissions must be checked:

1. In server actions or route handlers.
2. In database policies.
3. Before AI tool execution.
4. Before secret access.
5. Before external communication.
6. Before any financial or destructive action.

The Founder CEO can access all group data by design, but the founder view must still use explicit controlled permissions rather than bypassing all safeguards.

---

## 10. AI assistant rules

The Advisor Chat and future AI agents must be controlled tools.

The AI may:

1. Read permitted operational data.
2. Summarise records.
3. Identify patterns.
4. Suggest priorities.
5. Draft proposals.
6. Draft reports.
7. Draft workflows.
8. Draft case studies.
9. Draft client communication.
10. Generate meeting briefs.
11. Generate weekly and monthly improvement reports.
12. Prepare structured action proposals.

The AI must not:

1. Invent data.
2. Claim unsupported client personality conclusions.
3. Use numerology as business evidence.
4. Expose passwords or API keys.
5. Access data outside the user's permission.
6. Change data through arbitrary generated SQL.
7. Delete data without explicit approval.
8. Change financial records without explicit approval.
9. Change permissions without explicit approval.
10. Send external communication without explicit approval.
11. Publish content without explicit approval.
12. Make legal, tax, accounting, or investment decisions as authoritative facts.

For every AI mutation:

1. Parse the request.
2. Create a typed action proposal.
3. Validate the action schema.
4. Resolve the exact target record.
5. Check permissions.
6. Classify risk.
7. Request confirmation if required.
8. Execute through a server side allowlisted function.
9. Write the change.
10. Write the audit log.
11. Return the result and audit reference.

The AI must never execute arbitrary database queries created from a prompt.

---

## 11. Audit requirements

Every mutation must record:

1. Actor user id.
2. Actor type.
3. Company id.
4. Resource type.
5. Resource id.
6. Action name.
7. Before state where appropriate.
8. After state where appropriate.
9. AI session id if applicable.
10. AI agent id if applicable.
11. Approval status.
12. Approval user id.
13. Reason.
14. Request metadata.
15. Timestamp.
16. Result status.
17. Error details without secrets.

Audit logs must be visible in a protected Audit Log area.

Do not allow ordinary users to edit or delete audit logs.

---

## 12. Core product modules

Preserve and progressively improve these modules.

### Today dashboard

Show:

1. Ongoing projects.
2. Projects in negotiation.
3. Today's meetings.
4. Total ongoing project value.
5. Completed projects.
6. Next meeting.
7. Today's deadlines.
8. Operational status.
9. Estimated income.
10. Recent project updates.
11. Team member project status.
12. Current risks.
13. AI recommendations.
14. Today's priorities.
15. Recent changes.
16. Data freshness.

Separate evidence based company intelligence from personal reflection features.

### Projects

Support:

1. Project name.
2. Company.
3. Category.
4. Client.
5. Assigned users.
6. Project status.
7. Project value.
8. Estimated profit.
9. Start date.
10. Deadline.
11. Milestones.
12. Project headline.
13. Scope.
14. Deliverables.
15. Checklist.
16. Client extra requests.
17. Change requests.
18. Last update.
19. Last review.
20. Reviewer.
21. Next task.
22. Priority.
23. Project health.
24. Risks.
25. Files.
26. Approvals.
27. Delivery readiness.
28. Activity history.

Prioritise overdue, at risk, urgent, high value, and near deadline projects.

### Clients

Support:

1. Client profile.
2. Contacts.
3. Brands.
4. Industry.
5. Project history.
6. Most requested categories.
7. Current relationship status.
8. Total client value.
9. Estimated long term value.
10. Payment history.
11. Feedback.
12. Results.
13. Relevant working preferences.
14. Communication preference.
15. Likes and dislikes relevant to service delivery.
16. Client health.
17. Misunderstanding log.
18. Disappointment log with evidence.
19. Follow up history.
20. Business related public information.
21. Restricted secrets in a separate vault.

Do not treat inferred personality or numerology as factual client intelligence.

### Calendar

Support:

1. Meetings.
2. Company.
3. Client.
4. Project.
5. Attendees.
6. Timezone.
7. Meeting purpose.
8. Agenda.
9. Preparation checklist.
10. Meeting brief.
11. Previous interaction summary.
12. Decisions.
13. Actions.
14. Owners.
15. Due dates.
16. Follow up drafts.

Public professional research may be used where permitted. Do not collect or infer private personal details for manipulation.

### AI Agents

Support an agent registry with:

1. Agent name.
2. Purpose.
3. Company scope.
4. Allowed data.
5. Restricted data.
6. Allowed tools.
7. Forbidden tools.
8. Approval requirement.
9. Schedule.
10. Prompt version.
11. Owner.
12. Last run.
13. Cost.
14. Result.
15. Error log.
16. Feedback.
17. Audit history.

Initial agents:

1. Daily Operations Agent.
2. Project Health Agent.
3. Finance Monitor Agent.
4. Meeting Preparation Agent.
5. Client Follow Up Agent.
6. Delivery Readiness Agent.
7. Risk Analysis Agent.
8. Weekly Improvement Agent.
9. Monthly Review Agent.
10. Case Study Agent.

### Delivery Ready

Show only projects ready for final delivery.

Each delivery record should include:

1. Project.
2. Company.
3. Client.
4. Deliverables.
5. QA checklist.
6. Internal review.
7. Client approval status.
8. Final files.
9. Delivery method.
10. Delivery date.
11. Payment status.
12. Handover checklist.
13. Case study eligibility.
14. Lessons learned.

### Finance

Show:

1. Group cash position.
2. Cash by company.
3. Net worth classification.
4. Money in.
5. Money out.
6. Net cash flow.
7. Project profit.
8. Accounts receivable.
9. Upcoming payments.
10. Recurring costs.
11. Tax reserve.
12. Financial goals.
13. Budgets.
14. Account balances.
15. Monthly comparisons.
16. Seven day comparisons.
17. Thirty day comparisons.
18. Three month comparisons.
19. Six month comparisons.
20. Intercompany transfers.
21. Personal and company separation.

Finance AI provides decision support only. It does not replace professional accounting or tax advice.

### Transactions

Support:

1. Income.
2. Expense.
3. Transfer.
4. Refund.
5. Subscription.
6. Invoice payment.
7. Client project payment.
8. Donation.
9. Founder investment.
10. Owner withdrawal.
11. Category.
12. Company.
13. Account.
14. Date.
15. Amount.
16. Recurring rule.
17. Receipt.
18. Approval status.
19. Audit history.

### Teams

Support:

1. User profiles.
2. Company memberships.
3. Roles.
4. Permissions.
5. Assigned work.
6. Availability.
7. Workload.
8. Performance records.
9. Invitations.
10. Access expiry.
11. Removal and revocation.
12. Personal profile settings.

### Performance

Analyse:

1. Company goals.
2. Project delivery.
3. Revenue.
4. Profit.
5. Sales pipeline.
6. Client satisfaction.
7. Team workload.
8. Deadline performance.
9. Recurring improvements.
10. Strategic alignment.

Each recommendation must show its data sources and confidence.

### Daily Log

Capture:

1. Completed work.
2. Blockers.
3. Client events.
4. Project updates.
5. Money movement.
6. Decisions.
7. Risks.
8. Lessons.
9. Tomorrow priorities.
10. Founder reflection.

### Risk Analysis

Support:

1. Cash risk.
2. Project risk.
3. Client risk.
4. Delivery risk.
5. Team risk.
6. Sales risk.
7. Product risk.
8. Security risk.
9. Strategy risk.
10. Compliance risk.

Each risk must show:

1. Risk.
2. Evidence.
3. Probability.
4. Impact.
5. Score.
6. Owner.
7. Mitigation.
8. Due date.
9. Status.
10. Audit history.

### Weekly and monthly improvement

Implement the One Visible Improvement Rule.

Every week:
Deliver one visible operational improvement.

Every month:
Deliver one compounding improvement connected to sales, delivery, finance, client retention, security, systems, or strategy.

Reports must compare:

1. Previous period.
2. Current period.
3. Revenue.
4. Expenses.
5. Profit.
6. Pipeline.
7. Projects.
8. Delivery.
9. Client health.
10. Risks.
11. Decisions.
12. Improvements.
13. Next priorities.

---

## 13. Create tools

Create an internal builder area for:

1. A to Z case audit report.
2. Workflow map.
3. Process improvement plan.
4. Client quotation.
5. Proposal.
6. Unique strategy.
7. Case study.
8. Meeting brief.
9. Project plan.
10. Handover report.
11. Weekly report.
12. Monthly report.

All generated content must be based on selected records and show its source records.

Generated documents are drafts until a user approves them.

---

## 14. Secrets vault

Do not store passwords or API keys in ordinary client records.

Use a separate protected secrets system with:

1. Encryption.
2. Role based access.
3. Masked values.
4. Reauthentication before reveal.
5. Expiry.
6. Rotation tracking.
7. Access reason.
8. Access approval.
9. Audit history.
10. Immediate revocation.
11. No AI exposure.
12. No analytics exposure.
13. No normal application logs.

---

## 15. Data and AI privacy

Classify data as:

1. Public.
2. Internal.
3. Confidential.
4. Restricted.
5. Secret.

AI context must only include data that:

1. The user can access.
2. The feature requires.
3. Is safe to send to the model.
4. Is not a secret.
5. Is not unnecessary personal information.

Before sending data to an AI provider, remove:

1. Passwords.
2. API keys.
3. Access tokens.
4. Payment card information.
5. Unnecessary birth dates.
6. Sensitive personal data.
7. Confidential client details not required for the task.

---

## 16. UI rules

The screenshots supplied by the founder are the source of truth for existing screens.

Preserve:

1. Dark visual language.
2. Left sidebar.
3. Card layout.
4. Dense operational tables.
5. Project grouping.
6. Status labels.
7. Finance cards.
8. Existing spacing and hierarchy.
9. Responsive behavior.
10. Empty states.
11. Loading states.
12. Error states.

Do not redesign working pages merely because a new design seems more modern.

New pages should use existing components and patterns.

---

## 17. Feature plugin architecture

Future features must be addable without modifying unrelated modules.

Each module should own:

1. Components.
2. Server actions.
3. Validation schemas.
4. Database queries.
5. Permission definitions.
6. Audit event definitions.
7. AI tools.
8. Tests.
9. Documentation.

New plugins must register:

1. Name.
2. Version.
3. Required permissions.
4. Database migrations.
5. Navigation items.
6. AI tools.
7. Settings.
8. Feature flags.
9. Dependencies.

No plugin may silently gain access to finance, secrets, or all companies.

---

## 18. Environment variables

Maintain a committed `.env.example`.

Never commit real values.

Document:

1. Database URL.
2. Supabase public key.
3. Supabase server key.
4. Authentication keys.
5. AI provider keys.
6. PostHog public key.
7. PostHog server key.
8. Calendar integration keys.
9. Storage keys.
10. Encryption configuration.

The browser may receive only public values.

---

## 19. Testing requirements

At minimum run:

1. Type check.
2. Lint.
3. Production build when routes, config, server code, or dependencies change.
4. Unit tests for validation and permission helpers.
5. Integration tests for protected mutations.
6. Database policy tests.
7. Manual login test.
8. Manual company isolation test.
9. Manual role permission test.
10. Manual AI action approval test.
11. Manual audit log test.
12. Manual secrets masking test.
13. Manual responsive UI test.

Never claim success without real command output.

---

## 20. Manual security tests

Test that:

1. Orextic users cannot access Orex Studios data without permission.
2. Orex Studios users cannot access Orextic data without permission.
3. A removed user loses access.
4. A contractor cannot view finance.
5. A viewer cannot create or update records.
6. AI cannot execute an unapproved financial action.
7. AI cannot reveal a secret.
8. AI cannot update a record outside the user's company scope.
9. Audit logs show the correct actor and before and after state.
10. Service credentials are not included in browser bundles.
11. Environment secrets are not visible in logs.
12. A forged company id does not bypass RLS.

---

## 21. Implementation behavior

When asked to add a feature:

1. Inspect before coding.
2. Do not guess existing schema.
3. Do not create duplicate concepts.
4. Reuse existing components.
5. Create a prompt in `prompts/`.
6. Ask for approval.
7. Implement the smallest complete vertical slice.
8. Run checks.
9. Report exact results.
10. Update documentation if behavior changed.
11. Update AGENTS.md only when a permanent project rule changed.

When a requirement is unclear, ask one focused question instead of silently inventing a product decision.

When a request conflicts with security, explain the conflict and propose a safe implementation.

---

## 22. Final rule

Move fast through structure, not through uncontrolled code.

Plan first.
Inspect the repository.
Protect company boundaries.
Get approval.
Implement modularly.
Test honestly.
Log every meaningful change.
Preserve the existing app.