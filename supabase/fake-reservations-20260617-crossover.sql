begin;

delete from public.reservations
where organization_id = '13333333-3333-4333-8333-333333333333'
  and notes like 'CODEX_FAKE_LODGING_2026_06_17_CROSS:%';

with
crossing_active as (
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
    '2026-06-15',
    '2026-06-19',
    'checked_in',
    740.00,
    300.00,
    'staff',
    'CODEX_FAKE_LODGING_2026_06_17_CROSS: active stay crossing today for room 107',
    '33111111-1111-4111-8111-111111111111',
    '2026-06-15T13:10:00-04:00',
    false
  )
  returning id
),
crossing_active_room as (
  insert into public.reservation_rooms (
    reservation_id,
    room_id,
    room_price,
    subtotal,
    notes
  )
  select
    id,
    '73f44444-4444-4444-8444-444444444444',
    185.00,
    740.00,
    'CODEX_FAKE_LODGING_2026_06_17_CROSS room link 107'
  from crossing_active
  returning id, reservation_id
),
crossing_active_guest as (
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
    'Rosa Delgado',
    'CI',
    '7788990 LP',
    '1986-03-21',
    'female',
    '72020001',
    'rosa.delgado@example.com',
    'Boliviana',
    'El Alto',
    'casada',
    true
  from crossing_active_room
),
crossing_active_payment as (
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
    'cash',
    'deposit',
    'FAKE-CROSS-107-DEP',
    'CODEX_FAKE_LODGING_2026_06_17_CROSS deposit 107',
    '33111111-1111-4111-8111-111111111111'
  from crossing_active_room
),
checkout_today as (
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
    '2026-06-16',
    '2026-06-18',
    'checked_out',
    280.00,
    280.00,
    'staff',
    'CODEX_FAKE_LODGING_2026_06_17_CROSS: checkout flow with prior check-in for room 106',
    '33222222-2222-4222-8222-222222222222',
    '2026-06-16T21:00:00-04:00',
    '2026-06-18T10:30:00-04:00',
    false
  )
  returning id
),
checkout_today_room as (
  insert into public.reservation_rooms (
    reservation_id,
    room_id,
    room_price,
    subtotal,
    notes
  )
  select
    id,
    '73f33333-3333-4333-8333-333333333333',
    140.00,
    280.00,
    'CODEX_FAKE_LODGING_2026_06_17_CROSS room link 106'
  from checkout_today
  returning id, reservation_id
),
checkout_today_guest as (
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
    'Victor Tapia',
    'CI',
    '6677889 OR',
    '1990-01-09',
    'male',
    '72020002',
    'victor.tapia@example.com',
    'Boliviana',
    'Oruro',
    'soltero',
    true
  from checkout_today_room
),
checkout_today_payment as (
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
    280.00,
    'transfer',
    'full',
    'FAKE-CROSS-106-FULL',
    'CODEX_FAKE_LODGING_2026_06_17_CROSS full payment 106',
    '33222222-2222-4222-8222-222222222222'
  from checkout_today_room
)
select 1;

update public.rooms
set status = case
  when id = '73f44444-4444-4444-8444-444444444444' then 'occupied'::room_status
  when id = '73f33333-3333-4333-8333-333333333333' then 'available'::room_status
  else status
end
where id in (
  '73f44444-4444-4444-8444-444444444444',
  '73f33333-3333-4333-8333-333333333333'
);

commit;
