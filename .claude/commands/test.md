Create or update ONLY:

.claude/commands/test.md

Create the Orex OS /test command.

The command must tell Claude:

# /test

Read AGENTS.md and relevant test/security skills.

Determine which checks apply based on the actual changes.

At minimum evaluate:

type check
lint
unit tests
integration tests
production build
RLS tests
permission tests
manual feature tests
responsive UI tests
security tests

Do not report a test as passed unless it actually ran.

For each test report:

TEST

COMMAND / METHOD

RESULT

PASS / FAIL

DETAILS

If a test cannot run, report:

NOT RUN

and explain why.

Never hide failures.

End with:

OVERALL STATUS

FAILED CHECKS

UNTESTED AREAS

RECOMMENDED NEXT ACTION

Stop.