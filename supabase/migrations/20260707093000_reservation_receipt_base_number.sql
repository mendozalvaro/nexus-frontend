alter table public.reservation_payments
  add column if not exists receipt_base_number text,
  add column if not exists receipt_partial_index integer;

alter table public.reservation_payments
  drop constraint if exists reservation_payments_receipt_partial_index_check;

alter table public.reservation_payments
  add constraint reservation_payments_receipt_partial_index_check
  check (receipt_partial_index is null or receipt_partial_index >= 1);

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

with base_receipts as (
  select distinct on (rp.reservation_id)
    rp.reservation_id,
    coalesce(rp.receipt_base_number, regexp_replace(coalesce(rp.receipt_number, ''), '/[0-9]{2}$', '')) as base_number
  from public.reservation_payments rp
  where coalesce(rp.receipt_base_number, rp.receipt_number) is not null
  order by rp.reservation_id, rp.paid_at asc nulls first, rp.created_at asc nulls first, rp.id asc
),
partial_receipts as (
  select
    rp.id,
    row_number() over (
      partition by rp.reservation_id
      order by rp.paid_at asc nulls first, rp.created_at asc nulls first, rp.id asc
    ) as partial_index
  from public.reservation_payments rp
  where rp.receipt_kind = 'partial'
)
update public.reservation_payments as rp
set
  receipt_base_number = br.base_number,
  receipt_partial_index = pr.partial_index,
  receipt_year = coalesce(rp.receipt_year, nullif(split_part(br.base_number, '-', 2), '')::integer),
  receipt_sequence = coalesce(rp.receipt_sequence, nullif(split_part(br.base_number, '-', 3), '')::integer),
  receipt_number = format('%s/%s', br.base_number, lpad(pr.partial_index::text, 2, '0'))
from base_receipts br,
  partial_receipts pr
where rp.reservation_id = br.reservation_id
  and rp.id = pr.id
  and rp.receipt_kind = 'partial'
  and br.base_number is not null;

with base_receipts as (
  select distinct on (rp.reservation_id)
    rp.reservation_id,
    coalesce(rp.receipt_base_number, regexp_replace(coalesce(rp.receipt_number, ''), '/[0-9]{2}$', '')) as base_number
  from public.reservation_payments rp
  where coalesce(rp.receipt_base_number, rp.receipt_number) is not null
  order by rp.reservation_id, rp.paid_at asc nulls first, rp.created_at asc nulls first, rp.id asc
)
update public.reservation_payments as rp
set
  receipt_base_number = br.base_number,
  receipt_partial_index = null,
  receipt_year = coalesce(rp.receipt_year, nullif(split_part(br.base_number, '-', 2), '')::integer),
  receipt_sequence = coalesce(rp.receipt_sequence, nullif(split_part(br.base_number, '-', 3), '')::integer),
  receipt_number = br.base_number
from base_receipts br
where rp.reservation_id = br.reservation_id
  and rp.receipt_kind = 'final'
  and br.base_number is not null;

create or replace function public.create_lodging_quick_checkin(
  p_organization_id uuid,
  p_branch_id uuid,
  p_created_by uuid,
  p_check_in date,
  p_check_out date,
  p_is_open_ended boolean default false,
  p_notes text default null,
  p_rooms jsonb default '[]'::jsonb,
  p_payment jsonb default null
)
returns uuid
language plpgsql
set search_path to 'public'
as $$
declare
  v_now timestamptz := now();
  v_nights integer;
  v_requested_room_ids uuid[];
  v_distinct_room_count integer;
  v_total_amount numeric(12, 2) := 0;
  v_initial_payment_amount numeric(12, 2) := coalesce(nullif(p_payment->>'amount', '')::numeric, 0);
  v_reservation_id uuid;
  v_room_id uuid;
  v_room record;
  v_room_payload jsonb;
  v_guest_payload jsonb;
  v_room_link_id uuid;
  v_room_price numeric(12, 2);
  v_subtotal numeric(12, 2);
  v_guest_customer_id uuid;
  v_guest_full_name text;
  v_receipt_kind text;
  v_receipt_year integer;
  v_receipt_sequence integer;
  v_receipt_base_number text;
  v_receipt_partial_index integer;
  v_receipt_number text;
