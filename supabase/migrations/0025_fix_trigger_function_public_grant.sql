-- Migration 0024's revoke from anon/authenticated directly did not remove
-- the implicit EXECUTE grant every function receives from PUBLIC by
-- default -- anon/authenticated inherit through PUBLIC unless PUBLIC's own
-- grant is revoked too. Confirmed via has_function_privilege() after 0024
-- that both roles could still execute these trigger functions. This is
-- also true of Phase 001's pre-existing revokes on handle_new_user/
-- has_company_permission/has_org_permission/is_company_member (same root
-- cause, out of scope to silently touch here) -- fixed correctly for the
-- two Phase 004/004.5 trigger functions this migration owns.

revoke execute on function public.enforce_decision_project_scope() from public;
revoke execute on function public.enforce_block_section_project_match() from public;
