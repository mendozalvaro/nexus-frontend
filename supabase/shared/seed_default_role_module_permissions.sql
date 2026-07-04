create or replace function public.seed_default_role_module_permissions()
returns void
language sql
set search_path = public
as $$
  delete from public.role_module_permissions
  where role_id in (
    select id
    from public.user_roles
    where code in ('admin', 'manager', 'employee', 'client')
  );

  with module_matrix as (
    select *
    from (values
      ('dashboard'),
      ('clients'),
      ('users'),
      ('branches'),
      ('settings'),
      ('profile'),
      ('pos.sales'),
      ('inventory'),
      ('appointments'),
      ('service_assignment'),
      ('reservations'),
      ('catalog.products'),
      ('catalog.services'),
      ('catalog.rooms'),
      ('catalog.categories.products'),
      ('catalog.categories.services'),
      ('catalog.categories.rooms'),
      ('reports.sales'),
      ('reports.services'),
      ('reports.lodging')
    ) as t(module_key)
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
        when ur.code = 'manager' then mm.module_key in (
          'users','pos.sales','inventory','appointments','service_assignment','reservations'
        )
        when ur.code = 'employee' then mm.module_key in ('pos.sales','appointments','reservations')
        when ur.code = 'client' then mm.module_key = 'appointments'
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
      (ur.code = 'admin') as can_manage,
      false as can_approve,
      case
        when ur.code in ('admin', 'manager') and mm.module_key = 'users' then true
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
  from role_defaults;
$$;
