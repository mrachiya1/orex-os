import { createServerSupabaseClient } from "@/lib/database/server";
import { PERMISSIONS } from "@/lib/permissions";
import {
  clientsSearchInputSchema,
  clientsGetInputSchema,
  clientsListInputSchema,
} from "./schemas";
import type { ToolDefinition } from "./types";

/**
 * Clients Intelligence V1 read tools (prompts/017-clients-intelligence-
 * v1.md section 7/19). All risk 0 (read only) -- these are the only
 * clients.* tools granted to the advisor agent (migration 0045). No
 * mutation tool exists here; a `clients.note.create`-style tool is
 * explicitly deferred until the founder approves AI-initiated client
 * mutations. Every handler uses the normal authenticated Supabase client
 * (never service-role), so RLS's has_client_access/has_company_permission
 * is the real backstop even if authorizeToolCall were somehow bypassed --
 * same trust model as lib/ai/tools/projects.ts.
 */

export interface ClientSearchResult {
  id: string;
  name: string;
  status: string;
  relationshipStage: string;
}

const clientsSearch: ToolDefinition<{ companyId: string; query: string }, ClientSearchResult[]> = {
  name: "clients.search",
  description: "Search this company's clients by name. Read-only.",
  domain: "clients",
  requiredPermission: PERMISSIONS.CLIENTS_READ,
  scopeType: "company",
  riskLevel: 0,
  inputSchema: clientsSearchInputSchema,
  async handler(input) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, status, relationship_stage")
      .eq("company_id", input.companyId)
      .is("archived_at", null)
      .ilike("name", `%${input.query}%`)
      .order("updated_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return (data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      relationshipStage: c.relationship_stage,
    }));
  },
};

export interface ClientDetail {
  id: string;
  name: string;
  status: string;
  relationshipStage: string;
  primaryContact: string | null;
  website: string | null;
  industry: string | null;
  lastInteractionAt: string | null;
}

const clientsGet: ToolDefinition<{ clientId: string }, ClientDetail> = {
  name: "clients.get",
  description: "Get identity/status detail for one client: name, status, relationship stage, primary contact.",
  domain: "clients",
  requiredPermission: PERMISSIONS.CLIENTS_READ,
  scopeType: "client",
  riskLevel: 0,
  inputSchema: clientsGetInputSchema,
  async handler(input) {
    const supabase = await createServerSupabaseClient();
    const [{ data: client, error }, { data: contacts }] = await Promise.all([
      supabase
        .from("clients")
        .select("id, name, status, relationship_stage, website, industry, last_interaction_at")
        .eq("id", input.clientId)
        .maybeSingle(),
      supabase
        .from("client_contacts")
        .select("first_name, last_name")
        .eq("client_id", input.clientId)
        .eq("is_primary_contact", true)
        .limit(1),
    ]);
    if (error) throw new Error(error.message);
    if (!client) throw new Error("Client not found");
    const primary = contacts?.[0];

    return {
      id: client.id,
      name: client.name,
      status: client.status,
      relationshipStage: client.relationship_stage,
      primaryContact: primary ? [primary.first_name, primary.last_name].filter(Boolean).join(" ") : null,
      website: client.website,
      industry: client.industry,
      lastInteractionAt: client.last_interaction_at,
    };
  },
};

export interface ClientProject {
  id: string;
  name: string;
  status: string;
  targetDate: string | null;
}

const clientsProjectsList: ToolDefinition<import("zod").infer<typeof clientsListInputSchema>, ClientProject[]> = {
  name: "clients.projects.list",
  description: "List projects linked to a client, with status and target date.",
  domain: "clients",
  requiredPermission: PERMISSIONS.CLIENTS_READ,
  scopeType: "client",
  riskLevel: 0,
  inputSchema: clientsListInputSchema,
  async handler(input) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, status, target_date")
      .eq("client_id", input.clientId)
      .order("updated_at", { ascending: false })
      .limit(input.limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map((p) => ({ id: p.id, name: p.name, status: p.status, targetDate: p.target_date }));
  },
};

