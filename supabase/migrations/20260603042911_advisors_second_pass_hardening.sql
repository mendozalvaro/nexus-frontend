create or replace view public.admin_payment_stats
with (security_invoker = true) as
select
  count(*) filter (where status = 'pending') as pending_count,
  count(*) filter (where status = 'approved' and reviewed_at >= date_trunc('day', now())) as approved_today,
  count(*) filter (where status = 'rejected' and reviewed_at >= date_trunc('day', now())) as rejected_today,
  avg(extract(epoch from (reviewed_at - created_at)) / 60) filter (where reviewed_at is not null) as avg_review_minutes
from public.payment_validations;

alter function public.audit_organization_creation() set search_path = public;
alter function public.next_sales_order_number(uuid) set search_path = public;
alter function public.next_proforma_number(uuid) set search_path = public;
alter function public.create_onboarding_organization(text, text, text, text, text, text, text, text, text) set search_path = public;
alter function public.create_onboarding_organization(text, text, text, text, text, text, text, text, jsonb, text, text, text) set search_path = public;
alter function public.create_onboarding_organization(text, public.business_type_enum[], text, text, text, text, text, text, text) set search_path = public;
alter function public.create_onboarding_organization(text, text, text, text, text, text) set search_path = public;
alter function public.create_onboarding_organization(text, text, text, text, text, jsonb, text, text, text) set search_path = public;
alter function public.sync_client_org_billing_history() set search_path = public;
alter function public.notify_admin_new_receipt() set search_path = public;
alter function public.enforce_branch_limit() set search_path = public;
alter function public.sync_profile_role_columns() set search_path = public;
alter function public.get_organization_capabilities(uuid) set search_path = public;

revoke execute on function public.admin_get_payment_validation_detail(uuid) from public, anon;
grant execute on function public.admin_get_payment_validation_detail(uuid) to authenticated, service_role;

revoke execute on function public.admin_list_payment_validations(text, text, date, date, integer, integer) from public, anon;
grant execute on function public.admin_list_payment_validations(text, text, date, date, integer, integer) to authenticated, service_role;

revoke execute on function public.admin_payment_validation_stats() from public, anon;
grant execute on function public.admin_payment_validation_stats() to authenticated, service_role;

revoke execute on function public.admin_review_payment_validation(uuid, text, text) from public, anon;
grant execute on function public.admin_review_payment_validation(uuid, text, text) to authenticated, service_role;

revoke execute on function public.apply_inventory_stock_mutation(uuid, uuid, text, integer, integer, boolean) from public, anon;
grant execute on function public.apply_inventory_stock_mutation(uuid, uuid, text, integer, integer, boolean) to authenticated, service_role;

revoke execute on function public.audit_organization_creation() from public, anon, authenticated;
grant execute on function public.audit_organization_creation() to service_role;

drop policy if exists "System can insert billing ledger" on public.billing_ledger;
create policy "Service role can insert billing ledger"
  on public.billing_ledger
  for insert
  to service_role
  with check (auth.role() = 'service_role');

drop policy if exists "Notifications are insertable by service role" on public.notifications;
create policy "Notifications are insertable by service role"
  on public.notifications
  for insert
  to service_role
  with check (auth.role() = 'service_role');

drop policy if exists "Notifications are updatable by service role" on public.notifications;
create policy "Notifications are updatable by service role"
  on public.notifications
  for update
  to service_role
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Profile access" on public.profiles;
drop policy if exists "Users can update own profile during onboarding" on public.profiles;

create policy "Profile read access"
  on public.profiles
  for select
  to authenticated
  using (
    (id = auth.uid())
    or (
      (organization_id = get_user_organization_id())
      and (
        (get_user_role() = 'admin'::public.user_role)
        or (
          (get_user_role() = 'manager'::public.user_role)
          and exists (
            select 1
            from public.employee_branch_assignments manager_assignment
            join public.employee_branch_assignments target_assignment
              on target_assignment.branch_id = manager_assignment.branch_id
            where manager_assignment.user_id = auth.uid()
              and target_assignment.user_id = profiles.id
          )
        )
      )
    )
  );

