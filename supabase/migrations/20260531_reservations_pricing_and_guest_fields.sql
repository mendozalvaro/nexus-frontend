alter table public.rooms
  add column if not exists base_price numeric(12,2) not null default 0;

alter table public.reservation_guests
  add column if not exists birth_date date null,
  add column if not exists sex text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reservation_guests_sex_check'
  ) then
    alter table public.reservation_guests
      add constraint reservation_guests_sex_check
      check (sex is null or sex in ('male', 'female', 'other'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'reservation_status'
      and e.enumlabel = 'pending_payment'
  ) then
    alter type public.reservation_status add value 'pending_payment';
  end if;
end $$;
