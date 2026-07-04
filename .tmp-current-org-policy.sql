select
  p.email,
  p.full_name,
  p.role,
  p.organization_id,
  o.name as organization_name,
  o.slug as organization_slug,
  o.status as organization_status,
  s.status as subscription_status,
  s.is_trial,
  s.trial_ends_at,
  pv.status as latest_validation_status,
  pv.created_at as latest_validation_created_at
from profiles p
left join organizations o
  on o.id = p.organization_id
left join lateral (
  select os.status, os.is_trial, os.trial_ends_at
  from organization_subscriptions os
  where os.organization_id = p.organization_id
  order by os.created_at desc nulls last
  limit 1
) s on true
left join lateral (
  select v.status, v.created_at
  from payment_validations v
  where v.organization_id = p.organization_id
  order by v.created_at desc nulls last
  limit 1
) pv on true
where p.email = 'admin.hospedaje@nexuspos.demo';
