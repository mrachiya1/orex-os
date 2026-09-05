Create or update ONLY:

.claude/commands/security-review.md

Create the Orex OS /security-review command.

The command should instruct Claude:

# /security-review

Inspect only actual implementation.

Read:

AGENTS.md
docs/security.md
docs/permissions.md
relevant security skills

Review:

authentication
authorization
company isolation
RLS
service credentials
API routes
server actions
input validation
finance
AI context
AI tools
secrets
audit logs
environment variables
file storage
invitations
access revocation

Explicitly test or inspect for:

cross-company leakage
frontend-only authorization
service-role misuse
secret exposure
missing validation
AI permission bypass
financial action bypass
missing audits
unsafe deletion
forged company IDs

Classify findings:

CRITICAL
HIGH
MEDIUM
LOW
INFORMATIONAL

For every finding show:

problem
location
impact
evidence
recommended fix

Do not fix issues automatically unless the current approved prompt authorizes implementation.

Output:

SECURITY STATUS

FINDINGS

TESTS PERFORMED

UNVERIFIED AREAS

RECOMMENDED ACTIONS

Stop.