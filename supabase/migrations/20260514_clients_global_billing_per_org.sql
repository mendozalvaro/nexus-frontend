-- Total migration: global clients + org-scoped electronic billing profile
-- Date: 2026-05-14

-- 1) client_org electronic billing active profile
alter table public.client_org
  add column if not exists document_type text,
  add column if not exists document_number text,
  add column if not exists billing_name text,
  add column if not exists billing_email text,
  add column if not exists billing_phone text,
  add column if not exists is_anonymous_template boolean not null default false;

update public.client_org
set document_type = coalesce(nullif(trim(document_type), ''), 'SIN_DOC')
where document_type is null or trim(document_type) = '';

alter table public.client_org
  alter column document_type set default 'SIN_DOC';

alter table public.client_org
  drop constraint if exists client_org_document_type_check;

alter table public.client_org
  add constraint client_org_document_type_check
  check (document_type in ('NIT', 'CI', 'SIN_DOC'));

alter table public.client_org
  drop constraint if exists client_org_document_number_required_check;

alter table public.client_org
  add constraint client_org_document_number_required_check
  check (
    (document_type in ('NIT', 'CI') and nullif(trim(document_number), '') is not null)
    or document_type = 'SIN_DOC'
  );

create unique index if not exists ux_client_org_org_doc_unique
  on public.client_org (organization_id, document_type, document_number)
  where document_type in ('NIT', 'CI') and document_number is not null;

create unique index if not exists ux_client_org_one_anonymous_template
  on public.client_org (organization_id)
  where is_anonymous_template = true and status = 'active';

-- 2) version history for org billing profile
create table if not exists public.client_org_billing_history (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_type text not null check (document_type in ('NIT', 'CI', 'SIN_DOC')),
  document_number text,
  billing_name text,
  billing_email text,
  billing_phone text,
  is_active_version boolean not null default true,
  change_reason text,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_client_org_billing_history_org_client
  on public.client_org_billing_history (organization_id, client_id, changed_at desc);

create unique index if not exists ux_client_org_billing_history_active
  on public.client_org_billing_history (organization_id, client_id)
  where is_active_version = true;

alter table public.client_org_billing_history enable row level security;

-- 3) helper trigger to version billing profile updates
create or replace function public.sync_client_org_billing_history()
returns trigger
language plpgsql
security definer
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.client_org_billing_history (
      client_id,
      organization_id,
      document_type,
      document_number,
      billing_name,
      billing_email,
      billing_phone,
      is_active_version,
      change_reason,
      changed_by,
      changed_at
    )
    values (
      new.client_id,
      new.organization_id,
      coalesce(new.document_type, 'SIN_DOC'),
      new.document_number,
      new.billing_name,
      new.billing_email,
      new.billing_phone,
      true,
      'INITIAL',
      null,
      now()
    )
    on conflict do nothing;

    return new;
  end if;

  if (
    coalesce(new.document_type, '') is distinct from coalesce(old.document_type, '')
    or coalesce(new.document_number, '') is distinct from coalesce(old.document_number, '')
    or coalesce(new.billing_name, '') is distinct from coalesce(old.billing_name, '')
    or coalesce(new.billing_email, '') is distinct from coalesce(old.billing_email, '')
    or coalesce(new.billing_phone, '') is distinct from coalesce(old.billing_phone, '')
  ) then
    update public.client_org_billing_history
    set is_active_version = false
    where client_id = old.client_id
      and organization_id = old.organization_id
      and is_active_version = true;

    insert into public.client_org_billing_history (
      client_id,
      organization_id,
      document_type,
      document_number,
      billing_name,
      billing_email,
      billing_phone,
      is_active_version,
      change_reason,
      changed_by,
      changed_at
    )
    values (
      new.client_id,
      new.organization_id,
      coalesce(new.document_type, 'SIN_DOC'),
      new.document_number,
      new.billing_name,
      new.billing_email,
      new.billing_phone,
      true,
      'PROFILE_UPDATE',
      null,
      now()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_client_org_billing_history on public.client_org;
create trigger trg_client_org_billing_history
after insert or update on public.client_org
for each row
execute function public.sync_client_org_billing_history();

-- 4) seed missing billing profile fields from legacy json
update public.client_org
set
  billing_name = coalesce(nullif(trim(billing_name), ''), nullif(trim((billing_data ->> 'billingName')), ''), nullif(trim((billing_data ->> 'razonSocial')), '')),
  billing_email = coalesce(nullif(trim(billing_email), ''), nullif(trim((billing_data ->> 'email')), '')),
  billing_phone = coalesce(nullif(trim(billing_phone), ''), nullif(trim((billing_data ->> 'phone')), '')),
  document_type = coalesce(
    nullif(trim(document_type), ''),
    case
      when upper(trim(coalesce(billing_data ->> 'documentType', billing_data ->> 'tipoDocumento', ''))) in ('NIT', 'CI', 'SIN_DOC')
        then upper(trim(coalesce(billing_data ->> 'documentType', billing_data ->> 'tipoDocumento', '')))
      else 'SIN_DOC'
    end
  ),
  document_number = coalesce(nullif(trim(document_number), ''), nullif(trim(coalesce(billing_data ->> 'documentNumber', billing_data ->> 'numeroDocumento', billing_data ->> 'nit', billing_data ->> 'ci', '')), ''))
