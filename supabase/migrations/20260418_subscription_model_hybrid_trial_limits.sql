-- Migration: Subscription model v2 (hybrid business, plan metadata, trial by plan, quarterly billing)
-- Date: 2026-04-18

-- -----------------------------------------------------------------------------
-- 1) organizations.business_type => (services, products, hybrid)
-- -----------------------------------------------------------------------------
alter table public.organizations
  add column if not exists business_type text;

update public.organizations
set business_type = 'hybrid'
where business_type is null
   or business_type = 'both';

alter table public.organizations
  alter column business_type set default 'hybrid';

alter table public.organizations
  drop constraint if exists organizations_business_type_check;

alter table public.organizations
  add constraint organizations_business_type_check
  check (business_type in ('services', 'products', 'hybrid'));

-- -----------------------------------------------------------------------------
-- 2) subscription_plans new business/marketing/capabilities fields
-- -----------------------------------------------------------------------------
alter table public.subscription_plans
  add column if not exists business_only boolean not null default false,
  add column if not exists description text not null default '',
  add column if not exists resume text not null default '',
  add column if not exists features jsonb not null default '[]'::jsonb,
  add column if not exists permissions jsonb not null default '{}'::jsonb,
  add column if not exists limits jsonb not null default '{}'::jsonb,
  add column if not exists available_billing_modes jsonb not null default '{}'::jsonb,
  add column if not exists trial boolean not null default false,
  add column if not exists trial_duration int;

alter table public.subscription_plans
  drop constraint if exists subscription_plans_trial_duration_check;

alter table public.subscription_plans
  add constraint subscription_plans_trial_duration_check
  check (
    (trial = true and trial_duration is not null and trial_duration > 0)
    or
    (trial = false and trial_duration is null)
  );

-- -----------------------------------------------------------------------------
-- 3) organization_subscriptions new payment/trial fields + quarterly billing
-- -----------------------------------------------------------------------------
alter table public.organization_subscriptions
  add column if not exists payment_method text,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists is_trial boolean not null default false;

alter table public.organization_subscriptions
  drop constraint if exists organization_subscriptions_billing_mode_check;

alter table public.organization_subscriptions
  add constraint organization_subscriptions_billing_mode_check
  check (billing_mode in ('monthly', 'quarterly', 'annual'));

alter table public.organization_subscriptions
  drop constraint if exists organization_subscriptions_payment_method_check;

alter table public.organization_subscriptions
  add constraint organization_subscriptions_payment_method_check
  check (
    payment_method is null
    or payment_method in ('tarjeta', 'efectivo', 'transferencia', 'qr')
  );

-- -----------------------------------------------------------------------------
-- 4) Backfill plans and remove free/trial-only legacy plans
-- -----------------------------------------------------------------------------
delete from public.subscription_plans where slug in ('free', 'prueba', 'trial');

update public.subscription_plans
set
  business_only = case when slug = 'emprende' then true else false end,
  description = case
    when slug = 'emprende' then 'Ideal para negocios que venden productos o servicios en una sola linea operativa.'
    when slug = 'crecimiento' then 'Plan para operaciones en expansion con mas sucursales, equipo y control operativo.'
    when slug = 'enterprise' then 'Plan avanzado para organizaciones complejas con necesidades de seguridad y personalizacion.'
    else description
  end,
  resume = case
    when slug = 'emprende' then 'Base para operar y crecer'
    when slug = 'crecimiento' then 'Escala con control multi-sucursal'
    when slug = 'enterprise' then 'Operacion avanzada y personalizada'
    else resume
  end,
  features = case
    when slug = 'emprende' then
      '["ventas","catalogos","citas","inventario_basico"]'::jsonb
    when slug = 'crecimiento' then
      '["ventas","catalogos","citas","inventario","multi_sucursal","transferencias"]'::jsonb
    when slug = 'enterprise' then
      '["ventas","catalogos","citas","inventario","multi_sucursal","transferencias","reportes_avanzados","api","forense","white_label"]'::jsonb
    else features
  end,
  permissions = case
    when slug = 'emprende' then
      '{"inventory": true, "branches": false, "users": true, "inventory_transfer": false, "reports_advanced": false, "api": false, "forensic": false, "white_label": false}'::jsonb
    when slug = 'crecimiento' then
      '{"inventory": true, "branches": true, "users": true, "inventory_transfer": true, "reports_advanced": true, "api": false, "forensic": false, "white_label": false}'::jsonb
    when slug = 'enterprise' then
      '{"inventory": true, "branches": true, "users": true, "inventory_transfer": true, "reports_advanced": true, "api": true, "forensic": true, "white_label": true}'::jsonb
    else permissions
  end,
  limits = case
    when slug = 'emprende' then
      '{"users": 5, "branches": 1, "monthly_sales_per_branch": 50}'::jsonb
    when slug = 'crecimiento' then
      '{"users": 50, "branches": 5, "monthly_sales_per_branch": 5000}'::jsonb
    when slug = 'enterprise' then
      '{"users": 9999, "branches": 9999, "monthly_sales_per_branch": 999999}'::jsonb
    else limits
  end,
  available_billing_modes = jsonb_build_object(
    'monthly', jsonb_build_object('label', 'monthly', 'enabled', true, 'discount_percent', 10),
    'quarterly', jsonb_build_object('label', 'quarterly', 'enabled', true, 'discount_percent', 15),
    'annual', jsonb_build_object('label', 'annual', 'enabled', true, 'discount_percent', 20)
  ),
  trial = true,
  trial_duration = 60
