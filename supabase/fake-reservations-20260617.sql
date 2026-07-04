begin;

delete from public.reservations
where organization_id = '13333333-3333-4333-8333-333333333333'
  and notes like 'CODEX_FAKE_LODGING_2026_06_17:%';

with
active_reservation as (
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
    '13333333-3333-4333-8333-333333333333',
    '23111111-1111-4111-8111-111111111111',
    '2026-06-17',
    '2026-06-18',
    'checked_in',
    120.00,
    60.00,
    'staff',
    'CODEX_FAKE_LODGING_2026_06_17: active open-ended stay for room 101',
    '33111111-1111-4111-8111-111111111111',
    '2026-06-17T14:00:00-04:00',
    true
  )
  returning id
),
active_room as (
  insert into public.reservation_rooms (
    reservation_id,
    room_id,
    room_price,
    subtotal,
    notes
  )
  select
    id,
    '73111111-1111-4111-8111-111111111111',
    120.00,
    120.00,
    'CODEX_FAKE_LODGING_2026_06_17 active room link'
  from active_reservation
  returning id, reservation_id
),
active_guest as (
  insert into public.reservation_guests (
    reservation_room_id,
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
  select
    id,
    'Ana Quispe',
    'CI',
    '6543210 LP',
    '1994-08-12',
    'female',
    '72000001',
    'ana.quispe@example.com',
    'Boliviana',
    'La Paz',
    'soltera',
    true
  from active_room
),
active_payment as (
  insert into public.reservation_payments (
    organization_id,
    reservation_id,
    amount,
    payment_method,
    payment_type,
    reference,
    notes,
    created_by
  )
  select
    '13333333-3333-4333-8333-333333333333',
    reservation_id,
    60.00,
    'cash',
    'deposit',
    'FAKE-DEP-101',
    'CODEX_FAKE_LODGING_2026_06_17 initial deposit',
    '33111111-1111-4111-8111-111111111111'
  from active_room
),
history_reservation as (
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
    actual_check_out_at,
    is_open_ended
  )
  values (
    '13333333-3333-4333-8333-333333333333',
    '23111111-1111-4111-8111-111111111111',
    '2026-06-14',
    '2026-06-16',
    'checked_out',
    300.00,
    300.00,
    'staff',
    'CODEX_FAKE_LODGING_2026_06_17: closed stay history for room 103',
    '33111111-1111-4111-8111-111111111111',
    '2026-06-14T13:20:00-04:00',
    '2026-06-16T11:05:00-04:00',
    false
  )
  returning id
),
history_room as (
  insert into public.reservation_rooms (
    reservation_id,
    room_id,
    room_price,
    subtotal,
    notes
  )
  select
    id,
    '24b1c73c-eebb-4e44-9ed0-4ed224a05508',
    150.00,
    300.00,
    'CODEX_FAKE_LODGING_2026_06_17 history room link'
  from history_reservation
  returning id, reservation_id
),
history_guest as (
  insert into public.reservation_guests (
    reservation_room_id,
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
  select
    id,
    'Luis Flores',
    'Pasaporte',
    'P1234567',
    '1988-02-03',
    'male',
    '72000002',
    'luis.flores@example.com',
    'Peruana',
    'Cusco',
    'casado',
    true
  from history_room
),
history_payment as (
  insert into public.reservation_payments (
    organization_id,
    reservation_id,
    amount,
    payment_method,
    payment_type,
    reference,
    notes,
    created_by
  )
  select
    '13333333-3333-4333-8333-333333333333',
    reservation_id,
    300.00,
    'transfer',
    'full',
    'FAKE-FULL-103',
    'CODEX_FAKE_LODGING_2026_06_17 full payment',
    '33111111-1111-4111-8111-111111111111'
  from history_room
)
select 1;

update public.rooms
set status = case
  when id = '73111111-1111-4111-8111-111111111111' then 'occupied'::room_status
  when id = '24b1c73c-eebb-4e44-9ed0-4ed224a05508' then 'available'::room_status
  else status
end
where id in (
  '73111111-1111-4111-8111-111111111111',
  '24b1c73c-eebb-4e44-9ed0-4ed224a05508'
);

commit;

