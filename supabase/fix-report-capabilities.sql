create or replace function public.get_organization_capabilities(input_org_id uuid)
returns jsonb as $$
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
        'currentBranchesCount', (select count(*) from public.branches where organization_id = input_org_id),
        'currentUsersCount', (select count(*) from public.profiles where organization_id = input_org_id and role != 'client'),
        'subscriptionStatus', os.status,
        'periodEnd', os.current_period_end
    ) into v_caps
    from public.organization_subscriptions os
    join public.subscription_plans sp on os.plan_id = sp.id
    where os.organization_id = input_org_id
      and os.status in ('active', 'trial')
      and os.current_period_end > now();

    return coalesce(v_caps, '{}'::jsonb);
end;
$$ language plpgsql security definer;
