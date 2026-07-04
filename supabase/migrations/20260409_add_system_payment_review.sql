create table if not exists public.system_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'system' check (role in ('system')),
  is_active boolean not null default true,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table public.system_users enable row level security;

drop policy if exists "System users can read their own membership" on public.system_users;
create policy "System users can read their own membership"
on public.system_users
for select
to authenticated
using (auth.uid() = user_id and is_active = true);

create or replace function public.is_system_user(input_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.system_users su
    where su.user_id = coalesce(input_user_id, auth.uid())
      and su.role = 'system'
      and su.is_active = true
  );
$$;

grant execute on function public.is_system_user(uuid) to authenticated;

alter table public.payment_validations
  add column if not exists reviewed_by_system_user uuid references auth.users(id);

create index if not exists idx_payment_validations_status
on public.payment_validations(status, created_at desc);

create index if not exists idx_payment_validations_org
on public.payment_validations(organization_id, status);

create index if not exists idx_payment_validations_reviewed_system
on public.payment_validations(reviewed_by_system_user, reviewed_at desc);

drop policy if exists "Owners can view receipts" on storage.objects;
drop policy if exists "Owners and platform admins can view receipts" on storage.objects;
drop policy if exists "Owners and system users can view receipts" on storage.objects;

create policy "Owners and system users can view receipts"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'receipts'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_system_user(auth.uid())
  )
);

create or replace view public.admin_payment_stats as
select
  count(*) filter (where status = 'pending') as pending_count,
  count(*) filter (
    where status = 'approved'
      and reviewed_at >= date_trunc('day', now())
  ) as approved_today,
  count(*) filter (
    where status = 'rejected'
      and reviewed_at >= date_trunc('day', now())
  ) as rejected_today,
  avg(extract(epoch from (reviewed_at - created_at)) / 60) filter (
    where reviewed_at is not null
  ) as avg_review_minutes
from public.payment_validations;

