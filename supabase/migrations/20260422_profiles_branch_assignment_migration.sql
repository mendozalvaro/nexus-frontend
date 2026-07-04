-- Phase 1: migrate branch ownership from profiles.branch_id to employee_branch_assignments
-- Keeps backwards compatibility while code paths move to assignment-first.

-- 1) Backfill missing assignment rows from legacy profiles.branch_id
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

-- 2) Ensure a single deterministic primary assignment per internal user
with ranked_assignments as (
  select
    eba.id,
    eba.user_id,
    row_number() over (
      partition by eba.user_id
      order by
        case when eba.branch_id = p.branch_id then 0 else 1 end,
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

-- 3) Assignment-first branch resolver with temporary legacy fallback
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

  if v_branch_id is null then
    select p.branch_id
      into v_branch_id
    from public.profiles p
    where p.id = auth.uid();
  end if;

  return v_branch_id;
end;
$$ language plpgsql security definer;

