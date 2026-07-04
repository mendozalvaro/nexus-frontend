-- Migration: Global role catalog + module permissions + profile role_id compatibility
-- Date: 2026-04-18

-- 1) Global role catalog (platform-owned)
create table if not exists public.user_roles (
  id uuid primary key default uuid_generate_v4(),
  code public.user_role not null unique,
  name text not null,
  description text not null default '',
  is_system boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_roles_code on public.user_roles(code);
create index if not exists idx_user_roles_active on public.user_roles(is_active);

-- 2) Module/action permissions for each global role
create table if not exists public.role_module_permissions (
  id uuid primary key default uuid_generate_v4(),
  role_id uuid not null references public.user_roles(id) on delete cascade,
  module_key text not null,
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  can_export boolean not null default false,
  can_manage boolean not null default false,
  can_approve boolean not null default false,
  can_assign boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (role_id, module_key)
);

create index if not exists idx_role_module_permissions_role on public.role_module_permissions(role_id);
create index if not exists idx_role_module_permissions_module on public.role_module_permissions(module_key);

-- 3) Module/action permissions for system panel roles
create table if not exists public.system_role_module_permissions (
  id uuid primary key default uuid_generate_v4(),
  system_role text not null check (system_role in ('system', 'support')),
  module_key text not null,
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  can_export boolean not null default false,
  can_manage boolean not null default false,
  can_approve boolean not null default false,
  can_assign boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (system_role, module_key)
);

create index if not exists idx_system_role_module_permissions_role on public.system_role_module_permissions(system_role);
create index if not exists idx_system_role_module_permissions_module on public.system_role_module_permissions(module_key);

-- 4) Profiles role reference
alter table public.profiles
  add column if not exists role_id uuid references public.user_roles(id) on delete set null;

create index if not exists idx_profiles_role_id on public.profiles(role_id);

-- 5) Keep compatibility between profiles.role (enum legacy) and profiles.role_id (new FK)
create or replace function public.sync_profile_role_columns()
returns trigger
language plpgsql
as $$
declare
  v_role_id uuid;
  v_role_code public.user_role;
begin
  if new.role_id is null and new.role is not null then
    select id into v_role_id
    from public.user_roles
    where code = new.role
    limit 1;

    if v_role_id is null then
      raise exception 'No role catalog entry for role %', new.role;
    end if;

    new.role_id := v_role_id;
  elsif new.role_id is not null then
    select code into v_role_code
    from public.user_roles
    where id = new.role_id
    limit 1;

    if v_role_code is null then
      raise exception 'Invalid role_id %', new.role_id;
    end if;

    new.role := v_role_code;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_profile_role_columns on public.profiles;
create trigger trg_sync_profile_role_columns
before insert or update on public.profiles
for each row
execute procedure public.sync_profile_role_columns();

-- 6) Seed global role catalog
insert into public.user_roles (code, name, description, is_system, is_active)
values
  ('admin', 'Administrador', 'Acceso completo de organizacion.', true, true),
  ('manager', 'Manager', 'Gestion operativa de equipo y procesos.', true, true),
  ('employee', 'Empleado', 'Operacion diaria enfocada en ventas y atencion.', true, true),
  ('client', 'Cliente', 'Acceso de portal cliente.', true, true)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  is_system = excluded.is_system,
  is_active = excluded.is_active,
  updated_at = now();

-- 7) Backfill profiles.role_id from existing enum role
update public.profiles p
set role_id = ur.id
from public.user_roles ur
where ur.code = p.role
  and p.role_id is null;

