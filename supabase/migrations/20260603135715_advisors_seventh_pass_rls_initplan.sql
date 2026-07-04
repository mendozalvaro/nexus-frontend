drop policy if exists "Appointments select" on public.appointments;
create policy "Appointments select"
  on public.appointments
  for select
  using (
    (organization_id = public.get_user_organization_id())
    and (
      (public.get_user_role() = 'admin'::public.user_role)
      or (branch_id = public.get_user_branch_id())
      or public.is_user_assigned_to_branch(branch_id)
      or (employee_id = (select auth.uid()))
      or (customer_id = (select auth.uid()))
    )
  );

drop policy if exists "Admins can view audit logs" on public.audit_logs;
create policy "Admins can view audit logs"
  on public.audit_logs
  for select
  using (
    exists (
      select 1
      from public.profiles p
      join public.organization_subscriptions os on p.organization_id = os.organization_id
      join public.subscription_plans sp on os.plan_id = sp.id
      where p.id = (select auth.uid())
        and p.role = 'admin'::public.user_role
        and sp.feature_forensic_export = true
    )
  );

drop policy if exists "Authenticated users can insert onboarding and dashboard audit l" on public.audit_logs;
create policy "Authenticated users can insert onboarding and dashboard audit l"
  on public.audit_logs
  for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
    and table_name = any (array['auth_sessions'::text, 'payment_validations'::text, 'onboarding_success'::text, 'dashboard_blocked_features'::text, 'pending_route_guard'::text])
    and action = 'INSERT'::public.audit_action
  );

drop policy if exists "Org admins can view billing ledger" on public.billing_ledger;
create policy "Org admins can view billing ledger"
  on public.billing_ledger
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.organization_id = billing_ledger.organization_id
        and p.id = (select auth.uid())
        and p.role = 'admin'::public.user_role
    )
  );

drop policy if exists "Service role can insert billing ledger" on public.billing_ledger;
create policy "Service role can insert billing ledger"
  on public.billing_ledger
  for insert
  to service_role
  with check ((select auth.role()) = 'service_role');

drop policy if exists "Client org select by linked client user" on public.client_org;
create policy "Client org select by linked client user"
  on public.client_org
  for select
  using (
    (organization_id = public.get_user_organization_id())
    or (
      client_id in (
        select c.id
        from public.clients c
        where c.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Clients select own user profile" on public.clients;
create policy "Clients select own user profile"
  on public.clients
  for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Clients update own user profile" on public.clients;
create policy "Clients update own user profile"
  on public.clients
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Inventory adjust batches select" on public.inventory_adjust_batches;
create policy "Inventory adjust batches select"
  on public.inventory_adjust_batches
  for select
  using (
    organization_id in (
      select profiles.organization_id
      from public.profiles
      where profiles.id = (select auth.uid())
    )
  );

drop policy if exists "Inventory document sequences select" on public.inventory_document_sequences;
create policy "Inventory document sequences select"
  on public.inventory_document_sequences
  for select
  using (
    organization_id in (
      select profiles.organization_id
      from public.profiles
      where profiles.id = (select auth.uid())
    )
  );

drop policy if exists "Inventory transfer batch lines select" on public.inventory_transfer_batch_lines;
create policy "Inventory transfer batch lines select"
  on public.inventory_transfer_batch_lines
  for select
  using (
    organization_id in (
      select profiles.organization_id
      from public.profiles
      where profiles.id = (select auth.uid())
    )
  );

drop policy if exists "Inventory transfer batches select" on public.inventory_transfer_batches;
create policy "Inventory transfer batches select"
  on public.inventory_transfer_batches
  for select
  using (
    organization_id in (
      select profiles.organization_id
      from public.profiles
      where profiles.id = (select auth.uid())
    )
  );

drop policy if exists "Notifications are insertable by service role" on public.notifications;
create policy "Notifications are insertable by service role"
  on public.notifications
  for insert
  to service_role
  with check ((select auth.role()) = 'service_role');

drop policy if exists "Notifications are updatable by service role" on public.notifications;
create policy "Notifications are updatable by service role"
  on public.notifications
  for update
  to service_role
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

drop policy if exists "Notifications are viewable by organization members" on public.notifications;
create policy "Notifications are viewable by organization members"
  on public.notifications
  for select
  using (
    organization_id in (
      select p.organization_id
      from public.profiles p
      where p.id = (select auth.uid())
    )
  );

drop policy if exists "Users manage own onboarding progress" on public.onboarding_progress;
create policy "Users manage own onboarding progress"
  on public.onboarding_progress
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Authenticated users can create pending organizations" on public.organizations;
create policy "Authenticated users can create pending organizations"
  on public.organizations
  for insert
  with check (
    (select auth.uid()) is not null
    and status = 'pending'::text
    and not exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.organization_id is not null
    )
  );

drop policy if exists "Org members update own org" on public.organizations;
create policy "Org members update own org"
  on public.organizations
  for update
  to authenticated
  using (id = public.get_user_organization_id())
  with check (id = public.get_user_organization_id());

drop policy if exists "Org members view own org" on public.organizations;
create policy "Org members view own org"
  on public.organizations
  for select
  to authenticated
  using (id = public.get_user_organization_id());

drop policy if exists "Org admins update payment validations" on public.payment_validations;
create policy "Org admins update payment validations"
  on public.payment_validations
  for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.organization_id = payment_validations.organization_id
        and p.role = 'admin'::public.user_role
    )
  );

