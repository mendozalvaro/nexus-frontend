select os.organization_id, os.status, os.current_period_start, os.current_period_end, os.is_trial, sp.slug as plan_slug
from public.organization_subscriptions os
join public.subscription_plans sp on sp.id = os.plan_id
where os.organization_id = '11111111-1111-4111-8111-111111111111'::uuid
order by os.current_period_end desc nulls last;
