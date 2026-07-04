-- Phase 2: remove legacy profiles.branch_id after assignment-first cutover.

-- Safety backfill before dropping the legacy column.
insert into public.employee_branch_assignments (
  user_id,
  branch_id,
  can_manage_inventory,
  can_override_prices,
  skills,
  is_primary
)
select
  p.id,
  p.branch_id,
  false,
  false,
  '[]'::jsonb,
  false
from public.profiles p
where p.role in ('manager', 'employee')
  and p.branch_id is not null
on conflict (user_id, branch_id) do nothing;

-- Safety fallback for internal users that still have no assignment at all:
-- assign first active branch in their organization as primary.
insert into public.employee_branch_assignments (
  user_id,
  branch_id,
  can_manage_inventory,
  can_override_prices,
  skills,
  is_primary
)
select
  p.id,
  fallback_branch.id,
  p.role = 'manager',
  false,
  '[]'::jsonb,
  true
from public.profiles p
join lateral (
  select b.id
  from public.branches b
  where b.organization_id = p.organization_id
    and b.is_active = true
  order by b.created_at asc, b.id asc
  limit 1
) fallback_branch on true
where p.role in ('manager', 'employee')
  and p.organization_id is not null
  and not exists (
    select 1
    from public.employee_branch_assignments e
    where e.user_id = p.id
  )
on conflict (user_id, branch_id) do nothing;

with ranked_assignments as (
  select
    eba.id,
    eba.user_id,
    row_number() over (
      partition by eba.user_id
      order by
        case when eba.is_primary then 0 else 1 end,
        eba.id
    ) as rn
  from public.employee_branch_assignments eba
  join public.profiles p on p.id = eba.user_id
  where p.role in ('manager', 'employee')
)
update public.employee_branch_assignments eba
set is_primary = ranked_assignments.rn = 1
from ranked_assignments
where eba.id = ranked_assignments.id;

create unique index if not exists idx_employee_branch_assignments_one_primary_per_user
  on public.employee_branch_assignments (user_id)
  where is_primary = true;

create or replace function public.get_user_branch_id()
returns uuid as $$
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
        and exists (
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
);

alter table public.profiles
  drop column if exists branch_id;
