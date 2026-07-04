-- Fix: onboarding organization creation fails when authenticated user has no profiles row.
-- Root cause:
-- create_onboarding_organization updated profiles, but if no row existed the update affected 0 rows.
-- Later insert into employee_branch_assignments failed FK (user_id -> profiles.id).

create or replace function public.create_onboarding_organization(
    p_name text,
    p_business_type text default 'hybrid',
    p_country text default 'BO',
    p_currency text default 'BOB',
    p_timezone text default 'America/La_Paz',
    p_billing_mode text default 'monthly',
    p_slug text default null,
    p_address text default null,
    p_billing_data jsonb default null,
    p_full_name text default null,
    p_email text default null,
    p_phone text default null
) returns uuid as $$
declare
    v_org_id uuid;
    v_user_id uuid;
    v_existing_org_id uuid;
    v_branch_id uuid;
    v_plan_id uuid;
    v_plan_slug text;
    v_business_only boolean;
    v_trial boolean;
    v_trial_duration int;
    v_available_billing_modes jsonb;
    v_now timestamptz;
    v_trial_ends_at timestamptz;
    v_profile_full_name text;
    v_profile_email text;
    v_profile_phone text;
begin
    v_user_id := auth.uid();
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;

    if p_business_type not in ('services', 'products', 'hybrid') then
      raise exception 'business_type invalido';
    end if;

    select p.organization_id
      into v_existing_org_id
    from public.profiles p
    where p.id = v_user_id
    limit 1;

    if v_existing_org_id is not null then
      return v_existing_org_id;
    end if;

    v_plan_slug := coalesce(
      (select (u.raw_user_meta_data->>'selectedPlan')::text from auth.users u where u.id = v_user_id),
      'emprende'
    );

    select
      id,
      business_only,
      trial,
      trial_duration,
      available_billing_modes
    into
      v_plan_id,
      v_business_only,
      v_trial,
      v_trial_duration,
      v_available_billing_modes
    from public.subscription_plans
    where slug = v_plan_slug
      and coalesce(is_active, true)
    limit 1;

    if v_plan_id is null then
      select
        id,
        business_only,
        trial,
        trial_duration,
        available_billing_modes
      into
        v_plan_id,
        v_business_only,
        v_trial,
        v_trial_duration,
        v_available_billing_modes
      from public.subscription_plans
      where slug = 'emprende'
        and coalesce(is_active, true)
      limit 1;
    end if;

    if v_plan_id is null then
      raise exception 'No se encontro un plan valido para onboarding';
    end if;

    if coalesce(v_business_only, false) = true and p_business_type = 'hybrid' then
      raise exception 'El plan seleccionado no permite negocio hibrido';
    end if;

    if not public.plan_billing_mode_enabled(v_available_billing_modes, p_billing_mode) then
      raise exception 'El modo de facturacion no esta habilitado para este plan';
    end if;

    v_now := now();
    if coalesce(v_trial, false) = true and coalesce(v_trial_duration, 0) > 0 then
      v_trial_ends_at := v_now + make_interval(days => v_trial_duration);
    else
      v_trial_ends_at := null;
    end if;

    insert into public.organizations (
      name,
      currency_code,
      timezone,
      country,
      business_type,
      slug,
      address,
      billing_data
    )
    values (
      p_name,
      p_currency,
      p_timezone,
      p_country,
      p_business_type,
      p_slug,
      p_address,
      p_billing_data
    )
    returning id into v_org_id;

    insert into public.organization_subscriptions (
      organization_id,
      plan_id,
      status,
      current_period_start,
      current_period_end,
      billing_mode,
      payment_method,
      trial_ends_at,
      is_trial
    )
    values (
      v_org_id,
      v_plan_id,
      case when v_trial_ends_at is not null then 'trial'::public.sub_status else 'past_due'::public.sub_status end,
      v_now,
      coalesce(v_trial_ends_at, v_now),
      p_billing_mode,
      null,
      v_trial_ends_at,
      (v_trial_ends_at is not null)
    )
    on conflict (organization_id) do update set
      plan_id = excluded.plan_id,
      status = excluded.status,
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      billing_mode = excluded.billing_mode,
      payment_method = excluded.payment_method,
      trial_ends_at = excluded.trial_ends_at,
      is_trial = excluded.is_trial;

    v_profile_full_name := coalesce(
      nullif(trim(p_full_name), ''),
      (select nullif(trim(p.full_name), '') from public.profiles p where p.id = v_user_id),
      (select nullif(trim((u.raw_user_meta_data->>'full_name')::text), '') from auth.users u where u.id = v_user_id),
      'Administrador NexusPOS'
    );

    v_profile_email := coalesce(
      nullif(lower(trim(p_email)), ''),
      (select nullif(lower(trim(p.email)), '') from public.profiles p where p.id = v_user_id),
      (select nullif(lower(trim(u.email)), '') from auth.users u where u.id = v_user_id),
      concat(v_user_id::text, '@nexuspos.local')
    );

    v_profile_phone := coalesce(
      nullif(trim(p_phone), ''),
      (select nullif(trim(p.phone), '') from public.profiles p where p.id = v_user_id),
      (select nullif(trim((u.raw_user_meta_data->>'phone')::text), '') from auth.users u where u.id = v_user_id)
    );

    insert into public.profiles (
      id,
      organization_id,
      role,
      full_name,
      email,
      phone,
      is_active,
      updated_at
    )
    values (
      v_user_id,
      v_org_id,
      'admin',
      v_profile_full_name,
      v_profile_email,
      v_profile_phone,
      true,
      now()
    )
    on conflict (id) do update
    set
      organization_id = excluded.organization_id,
      role = 'admin',
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      email = coalesce(excluded.email, public.profiles.email),
      phone = coalesce(excluded.phone, public.profiles.phone),
      is_active = true,
      updated_at = now();

    insert into public.branches (organization_id, name, code)
    values (v_org_id, 'Principal', 'MAIN')
    returning id into v_branch_id;

    insert into public.employee_branch_assignments (user_id, branch_id, is_primary)
    values (v_user_id, v_branch_id, true)
    on conflict (user_id, branch_id) do update
    set is_primary = excluded.is_primary;

    return v_org_id;
end;
$$ language plpgsql security definer;
