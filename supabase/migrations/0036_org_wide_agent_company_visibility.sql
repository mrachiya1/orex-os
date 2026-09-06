-- Org-wide agent scope fix (prompt 015 verification finding).
--
-- agents_select's org-wide branch (company_id is null) required
-- has_org_permission -- an organisation-level membership. A legitimate
-- company-only user (company membership + agents.read/agents.use, no
-- organisation-level role) could not see the org-wide "Founder Advisor"
-- row at all, so getAgent() returned null and createSession() failed with
-- "That agent does not exist," even though the user is fully authorized to
-- use Orex Intelligence in their own company.
--
-- Fix: an org-wide agent is also visible to a user who holds agents.read
-- in ANY company under that same organisation -- not just via an explicit
-- organisation_members row. This only changes VISIBILITY (can the row be
-- selected at all); it grants no execution. Actually using the agent
-- against a specific company still goes through the existing, unchanged
-- application-level check (hasPermission(targetCompanyId, agents.use) in
-- createSession, plus the agent.organisationId/companyId scope check
-- added in the prompt 015 security pass) -- so a user visible to the
-- agent via Orextic membership still cannot create a session for Orex
-- Studios unless they are also a member there. Cross-organisation is
-- denied structurally: the existence check is scoped to companies whose
-- organisation_id matches the agent's own.
--
-- Company-scoped agents (company_id is not null) are unaffected -- that
-- branch already required has_company_permission for that exact company
-- and stays exactly as-is.

drop policy if exists agents_select on agents;
create policy agents_select on agents for select to authenticated using (
  (company_id is not null and public.has_company_permission(company_id, 'agents.read'))
  or (
    company_id is null
    and (
      public.has_org_permission(organisation_id, 'agents.read')
      or exists (
        select 1 from companies c
        where c.organisation_id = agents.organisation_id
          and public.has_company_permission(c.id, 'agents.read')
      )
    )
  )
);

-- Same gap, same fix, for the budget row a Manage Agents card reads
-- alongside the agent itself.
drop policy if exists agent_budgets_select on agent_budgets;
create policy agent_budgets_select on agent_budgets for select to authenticated using (
  exists (
    select 1 from agents a
    where a.id = agent_budgets.agent_id
      and (
        (a.company_id is not null and public.has_company_permission(a.company_id, 'agents.read'))
        or (
          a.company_id is null
          and (
            public.has_org_permission(a.organisation_id, 'agents.read')
            or exists (
              select 1 from companies c
              where c.organisation_id = a.organisation_id
                and public.has_company_permission(c.id, 'agents.read')
            )
          )
        )
      )
  )
);
