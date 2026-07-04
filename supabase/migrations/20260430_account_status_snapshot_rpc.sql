create or replace function public.get_account_status_snapshot(
  p_organization_id uuid
)
returns table (
  organization_status text,
  subscription_status sub_status,
  is_trial boolean,
  trial_ends_at timestamptz,
  latest_validation_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_org_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED'
      using errcode = '42501';
  end if;

  select p.organization_id
  into v_profile_org_id
  from public.profiles p
  where p.id = v_user_id;

  if v_profile_org_id is null or v_profile_org_id <> p_organization_id then
    raise exception 'ACCOUNT_STATUS_ACCESS_DENIED'
      using errcode = '42501';
  end if;

  return query
  select
    o.status as organization_status,
    s.status as subscription_status,
    coalesce(s.is_trial, false) as is_trial,
    s.trial_ends_at,
    pv.status as latest_validation_status
  from public.organizations o
  left join lateral (
    select
      os.status,
      os.is_trial,
      os.trial_ends_at
    from public.organization_subscriptions os
    where os.organization_id = o.id
    order by os.updated_at desc nulls last, os.created_at desc nulls last
    limit 1
  ) s on true
  left join lateral (
    select v.status
    from public.payment_validations v
    where v.organization_id = o.id
    order by v.created_at desc nulls last
    limit 1
  ) pv on true
  where o.id = p_organization_id;
end;
$$;

revoke all on function public.get_account_status_snapshot(uuid) from public;
grant execute on function public.get_account_status_snapshot(uuid) to authenticated;
