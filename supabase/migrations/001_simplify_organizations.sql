-- Migration: Simplify organizations table for new 3-step onboarding
-- Date: 2026-04-15
-- Description: Remove slug/address/billing_data, add country, update RPC

-- 1. Add new column
alter table organizations add column if not exists country char(2) default 'BO';

-- 2. Backfill country from existing data (default BO for existing rows)
update organizations set country = 'BO' where country is null;

-- 3. Drop old columns (cascade to handle any dependencies)
alter table organizations drop column if exists slug cascade;
alter table organizations drop column if exists address cascade;
alter table organizations drop column if exists billing_data cascade;

-- 4. Drop the unique constraint on slug if it still exists
drop index if exists idx_organizations_slug;

-- 5. Update the RPC function
create or replace function create_onboarding_organization(
    p_name text,
    p_business_type text default 'both',
    p_country text default 'BO',
    p_currency text default 'BOB',
    p_timezone text default 'America/La_Paz',
    p_billing_mode text default 'monthly',
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

    -- Create organization
    insert into organizations (name, currency_code, timezone, country, business_type)
    values (p_name, p_currency, p_timezone, p_country, p_business_type)
    returning id into v_org_id;

    -- Create subscription (trial 30 days)
    insert into organization_subscriptions (organization_id, plan_id, status, current_period_end)
    values (v_org_id, v_plan_id, 'trial', now() + interval '30 days');

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

-- 6. Update get_organization_capabilities to not reference slug
create or replace function get_organization_capabilities(input_org_id uuid)
returns jsonb as $$
declare
    v_caps jsonb;
begin
    select jsonb_build_object(
        'planName', sp.name,
        'planSlug', sp.slug,
        'maxBranches', sp.max_branches,
        'maxUsers', sp.max_users,
        'canCreateBranch', (sp.max_branches > (select count(*) from branches where organization_id = input_org_id)),
        'canCreateManager', sp.feature_manager_role,
        'canTransferStock', sp.feature_inventory_transfer,
        'hasAdvancedReports', sp.feature_advanced_reports,
        'hasApiAccess', sp.feature_api_access,
        'hasForensicExport', sp.feature_forensic_export,
        'currentBranchesCount', (select count(*) from branches where organization_id = input_org_id),
        'currentUsersCount', (select count(*) from profiles where organization_id = input_org_id and role != 'client'),
        'subscriptionStatus', os.status,
        'periodEnd', os.current_period_end
    ) into v_caps
    from organization_subscriptions os
    join subscription_plans sp on os.plan_id = sp.id
    where os.organization_id = input_org_id
      and os.status in ('active', 'trial')
      and os.current_period_end > now();

    return coalesce(v_caps, '{}'::jsonb);
end;
$$ language plpgsql security definer;
