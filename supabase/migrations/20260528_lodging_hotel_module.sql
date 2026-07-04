-- Migration: Lodging / Hotel Module
-- Adds room_types, rooms, reservations, reservation_rooms, reservation_guests, reservation_payments

-- New enums
create type reservation_status as enum ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show');
create type room_status as enum ('available', 'occupied', 'maintenance', 'cleaning');

-- Room types (categories)
create table room_types (
    id uuid default uuid_generate_v4() primary key,
    organization_id uuid references organizations(id) on delete cascade not null,
    name text not null,
    description text,
    base_price numeric(12, 2) not null check (base_price >= 0),
    max_guests int not null check (max_guests > 0),
    amenities jsonb default '[]'::jsonb,
    is_active boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique(organization_id, name)
);

-- Individual rooms
create table rooms (
    id uuid default uuid_generate_v4() primary key,
    organization_id uuid references organizations(id) on delete cascade not null,
    branch_id uuid references branches(id) on delete cascade not null,
    room_type_id uuid references room_types(id) on delete restrict not null,
    room_number text not null,
    floor int,
    status room_status default 'available',
    notes text,
    is_active boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique(organization_id, branch_id, room_number)
);

-- Reservations (1 reservation = N rooms)
create table reservations (
    id uuid default uuid_generate_v4() primary key,
    organization_id uuid references organizations(id) on delete cascade not null,
    branch_id uuid references branches(id) on delete cascade not null,
    check_in date not null,
    check_out date not null,
    nights int generated always as (check_out - check_in) stored,
    status reservation_status default 'pending',
    total_amount numeric(12, 2) not null check (total_amount >= 0),
    paid_amount numeric(12, 2) default 0 check (paid_amount >= 0),
    source text default 'staff' check (source in ('staff')),
    notes text,
    cancellation_reason text,
    cancelled_at timestamptz,
    cancelled_by uuid references profiles(id) on delete set null,
    created_by uuid references profiles(id) on delete set null not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    constraint valid_dates check (check_out > check_in),
    constraint valid_paid check (paid_amount <= total_amount),
    constraint valid_cancellation check (
        (status in ('cancelled', 'no_show') and cancelled_by is not null)
        or (status not in ('cancelled', 'no_show'))
    )
);

-- Pivot: rooms in each reservation with price snapshot
create table reservation_rooms (
    id uuid default uuid_generate_v4() primary key,
    reservation_id uuid references reservations(id) on delete cascade not null,
    room_id uuid references rooms(id) on delete restrict not null,
    room_price numeric(12, 2) not null check (room_price >= 0),
    subtotal numeric(12, 2) not null check (subtotal >= 0),
    notes text,
    created_at timestamptz default now(),
    unique(reservation_id, room_id)
);

-- Guests per room
create table reservation_guests (
    id uuid default uuid_generate_v4() primary key,
    reservation_room_id uuid references reservation_rooms(id) on delete cascade not null,
    full_name text not null,
    document_type text,
    document_number text,
    address text,
    phone text,
    email text,
    nationality text,
    is_main_guest boolean default false,
    created_at timestamptz default now()
);

-- Global payments per reservation
create table reservation_payments (
    id uuid default uuid_generate_v4() primary key,
    organization_id uuid references organizations(id) on delete cascade not null,
    reservation_id uuid references reservations(id) on delete cascade not null,
    amount numeric(12, 2) not null check (amount > 0),
    payment_method text not null check (payment_method in ('cash', 'card', 'transfer', 'qr', 'digital_wallet')),
    payment_type text not null check (payment_type in ('deposit', 'balance', 'full')),
    reference text,
    notes text,
    paid_at timestamptz default now(),
    created_by uuid references profiles(id) on delete set null not null,
    created_at timestamptz default now()
);

-- Business type: add lodging
alter table organizations drop constraint if exists organizations_business_type_check;
alter table organizations add constraint organizations_business_type_check
    check (business_type in ('products', 'services', 'hybrid', 'lodging'));

-- Feature flag
alter table subscription_plans add column if not exists feature_hotel_module boolean default false;

-- Update RPC
create or replace function get_organization_capabilities(input_org_id uuid)
returns jsonb as $$
declare
    v_caps jsonb;
begin
    select jsonb_build_object(
        'planName', sp.name,
        'planSlug', sp.slug,
        'maxBranches', sp.max_branches,
        'maxUsers', sp.max_users,
        'canCreateBranch', (sp.max_branches > (select count(*) from branches where organization_id = input_org_id)),
        'canCreateManager', sp.feature_manager_role,
        'canTransferStock', sp.feature_inventory_transfer,
        'hasAdvancedReports', sp.feature_advanced_reports,
        'hasApiAccess', sp.feature_api_access,
        'hasForensicExport', sp.feature_forensic_export,
        'hasHotelModule', sp.feature_hotel_module,
        'currentBranchesCount', (select count(*) from branches where organization_id = input_org_id),
        'currentUsersCount', (select count(*) from profiles where organization_id = input_org_id and role != 'client'),
        'subscriptionStatus', os.status,
        'periodEnd', os.current_period_end
    ) into v_caps
    from organization_subscriptions os
    join subscription_plans sp on os.plan_id = sp.id
    where os.organization_id = input_org_id
      and os.status in ('active', 'trial')
      and os.current_period_end > now();

    return coalesce(v_caps, '{}'::jsonb);
end;
$$ language plpgsql security definer;

