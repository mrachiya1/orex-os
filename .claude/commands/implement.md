Create or update ONLY:

.claude/commands/implement.md

Create the Orex OS /implement command.

This is the most important command.

It must tell Claude:

# /implement

Implementation is allowed only when an approved implementation prompt exists.

Before writing code:

1. Read AGENTS.md.
2. Read CLAUDE.md.
3. Read the approved prompts/<phase>.md.
4. Read relevant docs.
5. Read relevant skills.
6. Inspect the current implementation again.
7. Confirm the requested scope matches the approved prompt.

Then:

Implement only approved scope.

Rules:

Do not silently add future features.

Do not remove working behavior.

Reuse existing components.

Use migrations for schema changes.

Enforce server permissions.

Use RLS where applicable.

Validate inputs.

Create audit events.

Use approved AI gateway for AI functionality.

Never expose secrets.

After implementation:

run required tests
review diff
check security
check regressions
update documentation when actual behavior changed

Final output:

WHAT I DID

FILES CHANGED

DATABASE CHANGES

TEST RESULTS

SECURITY REVIEW

REGRESSION REVIEW

NEEDS YOUR ATTENTION

Never claim success without running the tests.

Stop after reporting.