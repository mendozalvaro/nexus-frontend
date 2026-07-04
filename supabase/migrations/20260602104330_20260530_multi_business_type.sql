-- Remote-alignment migration captured from linked project.
-- Replace legacy single business_type handling with multi-business support.

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'business_type_enum'
  ) then
    create type public.business_type_enum as enum ('product', 'service', 'lodging');
  end if;
end $$;

create table if not exists public.organization_business_types (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_type public.business_type_enum not null,
  primary key (organization_id, business_type)
);

alter table public.organization_business_types enable row level security;

drop policy if exists "Business types select" on public.organization_business_types;
create policy "Business types select"
on public.organization_business_types
for select
using (organization_id = public.get_user_organization_id());

drop policy if exists "Business types insert" on public.organization_business_types;
create policy "Business types insert"
on public.organization_business_types
for insert
with check (
  organization_id = public.get_user_organization_id()
  and public.get_user_role() = 'admin'
);

drop policy if exists "Business types delete" on public.organization_business_types;
create policy "Business types delete"
on public.organization_business_types
for delete
using (
  organization_id = public.get_user_organization_id()
  and public.get_user_role() = 'admin'
);

alter table public.subscription_plans
  add column if not exists allowed_business_types public.business_type_enum[] not null default '{product,service,lodging}'::public.business_type_enum[],
  add column if not exists max_business_types int default 1;

update public.subscription_plans
set max_business_types = case
  when slug = 'emprende' then 1
  else 2
end
where max_business_types is null;

alter table public.subscription_plans
  drop constraint if exists subscription_plans_max_business_types_check;

alter table public.subscription_plans
  add constraint subscription_plans_max_business_types_check
  check (max_business_types in (1, 2, 3));

insert into public.organization_business_types (organization_id, business_type)
select
  o.id,
  case lower(coalesce((o.billing_data ->> 'businessType'), ''))
    when 'products' then 'product'::public.business_type_enum
    when 'product' then 'product'::public.business_type_enum
    when 'services' then 'service'::public.business_type_enum
    when 'service' then 'service'::public.business_type_enum
    when 'lodging' then 'lodging'::public.business_type_enum
    else 'product'::public.business_type_enum
  end
from public.organizations o
where not exists (
  select 1
  from public.organization_business_types obt
  where obt.organization_id = o.id
)
on conflict do nothing;
