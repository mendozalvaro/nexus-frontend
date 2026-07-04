begin;

delete from public.reservations
where organization_id = '13333333-3333-4333-8333-333333333333'
  and notes like 'CODEX_FAKE_LODGING_2026_06_17_EXTRA:%';

insert into public.categories (
  id,
  organization_id,
  name,
  type,
  parent_id,
  description,
  is_active
)
values
  (
    '53f11111-1111-4111-8111-111111111111',
    '13333333-3333-4333-8333-333333333333',
    'Suite Familiar',
    'lodging',
    null,
    'Categoria fake para pruebas de hospedaje.',
    true
  ),
  (
    '53f22222-2222-4222-8222-222222222222',
    '13333333-3333-4333-8333-333333333333',
    'Matrimonial Deluxe',
    'lodging',
    null,
    'Categoria fake para pruebas de hospedaje.',
    true
  )
on conflict (id) do update
set
  name = excluded.name,
  type = excluded.type,
  description = excluded.description,
  is_active = excluded.is_active;

insert into public.rooms (
  id,
  organization_id,
  branch_id,
  category_id,
  room_number,
  floor,
  base_price,
  status,
  notes,
  is_active
)
values
  (
    '73f11111-1111-4111-8111-111111111111',
    '13333333-3333-4333-8333-333333333333',
    '23111111-1111-4111-8111-111111111111',
    '53f22222-2222-4222-8222-222222222222',
    '104',
    1,
    210.00,
    'available',
    'CODEX_FAKE_LODGING_2026_06_17_EXTRA room 104',
    true
  ),
  (
    '73f22222-2222-4222-8222-222222222222',
    '13333333-3333-4333-8333-333333333333',
    '23111111-1111-4111-8111-111111111111',
    '53f11111-1111-4111-8111-111111111111',
    '105',
    1,
    260.00,
    'available',
    'CODEX_FAKE_LODGING_2026_06_17_EXTRA room 105',
    true
  ),
  (
    '73f33333-3333-4333-8333-333333333333',
    '13333333-3333-4333-8333-333333333333',
    '23111111-1111-4111-8111-111111111111',
    '53111111-1111-4111-8111-111111111111',
    '106',
    1,
    140.00,
    'available',
    'CODEX_FAKE_LODGING_2026_06_17_EXTRA room 106',
    true
  ),
  (
    '73f44444-4444-4444-8444-444444444444',
    '13333333-3333-4333-8333-333333333333',
    '23111111-1111-4111-8111-111111111111',
    '53222222-2222-4222-8222-222222222222',
    '107',
    1,
    185.00,
    'available',
    'CODEX_FAKE_LODGING_2026_06_17_EXTRA room 107',
    true
  )
on conflict (id) do update
set
  category_id = excluded.category_id,
  room_number = excluded.room_number,
  floor = excluded.floor,
  base_price = excluded.base_price,
  notes = excluded.notes,
  is_active = excluded.is_active;

