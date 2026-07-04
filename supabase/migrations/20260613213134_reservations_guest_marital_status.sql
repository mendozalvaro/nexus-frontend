alter table public.reservation_guests
  add column if not exists marital_status text;
