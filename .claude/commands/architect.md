Create or update ONLY:

.claude/commands/architect.md

Create the Orex OS /architect command.

The command must tell Claude:

# /architect

Run only after the relevant scope and audit exist.

Read:

AGENTS.md
relevant scope
relevant audit
architecture docs
data model
permissions
security
relevant skills

Design:

data model
module boundaries
browser/server boundaries
authentication
authorization
company isolation
RLS
AI boundaries
audit behavior
storage
integrations
error states
loading states
empty states
background work
rate limits
testing strategy
migration safety

Architecture must preserve working behavior.

Do not implement code.

If a meaningful architectural choice should be permanent, identify that an ADR may be required.

Output:

ARCHITECTURE SUMMARY

DATA FLOW

DATA MODEL IMPACT

AUTHORIZATION

SECURITY

FILES LIKELY TO CHANGE

MIGRATIONS PROPOSED

TEST STRATEGY

RISKS

DECISIONS REQUIRED

Stop.