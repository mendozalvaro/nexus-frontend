select id, status, is_trial, trial_ends_at, created_at, updated_at
from organization_subscriptions
where organization_id = '13333333-3333-4333-8333-333333333333'
order by updated_at desc nulls last, created_at desc nulls last;
