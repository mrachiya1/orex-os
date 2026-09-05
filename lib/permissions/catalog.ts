/**
 * Phase 001 permission catalog. Must stay in sync with the seed data in
 * supabase/migrations/0002_roles_permissions.sql and docs/permissions.md.
 */
export const PERMISSIONS = {
  COMPANIES_READ: "companies.read",
  COMPANIES_CREATE: "companies.create",
  COMPANIES_UPDATE: "companies.update",
  COMPANIES_MANAGE: "companies.manage",

  PROJECTS_READ: "projects.read",
  PROJECTS_CREATE: "projects.create",
  PROJECTS_UPDATE: "projects.update",
  PROJECTS_DELETE: "projects.delete",
  PROJECTS_ASSIGN: "projects.assign",
  PROJECTS_APPROVE: "projects.approve",

  CLIENTS_READ: "clients.read",
  CLIENTS_CREATE: "clients.create",
  CLIENTS_UPDATE: "clients.update",
  CLIENTS_DELETE: "clients.delete",

  FINANCE_READ: "finance.read",
  FINANCE_CREATE: "finance.create",
  FINANCE_UPDATE: "finance.update",
  FINANCE_APPROVE: "finance.approve",

  TRANSACTIONS_READ: "transactions.read",
  TRANSACTIONS_CREATE: "transactions.create",
  TRANSACTIONS_UPDATE: "transactions.update",
  TRANSACTIONS_APPROVE: "transactions.approve",

  TEAM_READ: "team.read",
  TEAM_INVITE: "team.invite",
  TEAM_UPDATE: "team.update",
  TEAM_REMOVE: "team.remove",

  PERMISSIONS_READ: "permissions.read",
  PERMISSIONS_MANAGE: "permissions.manage",

  REPORTS_READ: "reports.read",
  REPORTS_CREATE: "reports.create",

  AI_USE: "ai.use",
  AI_APPROVE: "ai.approve",
  AI_MANAGE: "ai.manage",

  AUDIT_READ: "audit.read",

  SETTINGS_MANAGE: "settings.manage",

  SECRETS_READ: "secrets.read",
  SECRETS_REVEAL: "secrets.reveal",
  SECRETS_MANAGE: "secrets.manage",

  KNOWLEDGE_READ: "knowledge.read",
  KNOWLEDGE_CREATE: "knowledge.create",
  KNOWLEDGE_UPDATE: "knowledge.update",
  KNOWLEDGE_VERIFY: "knowledge.verify",
  KNOWLEDGE_MANAGE: "knowledge.manage",

  DECISIONS_READ: "decisions.read",
  DECISIONS_CREATE: "decisions.create",
  DECISIONS_UPDATE: "decisions.update",
  DECISIONS_REVIEW: "decisions.review",

  DELIVERABLES_READ: "deliverables.read",
  DELIVERABLES_CREATE: "deliverables.create",
  DELIVERABLES_UPDATE: "deliverables.update",
  DELIVERABLES_APPROVE: "deliverables.approve",
  DELIVERABLES_DELIVER: "deliverables.deliver",

  SCOPE_CHANGES_READ: "scope_changes.read",
  SCOPE_CHANGES_CREATE: "scope_changes.create",
  SCOPE_CHANGES_APPROVE: "scope_changes.approve",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
