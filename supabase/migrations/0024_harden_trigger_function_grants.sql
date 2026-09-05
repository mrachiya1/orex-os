-- Trigger functions are only ever invoked by the database's trigger
-- mechanism (which supplies NEW/OLD row context) -- unlike
-- has_company_permission/has_org_permission/has_project_access, they are
-- never meant to be called directly as an RPC by application code. Revoke
-- the RPC-callable grants the advisor flagged, matching migration 0009's
-- existing hardening of handle_new_user().

revoke execute on function public.enforce_decision_project_scope() from anon, authenticated;
revoke execute on function public.enforce_block_section_project_match() from anon, authenticated;
