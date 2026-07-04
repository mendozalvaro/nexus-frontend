revoke execute on function public.get_account_status_snapshot(uuid) from authenticated;
grant execute on function public.get_account_status_snapshot(uuid) to service_role;

revoke execute on function public.get_organization_capabilities(uuid) from authenticated;
grant execute on function public.get_organization_capabilities(uuid) to service_role;

revoke execute on function public.is_system_user(uuid) from authenticated;
grant execute on function public.is_system_user(uuid) to service_role;
