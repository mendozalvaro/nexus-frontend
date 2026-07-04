update public.organization_subscriptions
set current_period_start = now() - interval '20 days',
    current_period_end = now() + interval '70 days',
    status = 'active'::public.sub_status,
    is_trial = false,
    trial_ends_at = null
where organization_id = '11111111-1111-4111-8111-111111111111'::uuid
  and provider_subscription_id = 'sub_demo_retail_001';

select public.get_organization_capabilities('11111111-1111-4111-8111-111111111111'::uuid) as product_caps;
