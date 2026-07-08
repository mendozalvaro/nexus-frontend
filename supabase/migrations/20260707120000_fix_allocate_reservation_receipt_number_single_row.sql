create or replace function public.allocate_reservation_receipt_number(
  p_organization_id uuid,
  p_reservation_id uuid,
  p_receipt_kind text,
  p_paid_at timestamptz default now()
)
returns table (
  receipt_year integer,
  receipt_sequence integer,
  receipt_base_number text,
  receipt_partial_index integer,
  receipt_number text
)
language plpgsql
set search_path to 'public'
as $$
declare
  v_base_number text;
  v_receipt_year integer;
  v_receipt_sequence integer;
  v_partial_index integer;
begin
  if p_receipt_kind not in ('partial', 'final') then
    raise exception 'Tipo de recibo no valido: %', p_receipt_kind;
  end if;

  select
    coalesce(rp.receipt_base_number, regexp_replace(coalesce(rp.receipt_number, ''), '/[0-9]{2}$', '')),
    coalesce(
      rp.receipt_year,
      nullif(split_part(coalesce(rp.receipt_base_number, regexp_replace(coalesce(rp.receipt_number, ''), '/[0-9]{2}$', '')), '-', 2), '')::integer
    ),
    coalesce(
      rp.receipt_sequence,
      nullif(split_part(coalesce(rp.receipt_base_number, regexp_replace(coalesce(rp.receipt_number, ''), '/[0-9]{2}$', '')), '-', 3), '')::integer
    )
  into
    v_base_number,
    v_receipt_year,
    v_receipt_sequence
  from public.reservation_payments rp
  where rp.organization_id = p_organization_id
    and rp.reservation_id = p_reservation_id
    and coalesce(rp.receipt_base_number, rp.receipt_number) is not null
  order by rp.paid_at asc nulls first, rp.created_at asc nulls first, rp.id asc
  limit 1;

  if v_base_number is null then
    select
      next_receipt.receipt_year,
      next_receipt.receipt_sequence,
      next_receipt.receipt_number
    into
      v_receipt_year,
      v_receipt_sequence,
      v_base_number
    from public.next_reservation_receipt_number(p_organization_id, p_paid_at) as next_receipt;
  end if;

  if p_receipt_kind = 'partial' then
    select count(*)
    into v_partial_index
    from public.reservation_payments rp
    where rp.organization_id = p_organization_id
      and rp.reservation_id = p_reservation_id
      and rp.receipt_kind = 'partial';

    v_partial_index := coalesce(v_partial_index, 0) + 1;

    return query
    select
      v_receipt_year,
      v_receipt_sequence,
      v_base_number,
      v_partial_index,
      format('%s/%s', v_base_number, lpad(v_partial_index::text, 2, '0'));

    return;
  end if;

  return query
  select
    v_receipt_year,
    v_receipt_sequence,
    v_base_number,
    null::integer,
    v_base_number;
end;
$$;
