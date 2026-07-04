select p.email, p.role, p.role_id, count(rmp.id) as permission_rows
from public.profiles p
left join public.role_module_permissions rmp on rmp.role_id = p.role_id
where p.email = 'admin.hospedaje@nexuspos.demo'
group by p.email, p.role, p.role_id;
