create extension if not exists "btree_gist";

create table if not exists guest_customers (
    id uuid default uuid_generate_v4() primary key,
    organization_id uuid references organizations(id) on delete cascade not null,
    branch_id uuid references branches(id) on delete set null,
    full_name text not null,
    phone text,
    notes text,
    created_by uuid references profiles(id) on delete set null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index if not exists idx_guest_customers_org on guest_customers(organization_id);
create index if not exists idx_guest_customers_branch on guest_customers(branch_id);
create index if not exists idx_guest_customers_phone on guest_customers(phone);

drop index if exists idx_appointments_time_range;
create index if not exists idx_appointments_employee_range_gist
  on appointments
  using gist (
    employee_id,
    organization_id,
    tstzrange(start_time, end_time, '[)')
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'appointments_no_overlap_per_employee'
  ) then
    alter table appointments
      add constraint appointments_no_overlap_per_employee
      exclude using gist (
        employee_id with =,
        organization_id with =,
        tstzrange(start_time, end_time, '[)') with &&
      )
      where (status in ('pending', 'confirmed', 'in_progress'));
  end if;
end $$;
