alter table public.profiles
  add column if not exists trial_consumed_at timestamptz;

create or replace function public.create_onboarding_organization(
  p_name text,
  p_business_types public.business_type_enum[] default '{product}'::public.business_type_enum[],
  p_country text default 'BO',
  p_currency text default 'BOB',
  p_timezone text default 'America/La_Paz',
  p_billing_mode text default 'monthly',
  p_plan_slug text default 'emprende',
  p_activation_mode text default 'trial',
  p_full_name text default null,
  p_email text default null,
  p_phone text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_user_id uuid;
  v_plan_id uuid;
  v_type public.business_type_enum;
  v_now timestamptz := now();
  v_trial_ends_at timestamptz := null;
  v_trial_consumed_at timestamptz := null;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_activation_mode not in ('trial', 'paid') then
    raise exception 'INVALID_ACTIVATION_MODE';
  end if;

  select trial_consumed_at
  into v_trial_consumed_at
  from public.profiles
  where id = v_user_id
  limit 1;

  if p_activation_mode = 'trial' and v_trial_consumed_at is not null then
    raise exception 'TRIAL_ALREADY_USED';
  end if;

  select id
  into v_plan_id
  from public.subscription_plans
  where slug = coalesce(nullif(trim(p_plan_slug), ''), 'emprende')
  limit 1;

  if v_plan_id is null then
    select id
    into v_plan_id
    from public.subscription_plans
    where slug = 'emprende'
    limit 1;
  end if;

  if v_plan_id is null then
    raise exception 'No se encontro un plan valido para onboarding';
  end if;

  if p_activation_mode = 'trial' then
    v_trial_ends_at := v_now + interval '31 days';
  end if;

  insert into public.organizations (name, currency_code, timezone, country, status)
  values (
    p_name,
    p_currency,
    p_timezone,
    p_country,
    case when p_activation_mode = 'trial' then 'active' else 'pending' end
  )
  returning id into v_org_id;

  insert into public.organization_subscriptions (
    organization_id,
    plan_id,
    status,
    current_period_end,
    billing_mode,
    current_period_start,
    is_trial,
    trial_ends_at
  )
  values (
    v_org_id,
    v_plan_id,
    case when p_activation_mode = 'trial' then 'trial'::public.sub_status else 'past_due'::public.sub_status end,
    coalesce(v_trial_ends_at, v_now),
    p_billing_mode,
    v_now,
    p_activation_mode = 'trial',
    v_trial_ends_at
  )
  on conflict (organization_id) do update
  set
    plan_id = excluded.plan_id,
    status = excluded.status,
    current_period_end = excluded.current_period_end,
    billing_mode = excluded.billing_mode,
    current_period_start = excluded.current_period_start,
    is_trial = excluded.is_trial,
    trial_ends_at = excluded.trial_ends_at;

  foreach v_type in array p_business_types loop
    insert into public.organization_business_types (organization_id, business_type)
    values (v_org_id, v_type)
    on conflict do nothing;
  end loop;

  insert into public.profiles (
    id,
    organization_id,
    role,
    full_name,
    email,
    phone,
    is_active,
    trial_consumed_at,
    updated_at
  )
  values (
    v_user_id,
    v_org_id,
    'admin',
    coalesce(nullif(trim(p_full_name), ''), 'Administrador NexusPOS'),
    coalesce(nullif(lower(trim(p_email)), ''), concat(v_user_id::text, '@nexuspos.local')),
    nullif(trim(p_phone), ''),
    true,
    case when p_activation_mode = 'trial' then v_now else null end,
    v_now
  )
  on conflict (id) do update
  set
    organization_id = excluded.organization_id,
    role = 'admin',
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    email = coalesce(excluded.email, public.profiles.email),
    phone = coalesce(excluded.phone, public.profiles.phone),
    is_active = true,
    trial_consumed_at = coalesce(public.profiles.trial_consumed_at, excluded.trial_consumed_at),
    updated_at = v_now;

  insert into public.branches (organization_id, name, code)
  values (v_org_id, 'Principal', 'MAIN');

  insert into public.employee_branch_assignments (user_id, branch_id, is_primary)
  select v_user_id, b.id, true
  from public.branches b
  where b.organization_id = v_org_id
  limit 1
  on conflict (user_id, branch_id) do update
  set is_primary = excluded.is_primary;

  return v_org_id;
end;
$$;
