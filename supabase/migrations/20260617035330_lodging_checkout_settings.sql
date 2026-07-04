alter table public.organizations
  add column if not exists lodging_checkout_deadline time default '12:00:00'::time,
  add column if not exists lodging_stay_cutoff_time time default '12:00:00'::time,
  add column if not exists lodging_late_checkout_penalty numeric(12, 2) default 0;

alter table public.organizations
  drop constraint if exists organizations_lodging_late_checkout_penalty_check;

alter table public.organizations
  add constraint organizations_lodging_late_checkout_penalty_check
  check (lodging_late_checkout_penalty >= 0);
