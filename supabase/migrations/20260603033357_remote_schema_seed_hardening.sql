-- Align local migrations with the effective remote schema and fix
-- the main security/performance warnings reported by Supabase advisors.

alter table public.guest_customers enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.user_roles enable row level security;
alter table public.role_module_permissions enable row level security;
alter table public.system_role_module_permissions enable row level security;
alter table public.profile_client_map enable row level security;

drop policy if exists "Guest customers org select" on public.guest_customers;
create policy "Guest customers org select"
on public.guest_customers
for select
using (
  organization_id = public.get_user_organization_id()
  and (
    public.get_user_role() = 'admin'
    or branch_id = public.get_user_branch_id()
    or (branch_id is not null and public.is_user_assigned_to_branch(branch_id))
  )
);

drop policy if exists "Guest customers org write" on public.guest_customers;
create policy "Guest customers org write"
on public.guest_customers
for all
using (
  organization_id = public.get_user_organization_id()
  and public.get_user_role() in ('admin', 'manager', 'employee')
)
with check (
  organization_id = public.get_user_organization_id()
  and public.get_user_role() in ('admin', 'manager', 'employee')
);

drop policy if exists "Subscription plans authenticated read" on public.subscription_plans;
create policy "Subscription plans authenticated read"
on public.subscription_plans
for select
to authenticated
using (coalesce(is_active, true));

drop policy if exists "User roles authenticated read" on public.user_roles;
create policy "User roles authenticated read"
on public.user_roles
for select
to authenticated
using (is_active = true);

drop policy if exists "Role module permissions org read" on public.role_module_permissions;
create policy "Role module permissions org read"
on public.role_module_permissions
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'manager', 'employee', 'client')
  )
);

drop policy if exists "System role module permissions system read" on public.system_role_module_permissions;
create policy "System role module permissions system read"
on public.system_role_module_permissions
for select
to authenticated
using (public.is_system_user(auth.uid()));

drop policy if exists "Profile client map own read" on public.profile_client_map;
create policy "Profile client map own read"
on public.profile_client_map
for select
to authenticated
using (
  profile_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = (
        select pr.organization_id
        from public.profiles pr
        where pr.id = profile_client_map.profile_id
      )
      and p.role in ('admin', 'manager')
  )
);

create or replace function public.get_user_organization_id()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select organization_id into v_org_id from public.profiles where id = auth.uid();
  return v_org_id;
end;
$$;

create or replace function public.get_user_branch_id()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid;
begin
  select eba.branch_id
    into v_branch_id
  from public.employee_branch_assignments eba
  where eba.user_id = auth.uid()
  order by eba.is_primary desc, eba.id asc
  limit 1;

  return v_branch_id;
end;
$$;

create or replace function public.get_user_role()
returns public.user_role
language plpgsql
security definer
set search_path = public
as $$
declare
  u_role public.user_role;
begin
  select role into u_role from public.profiles where id = auth.uid();
  return u_role;
end;
$$;

create or replace function public.is_user_assigned_to_branch(target_branch_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.employee_branch_assignments
    where user_id = auth.uid()
      and branch_id = target_branch_id
  );
end;
$$;

create or replace function public.is_branch_in_user_organization(target_branch_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.branches
    where id = target_branch_id
      and organization_id = public.get_user_organization_id()
  );
end;
$$;

create or replace function public.plan_billing_mode_enabled(
  p_available_billing_modes jsonb,
  p_billing_mode text
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_direct jsonb;
  v_item jsonb;
begin
  if p_available_billing_modes is null or jsonb_typeof(p_available_billing_modes) <> 'object' then
    return false;
  end if;

  v_direct := p_available_billing_modes -> p_billing_mode;
  if v_direct is not null and jsonb_typeof(v_direct) = 'object' then
    return coalesce((v_direct ->> 'enabled')::boolean, false);
  end if;

  for v_item in
    select value from jsonb_each(p_available_billing_modes)
  loop
    if jsonb_typeof(v_item) = 'object'
      and lower(coalesce(v_item ->> 'label', '')) = lower(p_billing_mode) then
      return coalesce((v_item ->> 'enabled')::boolean, false);
    end if;
  end loop;

  return false;
end;
$$;

create or replace function public.check_subscription_limit(org_id uuid, resource_type text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_limit int;
  v_current_count int;
  v_feature_enabled boolean;
begin
  select os.plan_id into v_plan_id
  from public.organization_subscriptions os
  where os.organization_id = org_id
    and os.status in ('active', 'trial')
    and os.current_period_end > now();

  if v_plan_id is null then
    raise exception 'No active subscription found.';
  end if;

  if resource_type = 'branch' then
    select max_branches into v_limit from public.subscription_plans where id = v_plan_id;
    select count(*) into v_current_count from public.branches where organization_id = org_id;

    if v_current_count >= v_limit then
      return false;
    end if;

    if v_current_count > 1 then
      select feature_multi_branch into v_feature_enabled from public.subscription_plans where id = v_plan_id;
      if not coalesce(v_feature_enabled, false) then
        return false;
      end if;
    end if;
  elsif resource_type = 'user' then
    select max_users into v_limit from public.subscription_plans where id = v_plan_id;
    select count(*) into v_current_count
    from public.profiles
    where organization_id = org_id
      and role <> 'client';

    if v_current_count >= v_limit then
      return false;
    end if;
  end if;

  return true;
end;
$$;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.audit_trigger_func()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_data jsonb;
  v_new_data jsonb;
  v_checksum text;
begin
  if tg_op = 'DELETE' then
    v_old_data = to_jsonb(old);
    v_new_data = null;
  elsif tg_op = 'UPDATE' then
    v_old_data = to_jsonb(old);
    v_new_data = to_jsonb(new);
  elsif tg_op = 'INSERT' then
    v_old_data = null;
    v_new_data = to_jsonb(new);
  end if;

  v_checksum = md5((coalesce(v_old_data::text, '') || coalesce(v_new_data::text, '') || tg_table_name || now()::text)::bytea);

  insert into public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data,
    ip_address,
    user_agent,
    context,
    checksum
  ) values (
    coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    tg_op::public.audit_action,
    tg_table_name,
    coalesce(old.id, new.id),
    v_old_data,
    v_new_data,
    inet_client_addr(),
    nullif(current_setting('request.headers', true)::json ->> 'user-agent', ''),
    nullif(current_setting('app.audit_context', true)::jsonb, null),
    v_checksum
  );

  return new;
end;
$$;

create or replace view public.admin_payment_stats as
select
  count(*) filter (where status = 'pending') as pending_count,
  count(*) filter (
    where status = 'approved'
      and reviewed_at >= date_trunc('day', now())
  ) as approved_today,
  count(*) filter (
    where status = 'rejected'
      and reviewed_at >= date_trunc('day', now())
  ) as rejected_today,
  avg(extract(epoch from (reviewed_at - created_at)) / 60) filter (
    where reviewed_at is not null
  ) as avg_review_minutes
from public.payment_validations;

drop index if exists public.idx_inventory_movements_org_created_at;