create or replace function public.admin_payment_validation_stats()
returns table (
  pending_count bigint,
  approved_today bigint,
  rejected_today bigint,
  avg_review_minutes numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_system_user(auth.uid()) then
    raise exception 'SYSTEM_ACCESS_REQUIRED'
      using errcode = '42501';
  end if;

  return query
  select
    aps.pending_count::bigint,
    aps.approved_today::bigint,
    aps.rejected_today::bigint,
    coalesce(aps.avg_review_minutes, 0)::numeric
  from public.admin_payment_stats aps;
end;
$$;

create or replace function public.admin_list_payment_validations(
  p_search text default null,
  p_status text default 'all',
  p_date_from date default null,
  p_date_to date default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns table (
  total_count bigint,
  id uuid,
  organization_id uuid,
  organization_name text,
  organization_slug text,
  user_id uuid,
  user_full_name text,
  user_email text,
  amount numeric,
  payment_method text,
  transaction_ref text,
  status text,
  created_at timestamptz,
  reviewed_at timestamptz,
  rejection_reason text,
  reviewed_by_name text,
  receipt_filename text,
  receipt_mime_type text,
  receipt_storage_path text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_page integer := greatest(coalesce(p_page, 1), 1);
  safe_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 100);
  safe_offset integer := (greatest(coalesce(p_page, 1), 1) - 1) * least(greatest(coalesce(p_page_size, 20), 1), 100);
  normalized_search text := nullif(trim(coalesce(p_search, '')), '');
  normalized_status text := lower(coalesce(p_status, 'all'));
begin
  if not public.is_system_user(auth.uid()) then
    raise exception 'SYSTEM_ACCESS_REQUIRED'
      using errcode = '42501';
  end if;

  return query
  with filtered as (
    select
      pv.id,
      pv.organization_id,
      org.name as organization_name,
      org.slug as organization_slug,
      pv.user_id,
      submitter.full_name as user_full_name,
      submitter.email as user_email,
      pv.amount,
      pv.payment_method,
      pv.transaction_ref,
      pv.status,
      pv.created_at,
      pv.reviewed_at,
      pv.rejection_reason,
      reviewer.full_name as reviewed_by_name,
      pv.receipt_filename,
      pv.receipt_mime_type,
      pv.receipt_storage_path
    from public.payment_validations pv
    inner join public.organizations org on org.id = pv.organization_id
    inner join public.profiles submitter on submitter.id = pv.user_id
    left join public.system_users reviewer on reviewer.user_id = pv.reviewed_by_system_user
    where
      (
        normalized_status = 'all'
        or pv.status = normalized_status
      )
      and (p_date_from is null or pv.created_at::date >= p_date_from)
      and (p_date_to is null or pv.created_at::date <= p_date_to)
      and (
        normalized_search is null
        or org.name ilike '%' || normalized_search || '%'
        or org.slug ilike '%' || normalized_search || '%'
        or submitter.full_name ilike '%' || normalized_search || '%'
        or submitter.email ilike '%' || normalized_search || '%'
        or coalesce(pv.transaction_ref, '') ilike '%' || normalized_search || '%'
        or pv.receipt_filename ilike '%' || normalized_search || '%'
      )
  )
  select
    count(*) over()::bigint as total_count,
    filtered.id,
    filtered.organization_id,
    filtered.organization_name,
    filtered.organization_slug,
    filtered.user_id,
    filtered.user_full_name,
    filtered.user_email,
    filtered.amount,
    filtered.payment_method,
    filtered.transaction_ref,
    filtered.status,
    filtered.created_at,
    filtered.reviewed_at,
    filtered.rejection_reason,
    filtered.reviewed_by_name,
    filtered.receipt_filename,
    filtered.receipt_mime_type,
    filtered.receipt_storage_path
  from filtered
  order by
    case when filtered.status = 'pending' then 0 else 1 end,
    filtered.created_at desc
  limit safe_page_size
  offset safe_offset;
end;
$$;

create or replace function public.admin_get_payment_validation_detail(
  p_validation_id uuid
)
returns table (
  id uuid,
  organization_id uuid,
  organization_name text,
  organization_slug text,
  organization_status text,
  organization_address text,
  billing_data jsonb,
  user_id uuid,
  user_full_name text,
  user_email text,
  amount numeric,
  payment_method text,
  transaction_ref text,
  status text,
  created_at timestamptz,
  reviewed_at timestamptz,
  rejection_reason text,
  reviewed_by_name text,
  receipt_filename text,
  receipt_mime_type text,
  receipt_storage_path text,
  subscription_status text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_system_user(auth.uid()) then
    raise exception 'SYSTEM_ACCESS_REQUIRED'
      using errcode = '42501';
  end if;

  return query
  select
    pv.id,
    pv.organization_id,
    org.name as organization_name,
    org.slug as organization_slug,
    org.status as organization_status,
    org.address as organization_address,
    coalesce(org.billing_data, '{}'::jsonb) as billing_data,
    pv.user_id,
    submitter.full_name as user_full_name,
    submitter.email as user_email,
    pv.amount,
    pv.payment_method,
    pv.transaction_ref,
    pv.status,
    pv.created_at,
    pv.reviewed_at,
    pv.rejection_reason,
    reviewer.full_name as reviewed_by_name,
    pv.receipt_filename,
    pv.receipt_mime_type,
    pv.receipt_storage_path,
    subscription.status::text as subscription_status
  from public.payment_validations pv
  inner join public.organizations org on org.id = pv.organization_id
  inner join public.profiles submitter on submitter.id = pv.user_id
  left join public.organization_subscriptions subscription on subscription.organization_id = pv.organization_id
  left join public.system_users reviewer on reviewer.user_id = pv.reviewed_by_system_user
  where pv.id = p_validation_id
  limit 1;
end;
$$;

create or replace function public.admin_review_payment_validation(
  p_validation_id uuid,
  p_decision text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  validation_row public.payment_validations%rowtype;
  organization_row public.organizations%rowtype;
  submitter_row public.profiles%rowtype;
  decision text := lower(trim(coalesce(p_decision, '')));
  review_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not public.is_system_user(auth.uid()) then
    raise exception 'SYSTEM_ACCESS_REQUIRED'
      using errcode = '42501';
  end if;

  if decision not in ('approved', 'rejected') then
    raise exception 'INVALID_REVIEW_DECISION'
      using errcode = '22023';
  end if;

  if decision = 'rejected' and review_reason is null then
    raise exception 'REJECTION_REASON_REQUIRED'
      using errcode = '22023';
  end if;

  select *
  into validation_row
  from public.payment_validations
  where id = p_validation_id
  for update;

  if not found then
    raise exception 'PAYMENT_VALIDATION_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if validation_row.status <> 'pending' then
    raise exception 'PAYMENT_VALIDATION_ALREADY_REVIEWED'
      using errcode = '23514';
  end if;

  select *
  into organization_row
  from public.organizations
  where id = validation_row.organization_id;

  select *
  into submitter_row
  from public.profiles
  where id = validation_row.user_id;

  update public.payment_validations
  set
    status = decision,
    rejection_reason = case when decision = 'rejected' then review_reason else null end,
    reviewed_at = now(),
    reviewed_by_system_user = auth.uid(),
    updated_at = now()
  where id = validation_row.id;

  if decision = 'approved' then
    update public.organizations
    set
      status = 'active',
      updated_at = now()
    where id = validation_row.organization_id;

    update public.organization_subscriptions
    set
      status = 'active',
      updated_at = now()
    where organization_id = validation_row.organization_id;

    update public.onboarding_progress
    set
      current_step = 'completed',
      updated_at = now()
    where user_id = validation_row.user_id;
  else
    update public.organizations
    set
      status = 'pending',
      updated_at = now()
    where id = validation_row.organization_id;

    update public.onboarding_progress
    set
      current_step = 'payment',
      updated_at = now()
    where user_id = validation_row.user_id;
  end if;

  insert into public.audit_logs (
    action,
    table_name,
    record_id,
    user_id,
    context
  )
  values (
    'UPDATE',
    'system_payment_validations',
    validation_row.id,
    auth.uid(),
    jsonb_build_object(
      'event',
      case when decision = 'approved' then 'PAYMENT_APPROVED' else 'PAYMENT_REJECTED' end,
      'organization_id',
      validation_row.organization_id,
      'payment_validation_id',
      validation_row.id,
      'submitted_by',
      validation_row.user_id,
      'reason',
      review_reason
    )
  );

  return jsonb_build_object(
    'id', validation_row.id,
    'decision', decision,
    'organization_id', validation_row.organization_id,
    'organization_name', organization_row.name,
    'organization_slug', organization_row.slug,
    'user_email', submitter_row.email,
    'user_full_name', submitter_row.full_name
  );
end;
$$;

grant execute on function public.admin_payment_validation_stats() to authenticated;
grant execute on function public.admin_list_payment_validations(text, text, date, date, integer, integer) to authenticated;
grant execute on function public.admin_get_payment_validation_detail(uuid) to authenticated;
grant execute on function public.admin_review_payment_validation(uuid, text, text) to authenticated;
