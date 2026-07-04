-- Remote-alignment migration captured from linked project.
-- Update RPCs to use multi-business selection.

create or replace function public.create_onboarding_organization(
  p_name text,
  p_business_types public.business_type_enum[] default '{product}'::public.business_type_enum[],
  p_country text default 'BO',
  p_currency text default 'BOB',
  p_timezone text default 'America/La_Paz',
  p_billing_mode text default 'monthly',
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
  v_plan_slug text;
  v_type public.business_type_enum;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_plan_slug := coalesce(
    (
      select (u.raw_user_meta_data ->> 'selectedPlan')::text
      from auth.users u
      where u.id = v_user_id
    ),
    'emprende'
  );

  select id
  into v_plan_id
  from public.subscription_plans
  where slug = v_plan_slug
  limit 1;

  if v_plan_id is null then
    select id
    into v_plan_id
    from public.subscription_plans
    where slug = 'emprende'
    limit 1;
  end if;

  insert into public.organizations (name, currency_code, timezone, country)
  values (p_name, p_currency, p_timezone, p_country)
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
    'trial',
    now() + interval '30 days',
    p_billing_mode,
    now(),
    true,
    now() + interval '30 days'
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

  update public.profiles
  set
    organization_id = v_org_id,
    role = 'admin',
    full_name = coalesce(p_full_name, full_name),
    email = coalesce(p_email, email),
    phone = coalesce(p_phone, phone)
  where id = v_user_id;

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
    'maxBusinessTypes', sp.max_business_types
  )
  into v_caps
  from public.organization_subscriptions os
  join public.subscription_plans sp on sp.id = os.plan_id
  where os.organization_id = input_org_id
    and os.status in ('active', 'trial')
    and os.current_period_end > now();

  return coalesce(v_caps, '{}'::jsonb);
end;
$$;
