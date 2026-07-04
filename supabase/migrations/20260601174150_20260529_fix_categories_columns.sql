-- Remote-alignment migration captured from linked project.
-- Align categories/organizations/appointments with the effective remote schema.

alter table public.categories
  add column if not exists description text;

alter table public.categories
  add column if not exists created_at timestamptz default now();

alter table public.categories
  add column if not exists updated_at timestamptz default now();

alter table public.organizations
  add column if not exists default_receipt_format text;

update public.organizations
set default_receipt_format = coalesce(default_receipt_format, 'thermal');

alter table public.organizations
  drop constraint if exists organizations_default_receipt_format_check;

alter table public.organizations
  add constraint organizations_default_receipt_format_check
  check (default_receipt_format in ('thermal', 'half_letter'));

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'appointment_source'
  ) then
    create type public.appointment_source as enum ('manual', 'pos_checkout', 'client_booking');
  end if;
end $$;

alter table public.appointments
  add column if not exists transaction_id uuid references public.transactions(id) on delete set null,
  add column if not exists source public.appointment_source not null default 'manual';