where slug in ('emprende', 'crecimiento', 'enterprise');

-- keep compatibility with legacy numeric limits
update public.subscription_plans
set
  max_users = coalesce((limits->>'users')::int, max_users),
  max_branches = coalesce((limits->>'branches')::int, max_branches)
where slug in ('emprende', 'crecimiento', 'enterprise');

-- -----------------------------------------------------------------------------
-- 5) Helper: validate billing mode enabled from flexible json shape
-- -----------------------------------------------------------------------------
create or replace function public.plan_billing_mode_enabled(
  p_available_billing_modes jsonb,
  p_billing_mode text
) returns boolean
language plpgsql
immutable
as $$
declare
  v_direct jsonb;
  v_item jsonb;
begin
  if p_available_billing_modes is null or jsonb_typeof(p_available_billing_modes) <> 'object' then
    return false;
  end if;

  -- direct semantic key: {"monthly": {...}}
  v_direct := p_available_billing_modes -> p_billing_mode;
  if v_direct is not null and jsonb_typeof(v_direct) = 'object' then
    return coalesce((v_direct->>'enabled')::boolean, false);
  end if;

  -- flexible numeric/object keys: {"1": {"label":"monthly","enabled":true}}
  for v_item in
    select value
    from jsonb_each(p_available_billing_modes)
  loop
    if jsonb_typeof(v_item) = 'object'
       and lower(coalesce(v_item->>'label', '')) = lower(p_billing_mode) then
      return coalesce((v_item->>'enabled')::boolean, false);
    end if;
  end loop;

  return false;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6) RPC create_onboarding_organization with plan compatibility + trial logic
-- -----------------------------------------------------------------------------
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
    v_plan_id uuid;
    v_plan_slug text;
    v_business_only boolean;
    v_trial boolean;
    v_trial_duration int;
    v_available_billing_modes jsonb;
    v_now timestamptz;
    v_trial_ends_at timestamptz;
begin
    v_user_id := auth.uid();
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;

    if p_business_type not in ('services', 'products', 'hybrid') then
      raise exception 'business_type invalido';
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

    -- Compatibility: business_only plans cannot onboard hybrid organizations
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

    update public.profiles
    set organization_id = v_org_id,
        role = 'admin',
        full_name = coalesce(p_full_name, full_name),
        email = coalesce(p_email, email),
        phone = coalesce(p_phone, phone)
    where id = v_user_id;

    insert into public.branches (organization_id, name, code)
    values (v_org_id, 'Principal', 'MAIN');

    insert into public.employee_branch_assignments (user_id, branch_id, is_primary)
    select v_user_id, b.id, true
    from public.branches b where b.organization_id = v_org_id limit 1;

    return v_org_id;
end;
$$ language plpgsql security definer;

-- -----------------------------------------------------------------------------
-- 7) Capabilities payload now includes permissions/limits + payment required
-- -----------------------------------------------------------------------------
create or replace function public.get_organization_capabilities(input_org_id uuid)
returns jsonb as $$
declare
    v_caps jsonb;
begin
    with latest_subscription as (
      select os.*
      from public.organization_subscriptions os
      where os.organization_id = input_org_id
      order by os.updated_at desc nulls last, os.created_at desc nulls last
      limit 1
    )
    select jsonb_build_object(
        'planName', sp.name,
        'planSlug', sp.slug,
        'maxBranches', coalesce((sp.limits->>'branches')::int, sp.max_branches),
        'maxUsers', coalesce((sp.limits->>'users')::int, sp.max_users),
        'canCreateBranch', (
          (select count(*) from public.branches where organization_id = input_org_id)
          <
          coalesce((sp.limits->>'branches')::int, sp.max_branches)
        ),
        'canCreateManager', coalesce((sp.permissions->>'users')::boolean, sp.feature_manager_role, false),
        'canTransferStock', coalesce((sp.permissions->>'inventory_transfer')::boolean, sp.feature_inventory_transfer, false),
        'hasAdvancedReports', coalesce((sp.permissions->>'reports_advanced')::boolean, sp.feature_advanced_reports, false),
        'hasApiAccess', coalesce((sp.permissions->>'api')::boolean, sp.feature_api_access, false),
        'hasForensicExport', coalesce((sp.permissions->>'forensic')::boolean, sp.feature_forensic_export, false),
        'currentBranchesCount', (select count(*) from public.branches where organization_id = input_org_id),
        'currentUsersCount', (select count(*) from public.profiles where organization_id = input_org_id and role != 'client'),
        'subscriptionStatus', os.status,
        'periodEnd', os.current_period_end,
        'billingMode', os.billing_mode,
        'isTrial', os.is_trial,
        'trialEndsAt', os.trial_ends_at,
        'paymentMethod', os.payment_method,
        'features', sp.features,
        'limits', sp.limits,
        'permissions', sp.permissions,
        'paymentRequired',
          (
            os.status <> 'active'::public.sub_status
            and (
              os.is_trial = false
              or os.trial_ends_at is null
              or os.trial_ends_at <= now()
            )
          )
    ) into v_caps
    from latest_subscription os
    join public.subscription_plans sp on os.plan_id = sp.id;

    return coalesce(v_caps, '{}'::jsonb);
end;
$$ language plpgsql security definer;
