create or replace function public.check_subscription_limit(org_id uuid, resource_type text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_limit int;
  v_current_count int;
  v_feature_enabled boolean;
begin
  if resource_type = 'branch' then
    select count(*) into v_current_count
    from public.branches
    where organization_id = org_id;
  end if;

  select os.plan_id into v_plan_id
  from public.organization_subscriptions os
  where os.organization_id = org_id
    and os.status in ('active', 'trial')
    and os.current_period_end > now()
  order by os.updated_at desc nulls last, os.created_at desc nulls last
  limit 1;

  if v_plan_id is null and resource_type = 'branch' and coalesce(v_current_count, 0) = 0 then
    select os.plan_id into v_plan_id
    from public.organization_subscriptions os
    where os.organization_id = org_id
      and os.status = 'past_due'
    order by os.updated_at desc nulls last, os.created_at desc nulls last
    limit 1;
  end if;

  if v_plan_id is null then
    raise exception 'No active subscription found.';
  end if;

  if resource_type = 'branch' then
    if coalesce(v_current_count, 0) = 0 then
      return true;
    end if;

    select max_branches into v_limit from public.subscription_plans where id = v_plan_id;

    if v_current_count >= v_limit then
      return false;
    end if;

    if v_current_count > 1 then
      select feature_multi_branch into v_feature_enabled from public.subscription_plans where id = v_plan_id;
      if not coalesce(v_feature_enabled, false) then
        return false;
      end if;
    end if;
  elsif resource_type = 'user' then
    select max_users into v_limit from public.subscription_plans where id = v_plan_id;
    select count(*) into v_current_count
    from public.profiles
    where organization_id = org_id
      and role <> 'client';

    if v_current_count >= v_limit then
      return false;
    end if;
  end if;

  return true;
end;
$$;

create or replace function public.enforce_branch_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.branches
    where organization_id = new.organization_id
  ) then
    return new;
  end if;

  if not check_subscription_limit(new.organization_id, 'branch') then
    raise exception 'Subscription limit exceeded: Cannot create more branches. Please upgrade your plan.';
  end if;

  return new;
end;
$$;