begin
  if jsonb_typeof(p_rooms) <> 'array' or jsonb_array_length(p_rooms) = 0 then
    raise exception 'Debe seleccionar al menos una habitacion.';
  end if;

  v_nights := p_check_out - p_check_in;
  if v_nights <= 0 then
    raise exception 'La reserva debe tener al menos una noche.';
  end if;

  select array_agg((room_item->>'roomId')::uuid)
  into v_requested_room_ids
  from jsonb_array_elements(p_rooms) as room_item;

  if coalesce(array_length(v_requested_room_ids, 1), 0) = 0 then
    raise exception 'Debe seleccionar al menos una habitacion.';
  end if;

  select count(distinct room_id)
  into v_distinct_room_count
  from unnest(v_requested_room_ids) as room_id;

  if v_distinct_room_count <> array_length(v_requested_room_ids, 1) then
    raise exception 'No puede registrar la misma habitacion mas de una vez.';
  end if;

  for v_room_payload in
    select value
    from jsonb_array_elements(p_rooms)
  loop
    v_room_id := (v_room_payload->>'roomId')::uuid;

    select
      r.id,
      r.branch_id,
      r.is_active,
      r.status,
      r.base_price
    into v_room
    from public.rooms r
    where r.organization_id = p_organization_id
      and r.id = v_room_id
    for update;

    if not found then
      raise exception 'Una de las habitaciones seleccionadas no existe.';
    end if;

    if v_room.branch_id <> p_branch_id then
      raise exception 'La habitacion no pertenece a la sucursal de la reserva.';
    end if;

    if coalesce(v_room.is_active, false) = false or v_room.status = 'maintenance' then
      raise exception 'Una de las habitaciones no esta disponible.';
    end if;

    if exists (
      select 1
      from public.reservation_rooms rr
      join public.reservations res
        on res.id = rr.reservation_id
      where rr.room_id = v_room_id
        and res.organization_id = p_organization_id
        and res.status = 'checked_in'
        and (
          (coalesce(res.is_open_ended, false) = true and res.check_in < p_check_out)
          or (
            coalesce(res.is_open_ended, false) = false
            and res.check_in < p_check_out
            and res.check_out > p_check_in
          )
        )
    ) then
      raise exception 'Una o mas habitaciones ya estan reservadas en ese rango.';
    end if;

    if jsonb_typeof(v_room_payload->'guests') <> 'array' or jsonb_array_length(v_room_payload->'guests') = 0 then
      raise exception 'Cada habitacion debe tener al menos un huesped principal.';
    end if;

    v_total_amount := v_total_amount + (coalesce(v_room.base_price, 0) * v_nights);
  end loop;

  if v_initial_payment_amount > v_total_amount then
    raise exception 'El pago inicial excede el monto total de la reserva.';
  end if;

  insert into public.reservations (
    organization_id,
    branch_id,
    check_in,
    check_out,
    status,
    total_amount,
    paid_amount,
    source,
    notes,
    created_by,
    actual_check_in_at,
    is_open_ended
  )
  values (
    p_organization_id,
    p_branch_id,
    p_check_in,
    p_check_out,
    'checked_in',
    v_total_amount,
    v_initial_payment_amount,
    'staff',
    nullif(btrim(coalesce(p_notes, '')), ''),
    p_created_by,
    v_now,
    coalesce(p_is_open_ended, false)
  )
  returning id into v_reservation_id;

  for v_room_payload in
    select value
    from jsonb_array_elements(p_rooms)
  loop
    v_room_id := (v_room_payload->>'roomId')::uuid;

    select r.base_price
    into v_room
    from public.rooms r
    where r.organization_id = p_organization_id
      and r.id = v_room_id;

    v_room_price := coalesce(v_room.base_price, 0);
    v_subtotal := v_room_price * v_nights;

    insert into public.reservation_rooms (
      reservation_id,
      room_id,
      room_price,
      subtotal,
      notes
    )
    values (
      v_reservation_id,
      v_room_id,
      v_room_price,
      v_subtotal,
      nullif(btrim(coalesce(v_room_payload->>'notes', '')), '')
    )
    returning id into v_room_link_id;

    for v_guest_payload in
      select value
      from jsonb_array_elements(v_room_payload->'guests')
    loop
      v_guest_full_name := btrim(coalesce(v_guest_payload->>'fullName', ''));

      select gc.id
      into v_guest_customer_id
      from public.guest_customers gc
      where gc.organization_id = p_organization_id
        and gc.document_type = nullif(btrim(coalesce(v_guest_payload->>'documentType', '')), '')
        and gc.document_number = nullif(btrim(coalesce(v_guest_payload->>'documentNumber', '')), '')
      for update;

      if found then
        update public.guest_customers
        set
          branch_id = p_branch_id,
          full_name = v_guest_full_name,
          phone = nullif(btrim(coalesce(v_guest_payload->>'phone', '')), ''),
          email = nullif(btrim(coalesce(v_guest_payload->>'email', '')), ''),
          birth_date = nullif(v_guest_payload->>'birthDate', '')::date,
          sex = nullif(v_guest_payload->>'sex', ''),
          nationality = nullif(btrim(coalesce(v_guest_payload->>'nationality', '')), ''),
          address = nullif(btrim(coalesce(v_guest_payload->>'address', '')), ''),
          marital_status = nullif(btrim(coalesce(v_guest_payload->>'maritalStatus', '')), ''),
          updated_at = v_now
        where id = v_guest_customer_id;
      else
        insert into public.guest_customers (
          organization_id,
          branch_id,
          full_name,
          phone,
          email,
          document_type,
          document_number,
          birth_date,
          sex,
          nationality,
          address,
          marital_status,
          created_by
        )
        values (
          p_organization_id,
          p_branch_id,
          v_guest_full_name,
          nullif(btrim(coalesce(v_guest_payload->>'phone', '')), ''),
          nullif(btrim(coalesce(v_guest_payload->>'email', '')), ''),
          nullif(btrim(coalesce(v_guest_payload->>'documentType', '')), ''),
          nullif(btrim(coalesce(v_guest_payload->>'documentNumber', '')), ''),
          nullif(v_guest_payload->>'birthDate', '')::date,
          nullif(v_guest_payload->>'sex', ''),
          nullif(btrim(coalesce(v_guest_payload->>'nationality', '')), ''),
          nullif(btrim(coalesce(v_guest_payload->>'address', '')), ''),
          nullif(btrim(coalesce(v_guest_payload->>'maritalStatus', '')), ''),
          p_created_by
        )
        returning id into v_guest_customer_id;
      end if;

      insert into public.reservation_guests (
        reservation_room_id,
        guest_customer_id,
        full_name,
        document_type,
        document_number,
        birth_date,
        sex,
        phone,
        email,
        nationality,
        address,
        marital_status,
        is_main_guest
      )
      values (
        v_room_link_id,
        v_guest_customer_id,
        v_guest_full_name,
        nullif(btrim(coalesce(v_guest_payload->>'documentType', '')), ''),
        nullif(btrim(coalesce(v_guest_payload->>'documentNumber', '')), ''),
        nullif(v_guest_payload->>'birthDate', '')::date,
        nullif(v_guest_payload->>'sex', ''),
        nullif(btrim(coalesce(v_guest_payload->>'phone', '')), ''),
        nullif(btrim(coalesce(v_guest_payload->>'email', '')), ''),
        nullif(btrim(coalesce(v_guest_payload->>'nationality', '')), ''),
        nullif(btrim(coalesce(v_guest_payload->>'address', '')), ''),
        nullif(btrim(coalesce(v_guest_payload->>'maritalStatus', '')), ''),
        coalesce((v_guest_payload->>'isMainGuest')::boolean, false)
      );
    end loop;
  end loop;

  if v_initial_payment_amount > 0 then
    v_receipt_kind := case
      when v_initial_payment_amount >= v_total_amount then 'final'
      else 'partial'
    end;

    select
      allocated_receipt.receipt_year,
      allocated_receipt.receipt_sequence,
      allocated_receipt.receipt_base_number,
      allocated_receipt.receipt_partial_index,
      allocated_receipt.receipt_number
    into
      v_receipt_year,
      v_receipt_sequence,
      v_receipt_base_number,
      v_receipt_partial_index,
      v_receipt_number
    from public.allocate_reservation_receipt_number(
      p_organization_id,
      v_reservation_id,
      v_receipt_kind,
      v_now
    ) as allocated_receipt;

    insert into public.reservation_payments (
      organization_id,
      reservation_id,
      amount,
      payment_method,
      payment_type,
      receipt_kind,
      receipt_base_number,
      receipt_year,
      receipt_sequence,
      receipt_partial_index,
      receipt_number,
      reference,
      notes,
      paid_at,
      created_by
    )
    values (
      p_organization_id,
      v_reservation_id,
      v_initial_payment_amount,
      p_payment->>'paymentMethod',
      p_payment->>'paymentType',
      v_receipt_kind,
      v_receipt_base_number,
      v_receipt_year,
      v_receipt_sequence,
      v_receipt_partial_index,
      v_receipt_number,
      nullif(btrim(coalesce(p_payment->>'reference', '')), ''),
      nullif(btrim(coalesce(p_payment->>'notes', '')), ''),
      v_now,
      p_created_by
    );
  end if;

  update public.rooms
  set status = 'occupied'
  where organization_id = p_organization_id
    and id = any(v_requested_room_ids);

  return v_reservation_id;
end;
$$;
