create or replace function public.get_user_role() returns public.user_role as $$
declare
    u_role public.user_role;
begin
    select role into u_role from public.profiles where id = auth.uid();
    return u_role;
end;
$$ language plpgsql security definer;

create or replace function public.get_user_organization_id() returns uuid as $$
declare
    v_org_id uuid;
begin
    select organization_id into v_org_id from public.profiles where id = auth.uid();
    return v_org_id;
end;
$$ language plpgsql security definer;

create or replace function public.get_user_branch_id() returns uuid as $$
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
$$ language plpgsql security definer;

create or replace function public.is_user_assigned_to_branch(target_branch_id uuid) returns boolean as $$
begin
    return exists (
        select 1
        from public.employee_branch_assignments
        where user_id = auth.uid()
          and branch_id = target_branch_id
    );
end;
$$ language plpgsql security definer;

create or replace function public.is_branch_in_user_organization(target_branch_id uuid) returns boolean as $$
begin
    return exists (
        select 1
        from public.branches
        where id = target_branch_id
          and organization_id = public.get_user_organization_id()
    );
end;
$$ language plpgsql security definer;

drop policy if exists "Org members view own org" on public.organizations;
create policy "Org members view own org" on public.organizations for all
using (id = public.get_user_organization_id());

drop policy if exists "Branch access control" on public.branches;
create policy "Branch access control" on public.branches for all
using (
    organization_id = public.get_user_organization_id()
    and (
        public.get_user_role() = 'admin'
        or id = public.get_user_branch_id()
        or public.is_user_assigned_to_branch(id)
    )
);

drop policy if exists "Profile access" on public.profiles;
create policy "Profile access" on public.profiles for all
using (
    id = auth.uid()
    or (
        organization_id = public.get_user_organization_id()
        and (
            public.get_user_role() = 'admin'
            or (
                public.get_user_role() = 'manager'
                and (
                    exists (
                      select 1
                      from public.employee_branch_assignments manager_assignment
                      join public.employee_branch_assignments target_assignment
                        on target_assignment.branch_id = manager_assignment.branch_id
                      where manager_assignment.user_id = auth.uid()
                        and target_assignment.user_id = public.profiles.id
                    )
                )
            )
        )
    )
);

drop policy if exists "Inventory select" on public.inventory_stock;
create policy "Inventory select" on public.inventory_stock for select
using (
    branch_id in (
        select id
        from public.branches
        where organization_id = public.get_user_organization_id()
        and (
            public.get_user_role() = 'admin'
            or id = public.get_user_branch_id()
            or public.is_user_assigned_to_branch(id)
        )
    )
);

drop policy if exists "Inventory update" on public.inventory_stock;
create policy "Inventory update" on public.inventory_stock for update
using (
    public.get_user_role() in ('admin', 'manager')
    and (
      branch_id = public.get_user_branch_id()
      or public.is_user_assigned_to_branch(branch_id)
    )
);

drop policy if exists "Transactions select" on public.transactions;
create policy "Transactions select" on public.transactions for select
using (
    organization_id = public.get_user_organization_id()
    and (
        public.get_user_role() = 'admin'
        or branch_id = public.get_user_branch_id()
        or public.is_user_assigned_to_branch(branch_id)
        or employee_id = auth.uid()
    )
);

drop policy if exists "Subscriptions admin only" on public.organization_subscriptions;
create policy "Subscriptions admin only" on public.organization_subscriptions for all
using (
    public.get_user_role() = 'admin'
    and public.get_user_organization_id() = public.organization_subscriptions.organization_id
);

drop policy if exists "Services select" on public.services;
create policy "Services select" on public.services for select
using (organization_id = public.get_user_organization_id());

drop policy if exists "Products select" on public.products;
create policy "Products select" on public.products for select
using (organization_id = public.get_user_organization_id());

drop policy if exists "Appointments select" on public.appointments;
create policy "Appointments select" on public.appointments for select
using (
    organization_id = public.get_user_organization_id()
    and (
        public.get_user_role() = 'admin'
        or branch_id = public.get_user_branch_id()
        or public.is_user_assigned_to_branch(branch_id)
        or employee_id = auth.uid()
        or customer_id = auth.uid()
    )
);

drop policy if exists "Categories select" on public.categories;
create policy "Categories select" on public.categories for select
using (organization_id = public.get_user_organization_id());

drop policy if exists "Employee assignments select" on public.employee_branch_assignments;
create policy "Employee assignments select" on public.employee_branch_assignments for select
using (
    public.get_user_role() in ('admin', 'manager')
    and public.is_branch_in_user_organization(public.employee_branch_assignments.branch_id)
);

drop policy if exists "Authenticated users can insert own auth audit logs" on public.audit_logs;
create policy "Authenticated users can insert own auth audit logs" on public.audit_logs for insert
with check (
    auth.uid() is not null
    and user_id = auth.uid()
    and table_name = 'auth_sessions'
    and action = 'INSERT'
);