export interface ClientTimelineEvent {
  id: string;
  eventType: string;
  summary: string;
  createdAt: string;
}

const clientsTimelineList: ToolDefinition<import("zod").infer<typeof clientsListInputSchema>, ClientTimelineEvent[]> = {
  name: "clients.timeline.list",
  description: "List recent timeline/activity events for a client, most recent first.",
  domain: "clients",
  requiredPermission: PERMISSIONS.CLIENTS_READ,
  scopeType: "client",
  riskLevel: 0,
  inputSchema: clientsListInputSchema,
  async handler(input) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("client_activity")
      .select("id, event_type, summary, created_at")
      .eq("client_id", input.clientId)
      .order("created_at", { ascending: false })
      .limit(input.limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map((e) => ({ id: e.id, eventType: e.event_type, summary: e.summary, createdAt: e.created_at }));
  },
};

export interface ClientPreferenceRow {
  id: string;
  statement: string;
  sentiment: string;
  knowledgeType: string;
  confidence: number | null;
}

const clientsPreferencesList: ToolDefinition<import("zod").infer<typeof clientsListInputSchema>, ClientPreferenceRow[]> = {
  name: "clients.preferences.list",
  description: "List recorded preferences for a client, with provenance (verified/observed/inference).",
  domain: "clients",
  requiredPermission: PERMISSIONS.CLIENTS_READ,
  scopeType: "client",
  riskLevel: 0,
  inputSchema: clientsListInputSchema,
  async handler(input) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("client_preferences")
      .select("id, statement, sentiment, knowledge_type, confidence")
      .eq("client_id", input.clientId)
      .order("created_at", { ascending: false })
      .limit(input.limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map((p) => ({
      id: p.id,
      statement: p.statement,
      sentiment: p.sentiment,
      knowledgeType: p.knowledge_type,
      confidence: p.confidence,
    }));
  },
};

export interface ClientFeedbackRow {
  id: string;
  sentiment: string;
  feedbackType: string;
  content: string;
  receivedAt: string;
}

const clientsFeedbackList: ToolDefinition<import("zod").infer<typeof clientsListInputSchema>, ClientFeedbackRow[]> = {
  name: "clients.feedback.list",
  description: "List recorded feedback for a client, most recent first.",
  domain: "clients",
  requiredPermission: PERMISSIONS.CLIENTS_READ,
  scopeType: "client",
  riskLevel: 0,
  inputSchema: clientsListInputSchema,
  async handler(input) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("client_feedback")
      .select("id, sentiment, feedback_type, content, received_at")
      .eq("client_id", input.clientId)
      .order("received_at", { ascending: false })
      .limit(input.limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map((f) => ({
      id: f.id,
      sentiment: f.sentiment,
      feedbackType: f.feedback_type,
      content: f.content,
      receivedAt: f.received_at,
    }));
  },
};

export interface ClientIssueRow {
  id: string;
  type: string;
  severity: string;
  status: string;
  reason: string;
}

const clientsIssuesList: ToolDefinition<import("zod").infer<typeof clientsListInputSchema>, ClientIssueRow[]> = {
  name: "clients.issues.list",
  description: "List relationship issues for a client (open and resolved), most recent first.",
  domain: "clients",
  requiredPermission: PERMISSIONS.CLIENTS_READ,
  scopeType: "client",
  riskLevel: 0,
  inputSchema: clientsListInputSchema,
  async handler(input) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("client_relationship_issues")
      .select("id, type, severity, status, reason")
      .eq("client_id", input.clientId)
      .order("occurred_at", { ascending: false })
      .limit(input.limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map((i) => ({ id: i.id, type: i.type, severity: i.severity, status: i.status, reason: i.reason }));
  },
};

export const clientsTools = {
  [clientsSearch.name]: clientsSearch,
  [clientsGet.name]: clientsGet,
  [clientsProjectsList.name]: clientsProjectsList,
  [clientsTimelineList.name]: clientsTimelineList,
  [clientsPreferencesList.name]: clientsPreferencesList,
  [clientsFeedbackList.name]: clientsFeedbackList,
  [clientsIssuesList.name]: clientsIssuesList,
};
