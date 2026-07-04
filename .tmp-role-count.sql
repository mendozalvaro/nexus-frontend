select role_id, count(*) as rows_count
from public.role_module_permissions
where role_id = 'a1111111-1111-4111-8111-111111111111'
group by role_id;