create policy "Profile update access"
  on public.profiles
  for update
  to authenticated
  using (
    (id = auth.uid())
    or (
      (organization_id = get_user_organization_id())
      and (
        (get_user_role() = 'admin'::public.user_role)
        or (
          (get_user_role() = 'manager'::public.user_role)
          and exists (
            select 1
            from public.employee_branch_assignments manager_assignment
            join public.employee_branch_assignments target_assignment
              on target_assignment.branch_id = manager_assignment.branch_id
            where manager_assignment.user_id = auth.uid()
              and target_assignment.user_id = profiles.id
          )
        )
      )
    )
  )
  with check (
    (id = auth.uid())
    or (
      (organization_id = get_user_organization_id())
      and (
        (get_user_role() = 'admin'::public.user_role)
        or (
          (get_user_role() = 'manager'::public.user_role)
          and exists (
            select 1
            from public.employee_branch_assignments manager_assignment
            join public.employee_branch_assignments target_assignment
              on target_assignment.branch_id = manager_assignment.branch_id
            where manager_assignment.user_id = auth.uid()
              and target_assignment.user_id = profiles.id
          )
        )
      )
    )
  );

create policy "Profile delete access"
  on public.profiles
  for delete
  to authenticated
  using (
    (id = auth.uid())
    or (
      (organization_id = get_user_organization_id())
      and (
        (get_user_role() = 'admin'::public.user_role)
        or (
          (get_user_role() = 'manager'::public.user_role)
          and exists (
            select 1
            from public.employee_branch_assignments manager_assignment
            join public.employee_branch_assignments target_assignment
              on target_assignment.branch_id = manager_assignment.branch_id
            where manager_assignment.user_id = auth.uid()
              and target_assignment.user_id = profiles.id
          )
        )
      )
    )
  );

drop policy if exists "Sales orders staff select" on public.sales_orders;
drop policy if exists "Sales orders staff write" on public.sales_orders;

create policy "Sales orders staff select"
  on public.sales_orders
  for select
  to authenticated
  using (
    organization_id = get_user_organization_id()
    and get_user_role() in ('admin', 'manager', 'employee')
  );

create policy "Sales orders staff insert"
  on public.sales_orders
  for insert
  to authenticated
  with check (
    organization_id = get_user_organization_id()
    and get_user_role() in ('admin', 'manager', 'employee')
  );

create policy "Sales orders staff update"
  on public.sales_orders
  for update
  to authenticated
  using (
    organization_id = get_user_organization_id()
    and get_user_role() in ('admin', 'manager', 'employee')
  )
  with check (
    organization_id = get_user_organization_id()
    and get_user_role() in ('admin', 'manager', 'employee')
  );

create policy "Sales orders staff delete"
  on public.sales_orders
  for delete
  to authenticated
  using (
    organization_id = get_user_organization_id()
    and get_user_role() in ('admin', 'manager', 'employee')
  );

drop policy if exists "Sales order items staff select" on public.sales_order_items;
drop policy if exists "Sales order items staff write" on public.sales_order_items;

create policy "Sales order items staff select"
  on public.sales_order_items
  for select
  to authenticated
  using (
    organization_id = get_user_organization_id()
    and get_user_role() in ('admin', 'manager', 'employee')
  );

create policy "Sales order items staff insert"
  on public.sales_order_items
  for insert
  to authenticated
  with check (
    organization_id = get_user_organization_id()
    and get_user_role() in ('admin', 'manager', 'employee')
  );

create policy "Sales order items staff update"
  on public.sales_order_items
  for update
  to authenticated
  using (
    organization_id = get_user_organization_id()
    and get_user_role() in ('admin', 'manager', 'employee')
  )
  with check (
    organization_id = get_user_organization_id()
    and get_user_role() in ('admin', 'manager', 'employee')
  );

create policy "Sales order items staff delete"
  on public.sales_order_items
  for delete
  to authenticated
  using (
    organization_id = get_user_organization_id()
    and get_user_role() in ('admin', 'manager', 'employee')
  );

drop policy if exists "Sales proformas staff select" on public.sales_proformas;
drop policy if exists "Sales proformas staff write" on public.sales_proformas;

create policy "Sales proformas staff select"
  on public.sales_proformas
  for select
  to authenticated
  using (
    organization_id = get_user_organization_id()
    and get_user_role() in ('admin', 'manager', 'employee')
  );

create policy "Sales proformas staff insert"
  on public.sales_proformas
  for insert
  to authenticated
  with check (
    organization_id = get_user_organization_id()
    and get_user_role() in ('admin', 'manager', 'employee')
  );

create policy "Sales proformas staff update"
  on public.sales_proformas
  for update
  to authenticated
  using (
    organization_id = get_user_organization_id()
    and get_user_role() in ('admin', 'manager', 'employee')
  )
  with check (
    organization_id = get_user_organization_id()
    and get_user_role() in ('admin', 'manager', 'employee')
  );

create policy "Sales proformas staff delete"
  on public.sales_proformas
  for delete
  to authenticated
  using (
    organization_id = get_user_organization_id()
    and get_user_role() in ('admin', 'manager', 'employee')
  );

drop policy if exists "Organization assets are publicly accessible" on storage.objects;