-- RLS
alter table room_types enable row level security;
alter table rooms enable row level security;
alter table reservations enable row level security;
alter table reservation_rooms enable row level security;
alter table reservation_guests enable row level security;
alter table reservation_payments enable row level security;

-- Room types policies
create policy "Room types select" on room_types for select
using ( organization_id = get_user_organization_id() );

create policy "Room types insert" on room_types for insert
with check (
    organization_id = get_user_organization_id()
    and get_user_role() in ('admin', 'manager')
);

create policy "Room types update" on room_types for update
using (
    organization_id = get_user_organization_id()
    and get_user_role() in ('admin', 'manager')
);

create policy "Room types delete" on room_types for delete
using (
    organization_id = get_user_organization_id()
    and get_user_role() in ('admin', 'manager')
);

-- Rooms policies
create policy "Rooms select" on rooms for select
using (
    organization_id = get_user_organization_id()
    and (
        get_user_role() = 'admin'
        or branch_id = get_user_branch_id()
        or is_user_assigned_to_branch(branch_id)
    )
);

create policy "Rooms insert" on rooms for insert
with check (
    organization_id = get_user_organization_id()
    and get_user_role() in ('admin', 'manager')
);

create policy "Rooms update" on rooms for update
using (
    organization_id = get_user_organization_id()
    and get_user_role() in ('admin', 'manager')
);

create policy "Rooms delete" on rooms for delete
using (
    organization_id = get_user_organization_id()
    and get_user_role() in ('admin', 'manager')
);

-- Reservations policies
create policy "Reservations select" on reservations for select
using (
    organization_id = get_user_organization_id()
    and (
        get_user_role() = 'admin'
        or branch_id = get_user_branch_id()
        or is_user_assigned_to_branch(branch_id)
    )
);

create policy "Reservations insert" on reservations for insert
with check (
    organization_id = get_user_organization_id()
    and get_user_role() in ('admin', 'manager', 'employee')
);

create policy "Reservations update" on reservations for update
using (
    organization_id = get_user_organization_id()
    and get_user_role() in ('admin', 'manager', 'employee')
);

create policy "Reservations delete" on reservations for delete
using (
    organization_id = get_user_organization_id()
    and get_user_role() in ('admin', 'manager')
);

-- Reservation rooms policies
create policy "Reservation rooms select" on reservation_rooms for select
using (
    exists (
        select 1 from reservations
        where reservations.id = reservation_rooms.reservation_id
        and reservations.organization_id = get_user_organization_id()
    )
);

create policy "Reservation rooms insert" on reservation_rooms for insert
with check (
    exists (
        select 1 from reservations
        where reservations.id = reservation_rooms.reservation_id
        and reservations.organization_id = get_user_organization_id()
    )
);

create policy "Reservation rooms update" on reservation_rooms for update
using (
    exists (
        select 1 from reservations
        where reservations.id = reservation_rooms.reservation_id
        and reservations.organization_id = get_user_organization_id()
    )
);

-- Reservation guests policies
create policy "Reservation guests select" on reservation_guests for select
using (
    exists (
        select 1 from reservation_rooms rr
        join reservations r on r.id = rr.reservation_id
        where rr.id = reservation_guests.reservation_room_id
        and r.organization_id = get_user_organization_id()
    )
);

create policy "Reservation guests insert" on reservation_guests for insert
with check (
    exists (
        select 1 from reservation_rooms rr
        join reservations r on r.id = rr.reservation_id
        where rr.id = reservation_guests.reservation_room_id
        and r.organization_id = get_user_organization_id()
    )
);

create policy "Reservation guests update" on reservation_guests for update
using (
    exists (
        select 1 from reservation_rooms rr
        join reservations r on r.id = rr.reservation_id
        where rr.id = reservation_guests.reservation_room_id
        and r.organization_id = get_user_organization_id()
    )
);

-- Reservation payments policies
create policy "Reservation payments select" on reservation_payments for select
using (
    organization_id = get_user_organization_id()
);

create policy "Reservation payments insert" on reservation_payments for insert
with check (
    organization_id = get_user_organization_id()
    and get_user_role() in ('admin', 'manager', 'employee')
);

-- Indexes
create index idx_room_types_org on room_types(organization_id);
create index idx_rooms_org_branch on rooms(organization_id, branch_id);
create index idx_rooms_branch_status on rooms(branch_id, status);
create index idx_rooms_type on rooms(room_type_id);
create index idx_reservations_org_branch on reservations(organization_id, branch_id);
create index idx_reservations_date_range on reservations(branch_id, check_in, check_out);
create index idx_reservations_status on reservations(status);
create index idx_reservation_rooms_reservation on reservation_rooms(reservation_id);
create index idx_reservation_rooms_room on reservation_rooms(room_id);
create index idx_reservation_guests_room on reservation_guests(reservation_room_id);
create index idx_reservation_payments_reservation on reservation_payments(reservation_id);
create index idx_reservation_payments_org on reservation_payments(organization_id);

-- Triggers
create trigger update_room_type_updated_at before update on room_types
for each row execute procedure public.update_updated_at_column();
create trigger update_room_updated_at before update on rooms
for each row execute procedure public.update_updated_at_column();
create trigger update_reservation_updated_at before update on reservations
for each row execute procedure public.update_updated_at_column();

-- Audit triggers
create trigger audit_room_types after insert or update or delete on room_types
for each row execute procedure public.audit_trigger_func();
create trigger audit_rooms after insert or update or delete on rooms
for each row execute procedure public.audit_trigger_func();
create trigger audit_reservations after insert or update or delete on reservations
for each row execute procedure public.audit_trigger_func();
