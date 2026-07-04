revoke execute on function public.audit_trigger_func() from public, anon, authenticated;
grant execute on function public.audit_trigger_func() to service_role;

revoke execute on function public.check_subscription_limit(uuid, text) from public, anon;
grant execute on function public.check_subscription_limit(uuid, text) to authenticated, service_role;

revoke execute on function public.create_onboarding_organization(text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.create_onboarding_organization(text, text, text, text, text, text, text, text, jsonb, text, text, text) from public, anon, authenticated;
revoke execute on function public.create_onboarding_organization(text, public.business_type_enum[], text, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.create_onboarding_organization(text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.create_onboarding_organization(text, text, text, text, text, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.create_onboarding_organization(text, text, text, text, text, text, text, text, text) to service_role;
grant execute on function public.create_onboarding_organization(text, text, text, text, text, text, text, text, jsonb, text, text, text) to service_role;
grant execute on function public.create_onboarding_organization(text, public.business_type_enum[], text, text, text, text, text, text, text) to service_role;
grant execute on function public.create_onboarding_organization(text, text, text, text, text, text) to service_role;
grant execute on function public.create_onboarding_organization(text, text, text, text, text, jsonb, text, text, text) to service_role;

revoke execute on function public.ensure_org_anonymous_customer_template(uuid) from public, anon, authenticated;
grant execute on function public.ensure_org_anonymous_customer_template(uuid) to service_role;

revoke execute on function public.get_account_status_snapshot(uuid) from anon;
grant execute on function public.get_account_status_snapshot(uuid) to authenticated, service_role;

revoke execute on function public.get_organization_capabilities(uuid) from public, anon;
grant execute on function public.get_organization_capabilities(uuid) to authenticated, service_role;

revoke execute on function public.get_user_branch_id() from public, anon;
grant execute on function public.get_user_branch_id() to authenticated, service_role;

revoke execute on function public.get_user_organization_id() from public, anon;
grant execute on function public.get_user_organization_id() to authenticated, service_role;

revoke execute on function public.get_user_role() from public, anon;
grant execute on function public.get_user_role() to authenticated, service_role;

revoke execute on function public.inventory_adjust_batch_execute(uuid, uuid, text, uuid, text, text, text, text, jsonb) from public, anon;
grant execute on function public.inventory_adjust_batch_execute(uuid, uuid, text, uuid, text, text, text, text, jsonb) to authenticated, service_role;

revoke execute on function public.inventory_adjust_batch_precheck(uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.inventory_adjust_batch_precheck(uuid, uuid, text, jsonb) to authenticated, service_role;

revoke execute on function public.inventory_transfer_batch_create(uuid, uuid, text, uuid, uuid, text, text, jsonb) from public, anon;
grant execute on function public.inventory_transfer_batch_create(uuid, uuid, text, uuid, uuid, text, text, jsonb) to authenticated, service_role;

revoke execute on function public.inventory_transfer_batch_precheck(uuid, uuid, uuid, jsonb) from public, anon;
grant execute on function public.inventory_transfer_batch_precheck(uuid, uuid, uuid, jsonb) to authenticated, service_role;

drop policy if exists "Templates are editable by admins" on public.notification_templates;
drop policy if exists "Templates are viewable by organization members" on public.notification_templates;

create policy "Templates are viewable by organization members"
  on public.notification_templates
  for select
  to authenticated
  using (
    organization_id in (
      select p.organization_id
      from public.profiles p
      where p.id = auth.uid()
    )
  );

create policy "Templates are insertable by admins"
  on public.notification_templates
  for insert
  to authenticated
  with check (
    organization_id in (
      select p.organization_id
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'::public.user_role
    )
  );

create policy "Templates are updatable by admins"
  on public.notification_templates
  for update
  to authenticated
  using (
    organization_id in (
      select p.organization_id
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'::public.user_role
    )
  )
  with check (
    organization_id in (
      select p.organization_id
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'::public.user_role
    )
  );

create policy "Templates are deletable by admins"
  on public.notification_templates
  for delete
  to authenticated
  using (
    organization_id in (
      select p.organization_id
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'::public.user_role
    )
  );

drop policy if exists "Org admins can update SIAT config" on public.organization_siat_config;
drop policy if exists "Org admins can view SIAT config" on public.organization_siat_config;

create policy "Org admins can view SIAT config"
  on public.organization_siat_config
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.organization_id = organization_siat_config.organization_id
        and p.id = auth.uid()
        and p.role = 'admin'::public.user_role
    )
  );

create policy "Org admins can insert SIAT config"
  on public.organization_siat_config
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.organization_id = organization_siat_config.organization_id
        and p.id = auth.uid()
        and p.role = 'admin'::public.user_role
    )
  );

create policy "Org admins can update SIAT config"
  on public.organization_siat_config
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.organization_id = organization_siat_config.organization_id
        and p.id = auth.uid()
        and p.role = 'admin'::public.user_role
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.organization_id = organization_siat_config.organization_id
        and p.id = auth.uid()
        and p.role = 'admin'::public.user_role
    )
  );

create policy "Org admins can delete SIAT config"
  on public.organization_siat_config
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.organization_id = organization_siat_config.organization_id
        and p.id = auth.uid()
        and p.role = 'admin'::public.user_role
    )
  );

drop policy if exists "Org members view own org" on public.organizations;
drop policy if exists "Organization members can update own organization during onboard" on public.organizations;

create policy "Org members view own org"
  on public.organizations
  for select
  to authenticated
  using (id = public.get_user_organization_id());

create policy "Org members update own org"
  on public.organizations
  for update
  to authenticated
  using (id = public.get_user_organization_id())
  with check (id = public.get_user_organization_id());
