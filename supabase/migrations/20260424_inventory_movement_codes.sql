create table if not exists public.inventory_document_sequences (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  doc_type text not null check (doc_type in ('GLOBAL')),
  seq_year integer not null check (seq_year >= 2000),
  last_value integer not null default 0 check (last_value >= 0),
  updated_at timestamptz not null default now(),
  primary key (organization_id, doc_type, seq_year)
);

alter table public.inventory_document_sequences
  drop constraint if exists inventory_document_sequences_doc_type_check;

alter table public.inventory_document_sequences
  add constraint inventory_document_sequences_doc_type_check
  check (doc_type in ('GLOBAL'));

alter table public.inventory_document_sequences enable row level security;

drop policy if exists "Inventory document sequences select" on public.inventory_document_sequences;
create policy "Inventory document sequences select" on public.inventory_document_sequences
for select using (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);

create or replace function public.next_inventory_document_code(
  p_organization_id uuid,
  p_doc_type text,
  p_prefix text default 'INV',
  p_year integer default extract(year from now())::integer
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
  v_doc_type text;
  v_prefix text;
begin
  v_doc_type := upper(trim(coalesce(p_doc_type, '')));
  if v_doc_type not in ('ING', 'SAL', 'AJU', 'TRA') then
    raise exception 'INVALID_DOC_TYPE';
  end if;

  v_prefix := upper(regexp_replace(trim(coalesce(p_prefix, 'INV')), '[^A-Z0-9]', '', 'g'));
  if char_length(v_prefix) = 0 then
    v_prefix := 'INV';
  end if;

  if p_year is null or p_year < 2000 then
    raise exception 'INVALID_DOC_YEAR';
  end if;

  insert into public.inventory_document_sequences (
    organization_id,
    doc_type,
    seq_year,
    last_value
  )
  values (
    p_organization_id,
    'GLOBAL',
    p_year,
    1
  )
  on conflict (organization_id, doc_type, seq_year)
  do update set
    last_value = public.inventory_document_sequences.last_value + 1,
    updated_at = now()
  returning last_value into v_next;

  return format('%s-%s-%s/%s', v_prefix, v_doc_type, lpad(v_next::text, 4, '0'), p_year::text);
end;
$$;
