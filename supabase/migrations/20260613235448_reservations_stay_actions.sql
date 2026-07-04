alter table public.reservations
  add column if not exists actual_check_in_at timestamptz,
  add column if not exists actual_check_out_at timestamptz,
  add column if not exists is_open_ended boolean not null default false,
  add column if not exists extended_from_check_out date,
  add column if not exists extension_notes text;

alter table public.reservations
  drop constraint if exists valid_actual_stay;

alter table public.reservations
  add constraint valid_actual_stay
  check (
    actual_check_out_at is null
    or actual_check_in_at is null
    or actual_check_out_at >= actual_check_in_at
  );
