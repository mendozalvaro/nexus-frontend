-- Ensure manager can access inventory module UI/API by view permission.
-- This is idempotent and safe to rerun.

update public.role_module_permissions rmp
set
  can_view = true,
  updated_at = now()
from public.user_roles ur
where rmp.role_id = ur.id
  and ur.code = 'manager'
  and rmp.module_key = 'inventory'
  and rmp.can_view is distinct from true;
