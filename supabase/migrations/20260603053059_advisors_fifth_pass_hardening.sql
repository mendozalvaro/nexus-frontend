revoke execute on function public.admin_get_payment_validation_detail(uuid) from authenticated;
grant execute on function public.admin_get_payment_validation_detail(uuid) to service_role;

revoke execute on function public.admin_list_payment_validations(text, text, date, date, integer, integer) from authenticated;
grant execute on function public.admin_list_payment_validations(text, text, date, date, integer, integer) to service_role;

revoke execute on function public.admin_payment_validation_stats() from authenticated;
grant execute on function public.admin_payment_validation_stats() to service_role;

revoke execute on function public.admin_review_payment_validation(uuid, text, text) from authenticated;
grant execute on function public.admin_review_payment_validation(uuid, text, text) to service_role;

revoke execute on function public.inventory_adjust_batch_execute(uuid, uuid, text, uuid, text, text, text, text, jsonb) from authenticated;
grant execute on function public.inventory_adjust_batch_execute(uuid, uuid, text, uuid, text, text, text, text, jsonb) to service_role;

revoke execute on function public.inventory_adjust_batch_precheck(uuid, uuid, text, jsonb) from authenticated;
grant execute on function public.inventory_adjust_batch_precheck(uuid, uuid, text, jsonb) to service_role;

revoke execute on function public.inventory_transfer_batch_create(uuid, uuid, text, uuid, uuid, text, text, jsonb) from authenticated;
grant execute on function public.inventory_transfer_batch_create(uuid, uuid, text, uuid, uuid, text, text, jsonb) to service_role;

revoke execute on function public.inventory_transfer_batch_precheck(uuid, uuid, uuid, jsonb) from authenticated;
grant execute on function public.inventory_transfer_batch_precheck(uuid, uuid, uuid, jsonb) to service_role;

revoke execute on function public.check_subscription_limit(uuid, text) from authenticated;
grant execute on function public.check_subscription_limit(uuid, text) to service_role;
