create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  first_name text not null,
  last_name text,
  phone text,
  email text,
  billing_data jsonb not null default '{}'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_clients_phone_not_null
  on public.clients(phone)
  where phone is not null;

create unique index if not exists ux_clients_email_not_null
  on public.clients(email)
  where email is not null;

create index if not exists idx_clients_user_id
  on public.clients(user_id);

create table if not exists public.client_org (
  client_id uuid not null references public.clients(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'inactive', 'blocked')),
  billing_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (client_id, organization_id)
);

create index if not exists idx_client_org_client_id
  on public.client_org(client_id);

create index if not exists idx_client_org_organization_id
  on public.client_org(organization_id);

drop trigger if exists update_clients_updated_at on public.clients;
create trigger update_clients_updated_at
before update on public.clients
for each row execute procedure public.update_updated_at_column();

drop trigger if exists update_client_org_updated_at on public.client_org;
create trigger update_client_org_updated_at
before update on public.client_org
for each row execute procedure public.update_updated_at_column();

alter table public.clients enable row level security;
alter table public.client_org enable row level security;

drop policy if exists "Clients select own user profile" on public.clients;
create policy "Clients select own user profile"
on public.clients
for select
using (auth.uid() = user_id);

drop policy if exists "Clients update own user profile" on public.clients;
create policy "Clients update own user profile"
on public.clients
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Client org select by linked client user" on public.client_org;
create policy "Client org select by linked client user"
on public.client_org
for select
using (
  client_id in (
    select c.id
    from public.clients c
    where c.user_id = auth.uid()
  )
);
