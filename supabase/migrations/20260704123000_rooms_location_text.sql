alter table public.rooms
  add column if not exists location text;

update public.rooms
set location = concat('Piso ', floor)
where location is null
  and floor is not null;
