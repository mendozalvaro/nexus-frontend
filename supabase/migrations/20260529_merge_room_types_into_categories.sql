-- Merge room_types into categories
-- Adds lodging type to categories, removes room_types table

-- 1. Extend categories with lodging-specific columns
alter table categories add column if not exists description text;
alter table categories add column if not exists created_at timestamptz default now();
alter table categories add column if not exists updated_at timestamptz default now();

alter table categories drop constraint if exists categories_type_check;
alter table categories add constraint categories_type_check
  check (type in ('product', 'service', 'lodging'));

-- 2. Migrate room_types into categories
insert into categories (id, organization_id, name, type, description, is_active, created_at, updated_at)
select id, organization_id, name, 'lodging', description, is_active, created_at, updated_at
from room_types
on conflict (organization_id, name, type) do nothing;

-- 3. Re-point rooms FK from room_types → categories
alter table rooms add column if not exists category_id uuid;

update rooms r
set category_id = r.room_type_id
where r.room_type_id is not null;

alter table rooms drop column if exists room_type_id;
alter table rooms alter column category_id set not null;
alter table rooms add constraint rooms_category_fkey
  foreign key (category_id) references categories(id) on delete restrict;

-- 4. Drop room_types
drop trigger if exists update_room_type_updated_at on room_types;
drop trigger if exists audit_room_types on room_types;
drop index if exists idx_room_types_org;
drop table room_types cascade;

-- 5. New indexes
create index if not exists idx_rooms_category on rooms(category_id);

-- 6. Trigger for categories updated_at
create trigger if not exists update_category_updated_at before update on categories
  for each row execute procedure public.update_updated_at_column();

-- 7. Update RLS policies for categories (add lodging support)
drop policy if exists "Categories select" on categories;
create policy "Categories select" on categories for select
using ( organization_id = get_user_organization_id() );

drop policy if exists "Categories insert" on categories;
create policy "Categories insert" on categories for insert
with check (
    organization_id = get_user_organization_id()
    and get_user_role() in ('admin', 'manager')
);

drop policy if exists "Categories update" on categories;
create policy "Categories update" on categories for update
using (
    organization_id = get_user_organization_id()
    and get_user_role() in ('admin', 'manager')
);

drop policy if exists "Categories delete" on categories;
create policy "Categories delete" on categories for delete
using (
    organization_id = get_user_organization_id()
    and get_user_role() in ('admin', 'manager')
);