-- 8) Seed module permissions for org roles (baseline)
with module_list(module_key) as (
  values
    ('dashboard'),
    ('pos'),
    ('catalog'),
    ('inventory'),
    ('service_assignment'),
    ('appointments'),
    ('users'),
    ('branches'),
    ('reports'),
    ('settings'),
    ('billing'),
    ('profile')
),
role_ids as (
  select id, code from public.user_roles
),
seed as (
  select
    r.id as role_id,
    m.module_key,
    case
      when r.code = 'admin' then true
      when r.code = 'manager' and m.module_key in ('dashboard', 'pos', 'catalog', 'inventory', 'service_assignment', 'appointments', 'users', 'reports', 'profile') then true
      when r.code = 'employee' and m.module_key in ('dashboard', 'pos', 'appointments', 'reports', 'profile') then true
      when r.code = 'client' and m.module_key in ('appointments', 'reports', 'profile') then true
      else false
    end as can_view,
    case
      when r.code = 'admin' then true
      when r.code = 'manager' and m.module_key in ('pos', 'catalog', 'inventory', 'service_assignment', 'appointments', 'users') then true
      when r.code = 'employee' and m.module_key in ('pos', 'appointments') then true
      when r.code = 'client' and m.module_key = 'appointments' then true
      else false
    end as can_create,
    case
      when r.code = 'admin' then true
      when r.code = 'manager' and m.module_key in ('pos', 'catalog', 'inventory', 'service_assignment', 'appointments', 'users', 'profile') then true
      when r.code = 'employee' and m.module_key in ('appointments', 'profile') then true
      when r.code = 'client' and m.module_key = 'profile' then true
      else false
    end as can_edit,
    case
      when r.code = 'admin' then true
      when r.code = 'manager' and m.module_key in ('appointments') then true
      else false
    end as can_delete,
    case
      when r.code = 'admin' then true
      when r.code = 'manager' and m.module_key in ('reports') then true
      else false
    end as can_export,
    case
      when r.code = 'admin' then true
      else false
    end as can_manage,
    case
      when r.code = 'admin' then true
      else false
    end as can_approve,
    case
      when r.code = 'admin' and m.module_key = 'users' then true
      when r.code = 'manager' and m.module_key = 'users' then true
      else false
    end as can_assign
  from role_ids r
  cross join module_list m
)
insert into public.role_module_permissions (
  role_id, module_key,
  can_view, can_create, can_edit, can_delete,
  can_export, can_manage, can_approve, can_assign
)
select
  role_id, module_key,
  can_view, can_create, can_edit, can_delete,
  can_export, can_manage, can_approve, can_assign
from seed
on conflict (role_id, module_key) do update
set
  can_view = excluded.can_view,
  can_create = excluded.can_create,
  can_edit = excluded.can_edit,
  can_delete = excluded.can_delete,
  can_export = excluded.can_export,
  can_manage = excluded.can_manage,
  can_approve = excluded.can_approve,
  can_assign = excluded.can_assign,
  updated_at = now();

-- 9) Seed system role module permissions
with module_list(module_key) as (
  values
    ('system_dashboard'),
    ('system_users'),
    ('plans'),
    ('roles'),
    ('organizations'),
    ('billing_reviews'),
    ('audit')
),
seed as (
  select
    sr.system_role,
    m.module_key,
    case
      when sr.system_role = 'system' then true
      when sr.system_role = 'support' then true
      else false
    end as can_view,
    case
      when sr.system_role = 'system' then true
      when sr.system_role = 'support' and m.module_key in ('billing_reviews') then true
      else false
    end as can_create,
    case
      when sr.system_role = 'system' then true
      when sr.system_role = 'support' and m.module_key in ('billing_reviews') then true
      else false
    end as can_edit,
    case
      when sr.system_role = 'system' then true
      else false
    end as can_delete,
    case
      when sr.system_role = 'system' then true
      when sr.system_role = 'support' and m.module_key in ('system_users', 'organizations', 'billing_reviews') then true
      else false
    end as can_export,
    case
      when sr.system_role = 'system' then true
      else false
    end as can_manage,
    case
      when sr.system_role = 'system' then true
      when sr.system_role = 'support' and m.module_key = 'billing_reviews' then true
      else false
    end as can_approve,
    case
      when sr.system_role = 'system' then true
      else false
    end as can_assign
  from (values ('system'), ('support')) as sr(system_role)
  cross join module_list m
)
insert into public.system_role_module_permissions (
  system_role, module_key,
  can_view, can_create, can_edit, can_delete,
  can_export, can_manage, can_approve, can_assign
)
select
  system_role, module_key,
  can_view, can_create, can_edit, can_delete,
  can_export, can_manage, can_approve, can_assign
from seed
on conflict (system_role, module_key) do update
set
  can_view = excluded.can_view,
  can_create = excluded.can_create,
  can_edit = excluded.can_edit,
  can_delete = excluded.can_delete,
  can_export = excluded.can_export,
  can_manage = excluded.can_manage,
  can_approve = excluded.can_approve,
  can_assign = excluded.can_assign,
  updated_at = now();
