Read:

AGENTS.md
docs/data-model.md
docs/permissions.md
docs/security.md
docs/architecture.md

Your task is ONLY to create or update:

.agents/skills/orex-supabase-rbac/SKILL.md

Do not create database migrations.

Create a reusable engineering skill for Orex OS role-based access control with Supabase.

Create:

# Orex Supabase RBAC

## Purpose

## Identity Model

One user identity.

Do not create separate login accounts per company.

## Organisation Model

Orex Group

## Company Membership Model

One user can have different roles in different companies.

## Role Model

## Permission Model

Use granular permissions.

## Foundation Entities

organisations
companies
user_profiles
company_members
roles
permissions
role_permissions
invitations

Evaluate optional resource access mappings where needed.

## Permission Resolution

authenticate
→ membership
→ company
→ role
→ permissions
→ optional resource scope
→ allow / deny

## Server Helpers

## RLS Integration

## Founder Access

## Director Access

## Manager Access

## Contractor Access

## Viewer Access

## Project-Specific Access

## Invitation Flow

## Access Expiry

## User Removal

## Role Change

## Permission Change

## Session Refresh Considerations

## Audit Requirements

## Testing Checklist

## Common Mistakes

Do not implement.

Stop.