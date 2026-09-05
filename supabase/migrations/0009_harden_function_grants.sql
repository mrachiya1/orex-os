-- Phase 001: harden RPC exposure of the RLS helper functions.
-- authenticated must keep EXECUTE (RLS policies invoke these functions as
-- the querying role), but there is no reason for the anonymous role to call
-- them directly, and handle_new_user should never be callable via RPC at
-- all (it is only meant to run as the auth.users insert trigger).

revoke execute on function public.has_company_permission(uuid, text) from anon;
revoke execute on function public.has_org_permission(uuid, text) from anon;
revoke execute on function public.is_company_member(uuid) from anon;

revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
