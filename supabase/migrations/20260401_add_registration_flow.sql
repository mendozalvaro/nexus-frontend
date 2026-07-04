alter table public.organizations add column if not exists billing_data jsonb default '{}'::jsonb;
alter table public.organizations add column if not exists logo_url text;
alter table public.organizations add column if not exists address text;
alter table public.organizations add column if not exists status text default 'pending' check (status in ('pending', 'active', 'suspended', 'rejected'));

create table if not exists public.onboarding_progress (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  organization_id uuid references public.organizations(id) on delete cascade,
  current_step text check (current_step in ('registration', 'verification', 'organization', 'payment', 'completed')),
  progress_data jsonb default '{}'::jsonb,
  updated_at timestamptz default now(),
  unique(user_id)
);

create table if not exists public.payment_validations (
  id uuid default uuid_generate_v4() primary key,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount numeric(10,2) not null,
  payment_method text default 'bank_transfer',
  transaction_ref text,
  receipt_storage_path text not null,
  receipt_filename text not null,
  receipt_mime_type text,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_onboarding_progress_user on public.onboarding_progress(user_id);
create index if not exists idx_payment_validations_org_status on public.payment_validations(organization_id, status, created_at desc);

drop trigger if exists update_payment_validations_updated_at on public.payment_validations;
create trigger update_payment_validations_updated_at before update on public.payment_validations
for each row execute procedure public.update_updated_at_column();

create or replace function public.notify_admin_new_receipt() returns trigger as $$
begin
  insert into public.audit_logs (user_id, action, table_name, record_id, context)
  values (
    new.user_id,
    'INSERT',
    'payment_validations',
    new.id,
    jsonb_build_object('organization_id', new.organization_id, 'amount', new.amount, 'status', new.status)
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace function public.create_onboarding_organization(
  p_name text,
  p_slug text,
  p_timezone text,
  p_currency text,
  p_address text,
  p_billing_data jsonb,
  p_full_name text,
  p_email text,
  p_phone text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_existing_org_id uuid;
  v_organization_id uuid;
  v_plan_id uuid;
  v_name text;
  v_slug text;
  v_timezone text;
  v_currency text;
  v_address text;
  v_full_name text;
  v_email text;
  v_phone text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Tu sesion no es valida. Inicia sesion nuevamente.';
  end if;

  v_name := nullif(trim(coalesce(p_name, '')), '');
  v_slug := nullif(trim(coalesce(p_slug, '')), '');
  v_timezone := nullif(trim(coalesce(p_timezone, '')), '');
  v_currency := upper(nullif(trim(coalesce(p_currency, '')), ''));
  v_address := nullif(trim(coalesce(p_address, '')), '');
  v_full_name := nullif(trim(coalesce(p_full_name, '')), '');
  v_email := lower(nullif(trim(coalesce(p_email, '')), ''));
  v_phone := nullif(trim(coalesce(p_phone, '')), '');

  if v_name is null or v_slug is null or v_timezone is null or v_currency is null or v_address is null then
    raise exception 'Completa todos los campos requeridos de la organizacion.';
  end if;

  select organization_id
    into v_existing_org_id
  from public.profiles
  where id = v_user_id;

  if v_existing_org_id is not null then
    return v_existing_org_id;
  end if;

  if exists (
    select 1
    from public.organizations
    where slug = v_slug
  ) then
    raise exception 'Este nombre de organizacion no esta disponible.';
  end if;

  insert into public.organizations (
    name,
    slug,
    currency_code,
    timezone,
    address,
    billing_data,
    status,
    is_active
  )
  values (
    v_name,
    v_slug,
    v_currency,
    v_timezone,
    v_address,
    coalesce(p_billing_data, '{}'::jsonb),
    'pending',
    true
  )
  returning id into v_organization_id;

  insert into public.profiles (
    id,
    email,
    full_name,
    phone,
    organization_id,
    role,
    is_active,
    updated_at
  )
  values (
    v_user_id,
    coalesce(v_email, ''),
    coalesce(v_full_name, 'Administrador NexusPOS'),
    v_phone,
    v_organization_id,
    'admin',
    true,
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    phone = excluded.phone,
    organization_id = excluded.organization_id,
    role = excluded.role,
    is_active = excluded.is_active,
    updated_at = now();

  select id
    into v_plan_id
  from public.subscription_plans
  where slug = 'emprende'
  limit 1;

  if v_plan_id is not null then
    insert into public.organization_subscriptions (
      organization_id,
      plan_id,
      status,
      current_period_start,
      current_period_end
    )
    values (
      v_organization_id,
      v_plan_id,
      'trial',
      now(),
      now() + interval '7 days'
    )
    on conflict (organization_id) do update
    set
      plan_id = excluded.plan_id,
      status = excluded.status,
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end;
  end if;

  insert into public.onboarding_progress (
    user_id,
    organization_id,
    current_step,
    progress_data,
    updated_at
  )
  values (
    v_user_id,
    v_organization_id,
    'payment',
    jsonb_build_object(
      'organizationId', v_organization_id,
      'organizationDraft', jsonb_build_object(
        'organizationName', v_name,
        'slug', v_slug,
        'timezone', v_timezone,
        'currency', v_currency,
        'address', v_address,
        'billingData', coalesce(p_billing_data, '{}'::jsonb),
        'logoPreviewUrl', null,
        'logoFileName', null
      )
    ),
    now()
  )
  on conflict (user_id) do update
  set
    organization_id = excluded.organization_id,
    current_step = excluded.current_step,
    progress_data = excluded.progress_data,
    updated_at = now();

  return v_organization_id;
end;
$$;

drop trigger if exists trg_notify_admin_receipt on public.payment_validations;
create trigger trg_notify_admin_receipt
after insert on public.payment_validations
for each row execute procedure public.notify_admin_new_receipt();

alter table public.onboarding_progress enable row level security;
alter table public.payment_validations enable row level security;

drop policy if exists "Org members view own org" on public.organizations;
create policy "Org members view own org" on public.organizations
for select
using (id = public.get_user_organization_id());

drop policy if exists "Authenticated users can create pending organizations" on public.organizations;
create policy "Authenticated users can create pending organizations" on public.organizations
for insert
with check (
  auth.uid() is not null
  and status = 'pending'
  and not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id is not null
  )
);

drop policy if exists "Organization members can update own organization during onboarding" on public.organizations;
create policy "Organization members can update own organization during onboarding" on public.organizations
for update
using (id = public.get_user_organization_id())
with check (id = public.get_user_organization_id());

drop policy if exists "Users can insert own profile during onboarding" on public.profiles;
create policy "Users can insert own profile during onboarding" on public.profiles
for insert
with check (id = auth.uid());

drop policy if exists "Users can update own profile during onboarding" on public.profiles;
create policy "Users can update own profile during onboarding" on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Users manage own onboarding progress" on public.onboarding_progress;
create policy "Users manage own onboarding progress" on public.onboarding_progress
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Org admins view own payment validations" on public.payment_validations;
create policy "Org admins view own payment validations" on public.payment_validations
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = payment_validations.organization_id
      and p.role = 'admin'
  )
  or user_id = auth.uid()
);

drop policy if exists "Users insert own payment validations" on public.payment_validations;
create policy "Users insert own payment validations" on public.payment_validations
for insert
with check (user_id = auth.uid());

drop policy if exists "Org admins update payment validations" on public.payment_validations;
create policy "Org admins update payment validations" on public.payment_validations
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = payment_validations.organization_id
      and p.role = 'admin'
  )
);

-- Storage buckets to crear manualmente en Supabase Dashboard:
-- 1. receipts
-- 2. organization-assets
--
-- receipts:
--   path sugerido: {auth.uid()}/{organization_id}/{timestamp}_{filename}
--   insert policy: primer folder = auth.uid()
--   select policy: owner o admin de la misma organizacion
--
-- organization-assets:
--   path sugerido: {organization_id}/logos/{timestamp}_{filename}
--   insert/select policy: miembros autenticados de la organizacion