where true;

-- 5) map legacy profile clients into clients table
create table if not exists public.profile_client_map (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now()
);

insert into public.clients (
  user_id,
  first_name,
  last_name,
  phone,
  email,
  billing_data,
  preferences
)
select
  p.id,
  split_part(trim(p.full_name), ' ', 1),
  nullif(trim(replace(trim(p.full_name), split_part(trim(p.full_name), ' ', 1), '')), ''),
  nullif(trim(p.phone), ''),
  nullif(trim(p.email), ''),
  '{}'::jsonb,
  '{}'::jsonb
from public.profiles p
where p.role = 'client'
  and not exists (
    select 1 from public.clients c where c.user_id = p.id
  );

insert into public.profile_client_map (profile_id, client_id)
select p.id, c.id
from public.profiles p
join public.clients c on c.user_id = p.id
where p.role = 'client'
on conflict (profile_id) do update set client_id = excluded.client_id;

-- 6) ensure client_org links for mapped clients
insert into public.client_org (
  client_id,
  organization_id,
  status,
  billing_data,
  document_type,
  document_number,
  billing_name,
  billing_email,
  billing_phone,
  is_anonymous_template
)
select
  pcm.client_id,
  p.organization_id,
  'active',
  '{}'::jsonb,
  'SIN_DOC',
  null,
  p.full_name,
  p.email,
  p.phone,
  false
from public.profile_client_map pcm
join public.profiles p on p.id = pcm.profile_id
where p.organization_id is not null
on conflict (client_id, organization_id)
do update set
  billing_name = coalesce(public.client_org.billing_name, excluded.billing_name),
  billing_email = coalesce(public.client_org.billing_email, excluded.billing_email),
  billing_phone = coalesce(public.client_org.billing_phone, excluded.billing_phone);

-- 7) create one anonymous template per org if missing
insert into public.clients (
  user_id,
  first_name,
  last_name,
  phone,
  email,
  billing_data,
  preferences
)
select
  null,
  'Cliente',
  'Anonimo',
  null,
  null,
  '{}'::jsonb,
  jsonb_build_object('system', true, 'anonymous_template', true)
from public.organizations o
where not exists (
  select 1
  from public.client_org co
  join public.clients c on c.id = co.client_id
  where co.organization_id = o.id
    and co.is_anonymous_template = true
)
;

insert into public.client_org (
  client_id,
  organization_id,
  status,
  billing_data,
  document_type,
  document_number,
  billing_name,
  billing_email,
  billing_phone,
  is_anonymous_template
)
select
  c.id,
  o.id,
  'active',
  '{}'::jsonb,
  'SIN_DOC',
  null,
  'CLIENTE ANONIMO',
  null,
  null,
  true
from public.organizations o
join lateral (
  select id
  from public.clients
  where user_id is null
    and first_name = 'Cliente'
    and last_name = 'Anonimo'
  order by created_at desc
  limit 1
) c on true
where not exists (
  select 1 from public.client_org co
  where co.organization_id = o.id
    and co.is_anonymous_template = true
)
on conflict (client_id, organization_id) do nothing;

-- 8) migrate transactional references from profiles.id -> clients.id
alter table public.transactions
  drop constraint if exists transactions_customer_id_fkey;

alter table public.appointments
  drop constraint if exists appointments_customer_id_fkey;

update public.transactions t
set customer_id = pcm.client_id
from public.profile_client_map pcm
where t.customer_id = pcm.profile_id;

update public.appointments a
set customer_id = pcm.client_id
from public.profile_client_map pcm
where a.customer_id = pcm.profile_id;

-- replace null customers by org anonymous template when snapshot exists
update public.transactions t
set customer_id = co.client_id
from public.client_org co
where t.customer_id is null
  and t.organization_id = co.organization_id
  and co.is_anonymous_template = true
  and co.status = 'active';

update public.appointments a
set customer_id = co.client_id
from public.client_org co
where a.customer_id is null
  and a.organization_id = co.organization_id
  and co.is_anonymous_template = true
  and co.status = 'active';

-- 9) rebind FKs to clients
alter table public.transactions
  drop constraint if exists transactions_customer_id_fkey;

alter table public.transactions
  add constraint transactions_customer_id_fkey
  foreign key (customer_id) references public.clients(id) on delete set null;

alter table public.appointments
  drop constraint if exists appointments_customer_id_fkey;

alter table public.appointments
  add constraint appointments_customer_id_fkey
  foreign key (customer_id) references public.clients(id) on delete set null;

-- 10) RLS for history + stronger org policy
drop policy if exists "Client org history select" on public.client_org_billing_history;
create policy "Client org history select"
on public.client_org_billing_history
for select
using (
  organization_id = public.get_user_organization_id()
);

drop policy if exists "Client org history insert" on public.client_org_billing_history;
create policy "Client org history insert"
on public.client_org_billing_history
for insert
with check (
  organization_id = public.get_user_organization_id()
);

-- for app logic that still reads legacy policy names
drop policy if exists "Client org select by linked client user" on public.client_org;
create policy "Client org select by linked client user"
on public.client_org
for select
using (
  organization_id = public.get_user_organization_id()
  or client_id in (
    select c.id from public.clients c where c.user_id = auth.uid()
  )
);
