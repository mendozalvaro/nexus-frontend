-- Granular module access: subscription plan permissions, role module permissions,
-- and capabilities payload aligned with business type aware modules.

begin;

update public.subscription_plans
set
  permissions = case slug
    when 'emprende' then jsonb_build_object(
      'dashboard', true,
      'profile', true,
      'settings', true,
      'users', true,
      'clients', true,
      'pos.sales', true,
      'inventory', true,
      'appointments', true,
      'service_assignment', true,
      'reservations', true,
      'catalog.products', true,
      'catalog.services', true,
      'catalog.rooms', true,
      'catalog.categories.products', true,
      'catalog.categories.services', true,
      'catalog.categories.rooms', true,
      'reports.sales', true,
      'reports.services', true,
      'reports.lodging', true,
      'branches', false
    )
    when 'crecimiento' then jsonb_build_object(
      'dashboard', true,
      'profile', true,
      'settings', true,
      'users', true,
      'clients', true,
      'pos.sales', true,
      'inventory', true,
      'appointments', true,
      'service_assignment', true,
      'reservations', true,
      'catalog.products', true,
      'catalog.services', true,
      'catalog.rooms', true,
      'catalog.categories.products', true,
      'catalog.categories.services', true,
      'catalog.categories.rooms', true,
      'reports.sales', true,
      'reports.services', true,
      'reports.lodging', true,
      'branches', true
    )
    when 'enterprise' then jsonb_build_object(
      'dashboard', true,
      'profile', true,
      'settings', true,
      'users', true,
      'clients', true,
      'pos.sales', true,
      'inventory', true,
      'appointments', true,
      'service_assignment', true,
      'reservations', true,
      'catalog.products', true,
      'catalog.services', true,
      'catalog.rooms', true,
      'catalog.categories.products', true,
      'catalog.categories.services', true,
      'catalog.categories.rooms', true,
      'reports.sales', true,
      'reports.services', true,
      'reports.lodging', true,
      'branches', true
    )
    else coalesce(permissions, '{}'::jsonb)
  end,
  limits = coalesce(limits, '{}'::jsonb)
    || case slug
      when 'emprende' then '{"roles":{"manager":1,"employee":2}}'::jsonb
      when 'crecimiento' then '{"roles":{"manager":3,"employee":9}}'::jsonb
      when 'enterprise' then '{"roles":{"manager":20,"employee":80}}'::jsonb
      else '{}'::jsonb
    end,
  features = case slug
    when 'emprende' then '["catalog.products","catalog.services","catalog.rooms","pos.sales","reports.sales","reports.services","reports.lodging"]'::jsonb
    when 'crecimiento' then '["catalog.products","catalog.services","catalog.rooms","pos.sales","inventory","appointments","service_assignment","reservations","reports.sales","reports.services","reports.lodging","branches"]'::jsonb
    when 'enterprise' then '["catalog.products","catalog.services","catalog.rooms","pos.sales","inventory","appointments","service_assignment","reservations","reports.sales","reports.services","reports.lodging","branches","api","forensic"]'::jsonb
    else coalesce(features, '[]'::jsonb)
  end
where slug in ('emprende', 'crecimiento', 'enterprise');

-- Sync source: supabase/shared/seed_default_role_module_permissions.sql
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

select public.seed_default_role_module_permissions();

create or replace function public.get_organization_capabilities(input_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caps jsonb;
begin
  select jsonb_build_object(
    'planName', sp.name,
    'planSlug', sp.slug,
    'maxBranches', sp.max_branches,
    'maxUsers', sp.max_users,
    'canCreateBranch', (sp.max_branches > (select count(*) from public.branches where organization_id = input_org_id)),
    'canCreateManager', sp.feature_manager_role,
    'canTransferStock', sp.feature_inventory_transfer,
    'hasAdvancedReports', sp.feature_advanced_reports,
    'hasApiAccess', sp.feature_api_access,
    'hasForensicExport', sp.feature_forensic_export,
    'hasHotelModule', coalesce(sp.feature_hotel_module, false),
    'currentBranchesCount', (select count(*) from public.branches where organization_id = input_org_id),
    'currentUsersCount', (select count(*) from public.profiles where organization_id = input_org_id and role <> 'client'),
    'subscriptionStatus', os.status,
    'periodEnd', os.current_period_end,
    'businessTypes', (
      select coalesce(jsonb_agg(obt.business_type order by obt.business_type), '[]'::jsonb)
      from public.organization_business_types obt
      where obt.organization_id = input_org_id
    ),
    'allowedBusinessTypes', to_jsonb(sp.allowed_business_types),
    'maxBusinessTypes', sp.max_business_types,
    'permissions', coalesce(sp.permissions, '{}'::jsonb),
    'limits', coalesce(sp.limits, '{}'::jsonb),
    'features', coalesce(sp.features, '[]'::jsonb)
  )
  into v_caps
  from public.organization_subscriptions os
  join public.subscription_plans sp on sp.id = os.plan_id
  where os.organization_id = input_org_id
    and os.status in ('active', 'trial')
    and os.current_period_end > now()
  order by os.current_period_end desc
  limit 1;

  return coalesce(v_caps, '{}'::jsonb);
end;
$$;

commit;
