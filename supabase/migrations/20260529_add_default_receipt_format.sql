alter table public.organizations
add column if not exists default_receipt_format text;

update public.organizations
set default_receipt_format = coalesce(default_receipt_format, 'thermal');

alter table public.organizations
drop constraint if exists organizations_default_receipt_format_check;

alter table public.organizations
add constraint organizations_default_receipt_format_check
check (default_receipt_format in ('thermal', 'half_letter'));
