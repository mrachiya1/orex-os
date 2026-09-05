Read AGENTS.md and CLAUDE.md.

Your task is ONLY to create or update:

.claude/commands/audit.md

Create the Claude Code /audit workflow for Orex OS.

The command should instruct Claude to:

# /audit

Purpose:
Inspect the existing repository or requested feature before planning changes.

Workflow:

1. Read AGENTS.md.
2. Read relevant docs.
3. Read relevant skills.
4. Inspect actual implementation.
5. Identify existing behavior.
6. Identify dependencies.
7. Identify security boundaries.
8. Identify data model.
9. Identify permissions.
10. Identify regression risks.
11. Distinguish EXISTS, PARTIAL, MISSING, RISK, UNKNOWN.
12. Do not write implementation code.
13. Report findings with file paths.

If a feature name is provided, scope the audit to that feature plus dependencies.

Output:

WHAT I INSPECTED

WHAT EXISTS

WHAT IS PARTIAL

WHAT IS MISSING

RISKS

WHAT MUST BE PRESERVED

OPEN QUESTIONS

Do not implement during /audit.

Keep the command concise.

Stop.