-- Advisor scan revealed enforce_milestone_parent_integrity() and
-- enforce_property_value_scope() (introduced in 0027) are directly
-- EXECUTE-granted to anon/authenticated/service_role -- Supabase applies
-- that grant automatically via default privileges at CREATE FUNCTION time.
-- This is a different mechanism than 0025's PUBLIC-inherited grant (that fix
-- doesn't cover this case): here the grants are direct, not inherited, so
-- revoking from PUBLIC alone left them untouched. Confirmed via
-- has_function_privilege() before and after. Belt-and-suspenders: revoke
-- from all three surfaces so neither mechanism can reintroduce this.

revoke execute on function public.enforce_milestone_parent_integrity() from public, anon, authenticated;
revoke execute on function public.enforce_property_value_scope() from public, anon, authenticated;
