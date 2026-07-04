-- Migration: Restore org columns + add billing_mode to subscriptions
-- Date: 2026-04-15
-- Reverts: 001_simplify_organizations.sql

-- 1. Restore dropped columns (nullable, no breaking existing data)
alter table organizations add column if not exists slug text;
alter table organizations add column if not exists address text;
alter table organizations add column if not exists billing_data jsonb;

-- 2. Add billing_mode to organization_subscriptions
alter table organization_subscriptions add column if not exists billing_mode text default 'monthly' check (billing_mode in ('monthly', 'annual'));

-- 3. Update RPC to accept and store optional slug/address/billing_data + billing_mode
create or replace function create_onboarding_organization(
    p_name text,
    p_business_type text default 'both',
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
begin
    v_user_id := auth.uid();
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;

    -- Get plan from user_metadata
    v_plan_slug := coalesce(
        (select (u.raw_user_meta_data->>'selectedPlan')::text from auth.users u where u.id = v_user_id),
        'emprende'
    );
    select id into v_plan_id from subscription_plans where slug = v_plan_slug limit 1;
    if v_plan_id is null then
        select id into v_plan_id from subscription_plans where slug = 'emprende' limit 1;
    end if;

    -- Create organization (slug, address, billing_data are nullable)
    insert into organizations (name, currency_code, timezone, country, business_type, slug, address, billing_data)
    values (p_name, p_currency, p_timezone, p_country, p_business_type, p_slug, p_address, p_billing_data)
    returning id into v_org_id;

    -- Create subscription with billing_mode
    insert into organization_subscriptions (organization_id, plan_id, status, current_period_end, billing_mode)
    values (v_org_id, v_plan_id, 'trial', now() + interval '30 days', p_billing_mode)
    on conflict (organization_id) do update set
        plan_id = excluded.plan_id,
        billing_mode = excluded.billing_mode;

    -- Update profile
    update profiles
    set organization_id = v_org_id,
        role = 'admin',
        full_name = coalesce(p_full_name, full_name),
        email = coalesce(p_email, email),
        phone = coalesce(p_phone, phone)
    where id = v_user_id;

    -- Create default branch
    insert into branches (organization_id, name, code)
    values (v_org_id, 'Principal', 'MAIN');

    -- Assign user to default branch
    insert into employee_branch_assignments (user_id, branch_id, is_primary)
    select v_user_id, b.id, true
    from branches b where b.organization_id = v_org_id limit 1;

    return v_org_id;
end;
$$ language plpgsql security definer;