with
active_104 as (
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
    '2026-06-24',
    'checked_in',
    1470.00,
    1470.00,
    'staff',
    'CODEX_FAKE_LODGING_2026_06_17_EXTRA: active paid stay for room 104',
    '33111111-1111-4111-8111-111111111111',
    '2026-06-17T15:10:00-04:00',
    false
  )
  returning id
),
active_104_room as (
  insert into public.reservation_rooms (reservation_id, room_id, room_price, subtotal, notes)
  select id, '73f11111-1111-4111-8111-111111111111', 210.00, 1470.00, 'CODEX_FAKE_LODGING_2026_06_17_EXTRA room link 104'
  from active_104
  returning id, reservation_id
),
active_104_guest_main as (
  insert into public.reservation_guests (
    reservation_room_id, full_name, document_type, document_number, birth_date, sex, phone, email, nationality, address, marital_status, is_main_guest
  )
  select id, 'Marco Rojas', 'CI', '7012345 LP', '1985-05-11', 'male', '72010001', 'marco.rojas@example.com', 'Boliviana', 'La Paz', 'casado', true
  from active_104_room
),
active_104_guest_companion as (
  insert into public.reservation_guests (
    reservation_room_id, full_name, document_type, document_number, birth_date, sex, phone, email, nationality, address, marital_status, is_main_guest
  )
  select id, 'Sara Rojas', 'CI', '7012346 LP', '1987-09-17', 'female', '72010002', 'sara.rojas@example.com', 'Boliviana', 'La Paz', 'casada', false
  from active_104_room
),
active_104_payment as (
  insert into public.reservation_payments (
    organization_id, reservation_id, amount, payment_method, payment_type, reference, notes, created_by
  )
  select '13333333-3333-4333-8333-333333333333', reservation_id, 1470.00, 'card', 'full', 'FAKE-104-FULL', 'CODEX_FAKE_LODGING_2026_06_17_EXTRA full payment 104', '33111111-1111-4111-8111-111111111111'
  from active_104_room
),
active_105 as (
  insert into public.reservations (
    organization_id, branch_id, check_in, check_out, status, total_amount, paid_amount, source, notes, created_by, actual_check_in_at, is_open_ended
  )
  values (
    '13333333-3333-4333-8333-333333333333',
    '23111111-1111-4111-8111-111111111111',
    '2026-06-17',
    '2026-06-18',
    'checked_in',
    260.00,
    80.00,
    'staff',
    'CODEX_FAKE_LODGING_2026_06_17_EXTRA: active partial stay for room 105',
    '33222222-2222-4222-8222-222222222222',
    '2026-06-17T17:35:00-04:00',
    false
  )
  returning id
),
active_105_room as (
  insert into public.reservation_rooms (reservation_id, room_id, room_price, subtotal, notes)
  select id, '73f22222-2222-4222-8222-222222222222', 260.00, 260.00, 'CODEX_FAKE_LODGING_2026_06_17_EXTRA room link 105'
  from active_105
  returning id, reservation_id
),
active_105_guest as (
  insert into public.reservation_guests (
    reservation_room_id, full_name, document_type, document_number, birth_date, sex, phone, email, nationality, address, marital_status, is_main_guest
  )
  select id, 'Julia Campos', 'Pasaporte', 'PX908877', '1991-04-02', 'female', '72010003', 'julia.campos@example.com', 'Argentina', 'Salta', 'soltera', true
  from active_105_room
),
active_105_payment as (
  insert into public.reservation_payments (
    organization_id, reservation_id, amount, payment_method, payment_type, reference, notes, created_by
  )
  select '13333333-3333-4333-8333-333333333333', reservation_id, 80.00, 'qr', 'deposit', 'FAKE-105-DEP', 'CODEX_FAKE_LODGING_2026_06_17_EXTRA deposit 105', '33222222-2222-4222-8222-222222222222'
  from active_105_room
),

history_107 as (
  insert into public.reservations (
    organization_id, branch_id, check_in, check_out, status, total_amount, paid_amount, source, notes, created_by, actual_check_in_at, actual_check_out_at, is_open_ended
  )
  values (
    '13333333-3333-4333-8333-333333333333',
    '23111111-1111-4111-8111-111111111111',
    '2026-06-09',
    '2026-06-12',
    'checked_out',
    555.00,
    555.00,
    'staff',
    'CODEX_FAKE_LODGING_2026_06_17_EXTRA: closed stay history for room 107',
    '33111111-1111-4111-8111-111111111111',
    '2026-06-09T12:40:00-04:00',
    '2026-06-12T10:15:00-04:00',
    false
  )
  returning id
),
history_107_room as (
  insert into public.reservation_rooms (reservation_id, room_id, room_price, subtotal, notes)
  select id, '73f44444-4444-4444-8444-444444444444', 185.00, 555.00, 'CODEX_FAKE_LODGING_2026_06_17_EXTRA room link 107'
  from history_107
  returning id, reservation_id
),
history_107_guest as (
  insert into public.reservation_guests (
    reservation_room_id, full_name, document_type, document_number, birth_date, sex, phone, email, nationality, address, marital_status, is_main_guest
  )
  select id, 'Patricia Vega', 'CI', '5566778 SC', '1979-07-14', 'female', '72010005', 'patricia.vega@example.com', 'Boliviana', 'Santa Cruz', 'divorciada', true
  from history_107_room
),
history_107_payment as (
  insert into public.reservation_payments (
    organization_id, reservation_id, amount, payment_method, payment_type, reference, notes, created_by
  )
  select '13333333-3333-4333-8333-333333333333', reservation_id, 555.00, 'transfer', 'full', 'FAKE-107-FULL', 'CODEX_FAKE_LODGING_2026_06_17_EXTRA full payment 107', '33111111-1111-4111-8111-111111111111'
  from history_107_room
)
select 1;

update public.rooms
set status = case
  when id in ('73f11111-1111-4111-8111-111111111111', '73f22222-2222-4222-8222-222222222222') then 'occupied'::room_status
  when id in ('73f33333-3333-4333-8333-333333333333', '73f44444-4444-4444-8444-444444444444') then 'available'::room_status
  else status
end
where id in (
  '73f11111-1111-4111-8111-111111111111',
  '73f22222-2222-4222-8222-222222222222',
  '73f33333-3333-4333-8333-333333333333',
  '73f44444-4444-4444-8444-444444444444'
);

commit;




