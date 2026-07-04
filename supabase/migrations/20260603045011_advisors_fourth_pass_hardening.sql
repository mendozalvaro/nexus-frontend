revoke execute on function public.inventory_transfer_batch_receive(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.inventory_transfer_batch_receive(uuid, uuid, uuid) to service_role;

revoke execute on function public.is_branch_in_user_organization(uuid) from public, anon;
grant execute on function public.is_branch_in_user_organization(uuid) to authenticated, service_role;

revoke execute on function public.is_system_user(uuid) from public, anon;
grant execute on function public.is_system_user(uuid) to authenticated, service_role;

revoke execute on function public.is_user_assigned_to_branch(uuid) from public, anon;
grant execute on function public.is_user_assigned_to_branch(uuid) to authenticated, service_role;

revoke execute on function public.next_inventory_document_code(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.next_inventory_document_code(uuid, text, text, integer) to service_role;

revoke execute on function public.next_proforma_number(uuid) from public, anon, authenticated;
grant execute on function public.next_proforma_number(uuid) to service_role;

revoke execute on function public.next_sales_order_number(uuid) from public, anon, authenticated;
grant execute on function public.next_sales_order_number(uuid) to service_role;

revoke execute on function public.notify_admin_new_receipt() from public, anon, authenticated;
grant execute on function public.notify_admin_new_receipt() to service_role;

revoke execute on function public.sync_client_org_billing_history() from public, anon, authenticated;
grant execute on function public.sync_client_org_billing_history() to service_role;

revoke execute on function public.trg_ensure_org_anonymous_customer_template() from public, anon, authenticated;
grant execute on function public.trg_ensure_org_anonymous_customer_template() to service_role;

revoke execute on function public.apply_inventory_stock_mutation(uuid, uuid, text, integer, integer, boolean) from authenticated;
grant execute on function public.apply_inventory_stock_mutation(uuid, uuid, text, integer, integer, boolean) to service_role;

drop policy if exists "Authenticated users can insert own auth audit logs" on public.audit_logs;

drop policy if exists "Guest customers org select" on public.guest_customers;
drop policy if exists "Guest customers org write" on public.guest_customers;

create policy "Guest customers org select"
  on public.guest_customers
  for select
  to authenticated
  using (
    organization_id = (select public.get_user_organization_id())
    and (
      (select public.get_user_role()) = 'admin'::public.user_role
      or branch_id = (select public.get_user_branch_id())
      or (branch_id is not null and public.is_user_assigned_to_branch(branch_id))
    )
  );

create policy "Guest customers org insert"
  on public.guest_customers
  for insert
  to authenticated
  with check (
    organization_id = (select public.get_user_organization_id())
    and (select public.get_user_role()) in ('admin', 'manager', 'employee')
  );

create policy "Guest customers org update"
  on public.guest_customers
  for update
  to authenticated
  using (
    organization_id = (select public.get_user_organization_id())
    and (select public.get_user_role()) in ('admin', 'manager', 'employee')
  )
  with check (
    organization_id = (select public.get_user_organization_id())
    and (select public.get_user_role()) in ('admin', 'manager', 'employee')
  );

create policy "Guest customers org delete"
  on public.guest_customers
  for delete
  to authenticated
  using (
    organization_id = (select public.get_user_organization_id())
    and (select public.get_user_role()) in ('admin', 'manager', 'employee')
  );

drop policy if exists "Preferences are editable by admins" on public.notification_preferences;
drop policy if exists "Preferences are viewable by organization members" on public.notification_preferences;

create policy "Preferences are viewable by organization members"
  on public.notification_preferences
  for select
  to authenticated
  using (
    organization_id in (
      select p.organization_id
      from public.profiles p
      where p.id = (select auth.uid())
    )
  );

create policy "Preferences are insertable by admins"
  on public.notification_preferences
  for insert
  to authenticated
  with check (
    organization_id in (
      select p.organization_id
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'::public.user_role
    )
  );

create policy "Preferences are updatable by admins"
  on public.notification_preferences
  for update
  to authenticated
  using (
    organization_id in (
      select p.organization_id
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'::public.user_role
    )
  )
  with check (
    organization_id in (
      select p.organization_id
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'::public.user_role
    )
  );

create policy "Preferences are deletable by admins"
  on public.notification_preferences
  for delete
  to authenticated
  using (
    organization_id in (
      select p.organization_id
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'::public.user_role
    )
  );

drop policy if exists "Templates are viewable by organization members" on public.notification_templates;
drop policy if exists "Templates are insertable by admins" on public.notification_templates;
drop policy if exists "Templates are updatable by admins" on public.notification_templates;
drop policy if exists "Templates are deletable by admins" on public.notification_templates;

create policy "Templates are viewable by organization members"
  on public.notification_templates
  for select
  to authenticated
  using (
    organization_id in (
      select p.organization_id
      from public.profiles p
      where p.id = (select auth.uid())
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
      where p.id = (select auth.uid())
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
      where p.id = (select auth.uid())
        and p.role = 'admin'::public.user_role
    )
  )
  with check (
    organization_id in (
      select p.organization_id
      from public.profiles p
      where p.id = (select auth.uid())
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
      where p.id = (select auth.uid())
        and p.role = 'admin'::public.user_role
    )
  );

drop policy if exists "Org admins can view SIAT config" on public.organization_siat_config;
drop policy if exists "Org admins can insert SIAT config" on public.organization_siat_config;
drop policy if exists "Org admins can update SIAT config" on public.organization_siat_config;
drop policy if exists "Org admins can delete SIAT config" on public.organization_siat_config;

create policy "Org admins can view SIAT config"
  on public.organization_siat_config
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.organization_id = organization_siat_config.organization_id
        and p.id = (select auth.uid())
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
        and p.id = (select auth.uid())
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
        and p.id = (select auth.uid())
        and p.role = 'admin'::public.user_role
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.organization_id = organization_siat_config.organization_id
        and p.id = (select auth.uid())
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
        and p.id = (select auth.uid())
        and p.role = 'admin'::public.user_role
    )
  );