drop policy if exists "Org admins view own payment validations" on public.payment_validations;
create policy "Org admins view own payment validations"
  on public.payment_validations
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.organization_id = payment_validations.organization_id
        and p.role = 'admin'::public.user_role
    )
    or user_id = (select auth.uid())
  );

drop policy if exists "Users insert own payment validations" on public.payment_validations;
create policy "Users insert own payment validations"
  on public.payment_validations
  for insert
  with check (user_id = (select auth.uid()));

drop policy if exists "Profile client map own read" on public.profile_client_map;
create policy "Profile client map own read"
  on public.profile_client_map
  for select
  to authenticated
  using (
    (profile_id = (select auth.uid()))
    or exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.organization_id = (
          select pr.organization_id
          from public.profiles pr
          where pr.id = profile_client_map.profile_id
        )
        and p.role = any (array['admin'::public.user_role, 'manager'::public.user_role])
    )
  );

drop policy if exists "Profile delete access" on public.profiles;
create policy "Profile delete access"
  on public.profiles
  for delete
  to authenticated
  using (
    (id = (select auth.uid()))
    or (
      (organization_id = public.get_user_organization_id())
      and (
        (public.get_user_role() = 'admin'::public.user_role)
        or (
          (public.get_user_role() = 'manager'::public.user_role)
          and exists (
            select 1
            from public.employee_branch_assignments manager_assignment
            join public.employee_branch_assignments target_assignment
              on target_assignment.branch_id = manager_assignment.branch_id
            where manager_assignment.user_id = (select auth.uid())
              and target_assignment.user_id = profiles.id
          )
        )
      )
    )
  );

drop policy if exists "Profile read access" on public.profiles;
create policy "Profile read access"
  on public.profiles
  for select
  to authenticated
  using (
    (id = (select auth.uid()))
    or (
      (organization_id = public.get_user_organization_id())
      and (
        (public.get_user_role() = 'admin'::public.user_role)
        or (
          (public.get_user_role() = 'manager'::public.user_role)
          and exists (
            select 1
            from public.employee_branch_assignments manager_assignment
            join public.employee_branch_assignments target_assignment
              on target_assignment.branch_id = manager_assignment.branch_id
            where manager_assignment.user_id = (select auth.uid())
              and target_assignment.user_id = profiles.id
          )
        )
      )
    )
  );

drop policy if exists "Profile update access" on public.profiles;
create policy "Profile update access"
  on public.profiles
  for update
  to authenticated
  using (
    (id = (select auth.uid()))
    or (
      (organization_id = public.get_user_organization_id())
      and (
        (public.get_user_role() = 'admin'::public.user_role)
        or (
          (public.get_user_role() = 'manager'::public.user_role)
          and exists (
            select 1
            from public.employee_branch_assignments manager_assignment
            join public.employee_branch_assignments target_assignment
              on target_assignment.branch_id = manager_assignment.branch_id
            where manager_assignment.user_id = (select auth.uid())
              and target_assignment.user_id = profiles.id
          )
        )
      )
    )
  )
  with check (
    (id = (select auth.uid()))
    or (
      (organization_id = public.get_user_organization_id())
      and (
        (public.get_user_role() = 'admin'::public.user_role)
        or (
          (public.get_user_role() = 'manager'::public.user_role)
          and exists (
            select 1
            from public.employee_branch_assignments manager_assignment
            join public.employee_branch_assignments target_assignment
              on target_assignment.branch_id = manager_assignment.branch_id
            where manager_assignment.user_id = (select auth.uid())
              and target_assignment.user_id = profiles.id
          )
        )
      )
    )
  );

drop policy if exists "Users can insert own profile during onboarding" on public.profiles;
create policy "Users can insert own profile during onboarding"
  on public.profiles
  for insert
  with check (id = (select auth.uid()));

drop policy if exists "Role module permissions org read" on public.role_module_permissions;
create policy "Role module permissions org read"
  on public.role_module_permissions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = any (array['admin'::public.user_role, 'manager'::public.user_role, 'employee'::public.user_role, 'client'::public.user_role])
    )
  );

drop policy if exists "System role module permissions system read" on public.system_role_module_permissions;
create policy "System role module permissions system read"
  on public.system_role_module_permissions
  for select
  to authenticated
  using (public.is_system_user((select auth.uid())));

drop policy if exists "System users can read their own membership" on public.system_users;
create policy "System users can read their own membership"
  on public.system_users
  for select
  to authenticated
  using (((select auth.uid()) = user_id) and (is_active = true));

drop policy if exists "Transactions select" on public.transactions;
create policy "Transactions select"
  on public.transactions
  for select
  using (
    (organization_id = public.get_user_organization_id())
    and (
      (public.get_user_role() = 'admin'::public.user_role)
      or (branch_id = public.get_user_branch_id())
      or public.is_user_assigned_to_branch(branch_id)
      or (employee_id = (select auth.uid()))
    )
  );
