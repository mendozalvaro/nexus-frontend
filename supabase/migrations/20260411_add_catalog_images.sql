alter table public.products
add column if not exists image_url text;

alter table public.services
add column if not exists image_url text;
