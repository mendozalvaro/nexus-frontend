select
  p.id as profile_id,
  p.email,
  p.role,
  p.role_id,
  p.organization_id,
  o.status as organization_status
from profiles p
join organizations o on o.id = p.organization_id
where p.email = 'resprogreso@gmail.com';

select
  obt.organization_id,
  array_agg(obt.business_type order by obt.business_type) as business_types
from organization_business_types obt
where obt.organization_id = (
  select organization_id
  from profiles
  where email = 'resprogreso@gmail.com'
)
group by obt.organization_id;

select
  os.organization_id,
  os.status,
  os.billing_mode,
  os.plan_id,
  os.trial_ends_at,
  os.current_period_end,
  sp.name as plan_name,
  sp.slug as plan_slug,
  sp.feature_hotel_module,
  sp.feature_advanced_reports
from organization_subscriptions os
join subscription_plans sp on sp.id = os.plan_id
where os.organization_id = (
  select organization_id
  from profiles
  where email = 'resprogreso@gmail.com'
);

select
  role_id,
  module_key,
  can_view,
  can_create,
  can_edit,
  can_delete,
  can_export,
  can_manage
from role_module_permissions
where role_id = (
  select role_id
  from profiles
  where email = 'resprogreso@gmail.com'
)
and module_key in ('users', 'reports.sales', 'reports.services', 'reports.lodging', 'settings', 'profile')
order by module_key;

select get_organization_capabilities(
  (
    select organization_id
    from profiles
    where email = 'resprogreso@gmail.com'
  )
) as capabilities;
