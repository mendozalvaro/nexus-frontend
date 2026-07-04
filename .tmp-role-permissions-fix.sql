delete from public.role_module_permissions
where role_id in (
  select id
  from public.user_roles
  where code in ('admin', 'manager', 'employee', 'client')
);

with module_matrix as (
  select *
  from (values
    ('dashboard', true, true, true, true, false, false, false, false),
    ('clients', true, true, true, false, false, false, false, false),
    ('users', true, true, true, true, false, false, false, true),
    ('branches', true, true, true, true, false, false, false, false),
    ('settings', true, true, true, true, false, false, false, false),
    ('profile', true, true, true, true, false, false, false, false),
    ('pos.sales', true, true, true, true, false, false, false, false),
    ('inventory', true, true, true, true, false, false, false, false),
    ('appointments', true, true, true, true, false, false, false, false),
    ('service_assignment', true, true, true, true, false, false, false, false),
    ('reservations', true, true, true, true, false, false, false, false),
    ('catalog.products', true, true, true, true, false, false, false, false),
    ('catalog.services', true, true, true, true, false, false, false, false),
    ('catalog.rooms', true, true, true, true, false, false, false, false),
    ('catalog.categories.products', true, true, true, true, false, false, false, false),
    ('catalog.categories.services', true, true, true, true, false, false, false, false),
    ('catalog.categories.rooms', true, true, true, true, false, false, false, false),
    ('reports.sales', true, false, false, false, true, false, false, false),
    ('reports.services', true, false, false, false, true, false, false, false),
    ('reports.lodging', true, false, false, false, true, false, false, false)
  ) as t(module_key, admin_view, admin_create, admin_edit, admin_delete, admin_export, manager_export_only, can_approve, can_assign)
),
role_defaults as (
  select
    ur.id as role_id,
    ur.code,
    mm.module_key,
    case
      when ur.code = 'admin' then true
      when ur.code = 'manager' then mm.module_key in (
        'dashboard','clients','users','profile','pos.sales','inventory','appointments',
        'service_assignment','reservations','catalog.products','catalog.services',
        'catalog.rooms','catalog.categories.products','catalog.categories.services',
        'catalog.categories.rooms','reports.sales','reports.services','reports.lodging'
      )
      when ur.code = 'employee' then mm.module_key in ('dashboard','profile','pos.sales','appointments','reservations')
      when ur.code = 'client' then mm.module_key in ('appointments','profile')
      else false
    end as can_view,
    case
      when ur.code = 'admin' then true
      when ur.code = 'manager' then mm.module_key in ('users','pos.sales','inventory','appointments','service_assignment','reservations')
      when ur.code = 'employee' then mm.module_key in ('pos.sales','appointments','reservations')
      when ur.code = 'client' then mm.module_key in ('appointments')
      else false
    end as can_create,
    case
      when ur.code = 'admin' then true
      when ur.code = 'manager' then mm.module_key in (
        'clients','users','profile','pos.sales','inventory','appointments','service_assignment',
        'reservations','catalog.products','catalog.services','catalog.rooms',
        'catalog.categories.products','catalog.categories.services','catalog.categories.rooms'
      )
      when ur.code = 'employee' then mm.module_key in ('profile','appointments','reservations')
      when ur.code = 'client' then mm.module_key = 'profile'
      else false
    end as can_edit,
    case
      when ur.code = 'admin' then true
      when ur.code = 'manager' then mm.module_key = 'reservations'
      else false
    end as can_delete,
    case
      when ur.code = 'admin' then true
      when ur.code = 'manager' then mm.module_key in ('reports.sales','reports.services','reports.lodging')
      else false
    end as can_export,
    case
      when ur.code = 'admin' then true
      else false
    end as can_manage,
    false as can_approve,
    case
      when ur.code = 'admin' and mm.module_key = 'users' then true
      when ur.code = 'manager' and mm.module_key = 'users' then true
      else false
    end as can_assign
  from public.user_roles ur
  cross join module_matrix mm
  where ur.code in ('admin', 'manager', 'employee', 'client')
)
insert into public.role_module_permissions (
  role_id,
  module_key,
  can_view,
  can_create,
  can_edit,
  can_delete,
  can_export,
  can_manage,
  can_approve,
  can_assign,
  created_at,
  updated_at
)
select
  role_id,
  module_key,
  can_view,
  can_create,
  can_edit,
  can_delete,
  can_export,
  can_manage,
  can_approve,
  can_assign,
  now(),
  now()
from role_defaults
on conflict (role_id, module_key) do update
set
  can_view = excluded.can_view,
  can_create = excluded.can_create,
  can_edit = excluded.can_edit,
  can_delete = excluded.can_delete,
  can_export = excluded.can_export,
  can_manage = excluded.can_manage,
  can_approve = excluded.can_approve,
  can_assign = excluded.can_assign,
  updated_at = now();
