-- ============================================================================
-- NEXUSPOS - DATABASE SCHEMA v3.0
-- Multi-Tenancy SaaS for Products + Services + Appointments
-- Launch: April 2026
-- ============================================================================

-- ============================================================================
-- 1. CONFIGURACIÓN INICIAL Y EXTENSIONES
-- ============================================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- ============================================================================
-- 2. DEFINICIÓN DE TIPOS (ENUMS)
-- ============================================================================
create type user_role as enum ('admin', 'manager', 'employee', 'client');
create type appointment_status as enum ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');
create type transaction_type as enum ('sale', 'refund', 'adjustment', 'void');
create type payment_method as enum ('cash', 'card', 'transfer', 'mixed', 'digital_wallet');
create type audit_action as enum ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'LOGIN_FAILED', 'PERMISSION_DENIED');
create type sub_status as enum ('active', 'past_due', 'canceled', 'trial', 'over_limit');

-- ============================================================================
-- 3. NÚCLEO MULTI-TENANCY Y SUSCRIPCIONES
-- ============================================================================

-- Organizaciones (Tenants)
create table organizations (
    id uuid default uuid_generate_v4() primary key,
    name text not null,
    slug text,
    currency_code char(3) default 'BOB' check (length(currency_code) = 3),
    timezone text default 'America/La_Paz',
    country char(2) default 'BO',
    business_type text default 'both' check (business_type in ('products', 'services', 'both')),
    address text,
    billing_data jsonb,
    is_active boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Definición de Planes (Static Data)
create table subscription_plans (
    id uuid default uuid_generate_v4() primary key,
    slug text unique not null,
    name text not null,
    price_monthly numeric(10, 2) not null,
    price_yearly numeric(10, 2) not null,
    max_branches int not null default 1,
    max_users int not null default 5,
    max_storage_mb int default 1000,
    feature_multi_branch boolean default false,
    feature_manager_role boolean default false,
    feature_inventory_transfer boolean default false,
    feature_api_access boolean default false,
    feature_white_label boolean default false,
    feature_advanced_reports boolean default false,
    feature_forensic_export boolean default false,
    is_active boolean default true,
    created_at timestamptz default now()
);

-- Suscripción Activa por Organización
create table organization_subscriptions (
    id uuid default uuid_generate_v4() primary key,
    organization_id uuid references organizations(id) on delete cascade unique not null,
    plan_id uuid references subscription_plans(id) not null,
    status sub_status default 'trial',
    billing_mode text default 'monthly' check (billing_mode in ('monthly', 'annual')),
    current_period_start timestamptz default now(),
    current_period_end timestamptz not null,
    provider_subscription_id text,
    cancel_at_period_end boolean default false,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Sucursales
create table branches (
    id uuid default uuid_generate_v4() primary key,
    organization_id uuid references organizations(id) on delete cascade not null,
    name text not null,
    code text not null,
    address text,
    phone text,
    is_active boolean default true,
    settings jsonb default '{}'::jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique(organization_id, code)
);

-- ============================================================================
-- 4. GESTIÓN DE USUARIOS Y ROLES
-- ============================================================================

create table profiles (
    id uuid references auth.users(id) on delete cascade primary key,
    organization_id uuid references organizations(id) on delete set null,
    branch_id uuid references branches(id) on delete set null,
    full_name text not null,
    email text not null,
    role user_role default 'client',
    avatar_url text,
    phone text,
    is_active boolean default true,
    last_login_at timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    constraint valid_role_org check (
        (role in ('admin', 'manager', 'employee') and organization_id is not null) 
        or (role = 'client')
    )
);

-- Asignación Multi-Sucursal de Empleados
create table employee_branch_assignments (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references profiles(id) on delete cascade not null,
    branch_id uuid references branches(id) on delete cascade not null,
    can_manage_inventory boolean default false,
    can_override_prices boolean default false,
    skills jsonb default '[]'::jsonb,
    is_primary boolean default false,
    unique(user_id, branch_id)
);

-- ============================================================================
-- 5. CATÁLOGOS (PRODUCTOS Y SERVICIOS)
-- ============================================================================

create table categories (
    id uuid default uuid_generate_v4() primary key,
    organization_id uuid references organizations(id) on delete cascade not null,
    name text not null,
    type text check (type in ('product', 'service')) not null,
    parent_id uuid references categories(id) on delete set null,
    is_active boolean default true,
    unique(organization_id, name, type)
);

create table services (
    id uuid default uuid_generate_v4() primary key,
    organization_id uuid references organizations(id) on delete cascade not null,
    name text not null,
    description text,
    duration_minutes int not null check (duration_minutes > 0),
    price numeric(12, 2) not null check (price >= 0),
    category_id uuid references categories(id) on delete set null,
    is_active boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table products (
    id uuid default uuid_generate_v4() primary key,
    organization_id uuid references organizations(id) on delete cascade not null,
    sku text,
    name text not null,
    description text,
    cost_price numeric(12, 2) default 0 check (cost_price >= 0),
    sale_price numeric(12, 2) not null check (sale_price >= 0),
    category_id uuid references categories(id) on delete set null,
    track_inventory boolean default true,
    is_active boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- ✅ Índice único parcial para SKU (creado por separado)
create unique index idx_products_unique_sku on products(organization_id, sku) where (sku is not null);

-- Inventario por Sucursal
create table inventory_stock (
    id uuid default uuid_generate_v4() primary key,
    branch_id uuid references branches(id) on delete cascade not null,
    product_id uuid references products(id) on delete cascade not null,
    quantity int default 0 check (quantity >= 0),
    min_stock_level int default 5 check (min_stock_level >= 0),
    reserved_quantity int default 0 check (reserved_quantity >= 0),
    updated_at timestamptz default now(),
    unique(branch_id, product_id)
);

create table inventory_movements (
    id uuid default uuid_generate_v4() primary key,
    organization_id uuid references organizations(id) on delete cascade not null,
    branch_id uuid references branches(id) on delete cascade not null,
    product_id uuid references products(id) on delete cascade not null,
    movement_type text not null check (movement_type in ('entry', 'exit', 'adjustment', 'transfer_in', 'transfer_out')),
    quantity int not null check (quantity > 0),
    previous_quantity int not null check (previous_quantity >= 0),
    new_quantity int not null check (new_quantity >= 0),
    reason text,
    note text,
    reference_type text,
    reference_id uuid,
    source_branch_id uuid references branches(id) on delete set null,
    destination_branch_id uuid references branches(id) on delete set null,
    created_by uuid references profiles(id) on delete set null,
    created_at timestamptz default now()
);

-- ============================================================================
-- 6. AGENDA Y CITAS
-- ============================================================================

create table appointments (
    id uuid default uuid_generate_v4() primary key,
    organization_id uuid references organizations(id) on delete cascade not null,
    branch_id uuid references branches(id) on delete cascade not null,
    customer_id uuid references profiles(id) on delete set null,
    customer_name text,
    customer_phone text,
    employee_id uuid references profiles(id) not null,
    service_id uuid references services(id) not null,
    start_time timestamptz not null,
    end_time timestamptz not null,
    status appointment_status default 'pending',
    notes text,
    cancelled_by uuid references profiles(id) on delete set null,
    cancellation_reason text,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    constraint valid_time_range check (end_time > start_time),
    constraint valid_status_flow check (
        (status = 'cancelled' and cancelled_by is not null) 
        or (status != 'cancelled')
    )
);

-- ✅ ÍNDICES CORREGIDOS (Separados por tipo)
-- Índice GIST solo para el rango de tiempo (detectar solapamientos)
create table guest_customers (
    id uuid default uuid_generate_v4() primary key,
    organization_id uuid references organizations(id) on delete cascade not null,
    branch_id uuid references branches(id) on delete set null,
    full_name text not null,
    phone text,
    notes text,
    created_by uuid references profiles(id) on delete set null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index idx_appointments_employee_range_gist on appointments using gist (
    employee_id,
    organization_id,
    tstzrange(start_time, end_time, '[)')
);

alter table appointments add constraint appointments_no_overlap_per_employee
exclude using gist (
    employee_id with =,
    organization_id with =,
    tstzrange(start_time, end_time, '[)') with &&
) where (status in ('pending', 'confirmed', 'in_progress'));

-- Índices B-TREE para filtrado rápido
create index idx_appointments_branch on appointments(branch_id);
create index idx_appointments_employee on appointments(employee_id);
create index idx_appointments_branch_employee_time on appointments(branch_id, employee_id, start_time);
create index idx_appointments_status on appointments(status);

-- ============================================================================
-- 7. TRANSACCIONES (POS HÍBRIDO)
-- ============================================================================

create table transactions (
    id uuid default uuid_generate_v4() primary key,
    organization_id uuid references organizations(id) on delete cascade not null,
    branch_id uuid references branches(id) on delete cascade not null,
    invoice_number serial,
    customer_id uuid references profiles(id) on delete set null,
    employee_id uuid references profiles(id) not null,
    total_amount numeric(12, 2) not null check (total_amount >= 0),
    discount_amount numeric(12, 2) default 0 check (discount_amount >= 0),
    tax_amount numeric(12, 2) default 0 check (tax_amount >= 0),
    final_amount numeric(12, 2) not null check (final_amount >= 0),
    payment_method payment_method default 'cash',
    type transaction_type default 'sale',
    related_appointment_id uuid references appointments(id) on delete set null,
    status text default 'completed' check (status in ('completed', 'refunded', 'voided')),
    refund_reason text,
    created_at timestamptz default now(),
    constraint valid_math check (final_amount = total_amount - discount_amount + tax_amount)
);

create table transaction_items (
    id uuid default uuid_generate_v4() primary key,
    transaction_id uuid references transactions(id) on delete cascade not null,
    product_id uuid references products(id) on delete restrict,
    service_id uuid references services(id) on delete restrict,
    quantity int not null check (quantity != 0),
    unit_price numeric(12, 2) not null check (unit_price >= 0),
    subtotal numeric(12, 2) not null check (subtotal >= 0),
    item_type text check (item_type in ('product', 'service')) not null,
    snapshot_data jsonb
);

-- ============================================================================
-- 8. MÓDULO FORENSE (AUDIT LOGS)
-- ============================================================================

create table audit_logs (
    id bigint generated always as identity primary key,
    logged_at timestamptz default now() not null,
    user_id uuid references auth.users(id) on delete set null,
    action audit_action not null,
    table_name text not null,
    record_id uuid,
    old_data jsonb,
    new_data jsonb,
    ip_address inet,
    user_agent text,
    context jsonb,
    checksum text
);

alter table audit_logs enable row level security;

-- Política estricta: Solo lectura para Admins, NUNCA escritura manual desde app
create policy "Admins can view audit logs" on audit_logs for select
using (
    exists (
        select 1 from profiles p 
        join organization_subscriptions os on p.organization_id = os.organization_id
        join subscription_plans sp on os.plan_id = sp.id
        where p.id = auth.uid() 
        and p.role = 'admin'
        and sp.feature_forensic_export = true
    )
);

-- ============================================================================
-- 9. FUNCIONES AUXILIARES Y LÓGICA DE NEGOCIO
-- ============================================================================

-- Función para actualizar timestamps
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Función de Auditoría Automática
create or replace function public.audit_trigger_func() returns trigger as $$
declare
    v_old_data jsonb;
    v_new_data jsonb;
    v_checksum text;
    v_user_id uuid;
    v_ip_address inet;
    v_user_agent text;
    v_context jsonb;
begin
    if (tg_op = 'DELETE') then
        v_old_data = to_jsonb(old);
        v_new_data = null;
    elsif (tg_op = 'UPDATE') then
        v_old_data = to_jsonb(old);
        v_new_data = to_jsonb(new);
    elsif (tg_op = 'INSERT') then
        v_old_data = null;
        v_new_data = to_jsonb(new);
    end if;

    v_checksum = md5((coalesce(v_old_data::text, '') || coalesce(v_new_data::text, '') || tg_table_name || now()::text)::bytea);

    -- Safely get user context (may be null during auth triggers)
    v_user_id = coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
    
    -- Safely get IP address (may be null during scheduled jobs)
    begin
        v_ip_address = inet_client_addr();
    exception when others then
        v_ip_address = null;
    end;
    
    -- Safely get user agent from headers
    begin
        v_user_agent = nullif(current_setting('request.headers', true)::json->>'user-agent', '');
    exception when others then
        v_user_agent = null;
    end;
    
    -- Safely get audit context
    begin
        v_context = nullif(current_setting('app.audit_context', true)::jsonb, null);
    exception when others then
        v_context = null;
    end;

    insert into public.audit_logs (
        user_id, action, table_name, record_id, old_data, new_data, 
        ip_address, user_agent, context, checksum
    ) values (
        v_user_id,
        tg_op::audit_action,
        tg_table_name,
        coalesce(old.id, new.id),
        v_old_data,
        v_new_data,
        v_ip_address,
        v_user_agent,
        v_context,
        v_checksum
    );

    return new;
end;
$$ language plpgsql security definer;

-- Función Crítica: Verificar Límites de Suscripción
create or replace function check_subscription_limit(org_id uuid, resource_type text)
returns boolean as $$
declare
    v_plan_id uuid;
    v_limit int;
    v_current_count int;
    v_feature_enabled boolean;
begin
    select os.plan_id into v_plan_id
    from organization_subscriptions os
    where os.organization_id = org_id 
      and os.status in ('active', 'trial')
      and os.current_period_end > now();

    if v_plan_id is null then
        raise exception 'No active subscription found.';
    end if;

    if resource_type = 'branch' then
        select max_branches into v_limit from subscription_plans where id = v_plan_id;
        select count(*) into v_current_count from branches where organization_id = org_id;
        
        if v_current_count >= v_limit then
            return false;
        end if;
        
        if v_current_count > 1 then
            select feature_multi_branch into v_feature_enabled from subscription_plans where id = v_plan_id;
            if not coalesce(v_feature_enabled, false) then
                return false;
            end if;
        end if;

    elsif resource_type = 'user' then
        select max_users into v_limit from subscription_plans where id = v_plan_id;
        select count(*) into v_current_count from profiles 
        where organization_id = org_id and role != 'client';
        
        if v_current_count >= v_limit then
            return false;
        end if;
    end if;

    return true;
end;
$$ language plpgsql security definer;

-- Función RPC: Crear organización + subscription + profile admin (Onboarding simplificado)
create or replace function create_onboarding_organization(
    p_name text,
    p_business_type text default 'both',
    p_country text default 'BO',
    p_currency text default 'BOB',
    p_timezone text default 'America/La_Paz',
    p_billing_mode text default 'monthly',
    p_full_name text default null,
    p_email text default null,
    p_phone text default null
) returns uuid as $$
declare
    v_org_id uuid;
    v_user_id uuid;
    v_plan_id uuid;
    v_plan_slug text;
begin
    v_user_id := auth.uid();
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;

    -- Get plan from user_metadata
    v_plan_slug := coalesce(
        (select (u.raw_user_meta_data->>'selectedPlan')::text from auth.users u where u.id = v_user_id),
        'emprende'
    );
    select id into v_plan_id from subscription_plans where slug = v_plan_slug limit 1;
    if v_plan_id is null then
        select id into v_plan_id from subscription_plans where slug = 'emprende' limit 1;
    end if;

    -- Create organization
    insert into organizations (name, currency_code, timezone, business_type)
    values (p_name, p_currency, p_timezone, p_business_type)
    returning id into v_org_id;

    -- Create subscription (trial 30 days)
    insert into organization_subscriptions (organization_id, plan_id, status, current_period_end)
    values (v_org_id, v_plan_id, 'trial', now() + interval '30 days');

    -- Update profile
    update profiles
    set organization_id = v_org_id,
        role = 'admin',
        full_name = coalesce(p_full_name, full_name),
        email = coalesce(p_email, email),
        phone = coalesce(p_phone, phone)
    where id = v_user_id;

    -- Create default branch
    insert into branches (organization_id, name, code)
    values (v_org_id, 'Principal', 'MAIN');

    -- Assign user to default branch
    insert into employee_branch_assignments (user_id, branch_id, is_primary)
    select v_user_id, b.id, true
    from branches b where b.organization_id = v_org_id limit 1;

    return v_org_id;
end;
$$ language plpgsql security definer;

-- Función RPC para obtener capacidades completas (Frontend Helper)
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

-- Helper Function para obtener rol
create or replace function get_user_role() returns user_role as $$
declare
    u_role user_role;
begin
    select role into u_role from profiles where id = auth.uid();
    return u_role;
end;
$$ language plpgsql security definer;

create or replace function get_user_organization_id() returns uuid as $$
declare
    v_org_id uuid;
begin
    select organization_id into v_org_id from profiles where id = auth.uid();
    return v_org_id;
end;
$$ language plpgsql security definer;

create or replace function get_user_branch_id() returns uuid as $$
declare
    v_branch_id uuid;
begin
    select branch_id into v_branch_id from profiles where id = auth.uid();
    return v_branch_id;
end;
$$ language plpgsql security definer;

create or replace function is_user_assigned_to_branch(target_branch_id uuid) returns boolean as $$
begin
    return exists (
        select 1
        from employee_branch_assignments
        where user_id = auth.uid()
          and branch_id = target_branch_id
    );
end;
$$ language plpgsql security definer;

create or replace function is_branch_in_user_organization(target_branch_id uuid) returns boolean as $$
begin
    return exists (
        select 1
        from branches
        where id = target_branch_id
          and organization_id = get_user_organization_id()
    );
end;
$$ language plpgsql security definer;

-- ============================================================================
-- 10. TRIGGERS DE APLICACIÓN
-- ============================================================================

-- Triggers de Actualización de Timestamps
create trigger update_org_updated_at before update on organizations for each row execute procedure public.update_updated_at_column();
create trigger update_branch_updated_at before update on branches for each row execute procedure public.update_updated_at_column();
create trigger update_profile_updated_at before update on profiles for each row execute procedure public.update_updated_at_column();
create trigger update_service_updated_at before update on services for each row execute procedure public.update_updated_at_column();
create trigger update_product_updated_at before update on products for each row execute procedure public.update_updated_at_column();
create trigger update_stock_updated_at before update on inventory_stock for each row execute procedure public.update_updated_at_column();
create trigger update_appt_updated_at before update on appointments for each row execute procedure public.update_updated_at_column();
create trigger update_sub_updated_at before update on organization_subscriptions for each row execute procedure public.update_updated_at_column();

-- Triggers de Auditoría (Tablas Críticas)
create trigger audit_transactions after insert or update or delete on transactions for each row execute procedure public.audit_trigger_func();
create trigger audit_inventory after insert or update or delete on inventory_stock for each row execute procedure public.audit_trigger_func();
create trigger audit_appointments after insert or update or delete on appointments for each row execute procedure public.audit_trigger_func();
create trigger audit_profiles after insert or update or delete on profiles for each row execute procedure public.audit_trigger_func();
create trigger audit_branches after insert or update or delete on branches for each row execute procedure public.audit_trigger_func();

-- Trigger de Enforce Limit (Sucursales)
create or replace function enforce_branch_limit() returns trigger as $$
begin
    if not check_subscription_limit(new.organization_id, 'branch') then
        raise exception 'Subscription limit exceeded: Cannot create more branches. Please upgrade your plan.';
    end if;
    return new;
end;
$$ language plpgsql;

create trigger trg_enforce_branch_limit before insert on branches for each row execute procedure enforce_branch_limit();

-- ============================================================================
-- 11. ROW LEVEL SECURITY (RLS) - POLÍTICAS GENERALES
-- ============================================================================

-- Habilitar RLS en todas las tablas
alter table organizations enable row level security;
alter table branches enable row level security;
alter table profiles enable row level security;
alter table services enable row level security;
alter table products enable row level security;
alter table inventory_stock enable row level security;
alter table inventory_movements enable row level security;
alter table appointments enable row level security;
alter table transactions enable row level security;
alter table transaction_items enable row level security;
alter table organization_subscriptions enable row level security;
alter table categories enable row level security;
alter table employee_branch_assignments enable row level security;

-- Políticas Simplificadas pero Robustas

-- 1. Organizaciones: Solo miembros ven su org
create policy "Org members view own org" on organizations for all
using ( id = get_user_organization_id() );

-- 2. Sucursales: Admin ve todas, Manager/Empleado ven asignadas
create policy "Branch access control" on branches for all
using (
    organization_id = get_user_organization_id()
    and (
        get_user_role() = 'admin'
        or id = get_user_branch_id()
        or is_user_assigned_to_branch(id)
    )
);

-- 3. Perfiles: Admin gestiona todos, usuario ve el propio
create policy "Profile access" on profiles for all
using (
    id = auth.uid()
    or (
        organization_id = get_user_organization_id()
        and (
            get_user_role() = 'admin'
            or (get_user_role() = 'manager' and branch_id = get_user_branch_id())
        )
    )
);

-- 4. Inventario: Lectura para staff de la sucursal, Escritura para Admin/Manager
create policy "Inventory select" on inventory_stock for select
using (
    branch_id in (
        select id from branches where organization_id in (
            select get_user_organization_id()
        )
        and (
            get_user_role() = 'admin'
            or id = get_user_branch_id()
            or is_user_assigned_to_branch(id)
        )
    )
);

create policy "Inventory update" on inventory_stock for update
using (
    get_user_role() in ('admin', 'manager')
    and branch_id = get_user_branch_id()
);

create policy "Inventory movements select" on inventory_movements for select
using (
    organization_id = get_user_organization_id()
    and (
        get_user_role() = 'admin'
        or branch_id = get_user_branch_id()
        or is_user_assigned_to_branch(branch_id)
        or (source_branch_id is not null and is_user_assigned_to_branch(source_branch_id))
        or (destination_branch_id is not null and is_user_assigned_to_branch(destination_branch_id))
    )
);

-- 5. Transacciones: Visibilidad por sucursal/rol
create policy "Transactions select" on transactions for select
using (
    organization_id = get_user_organization_id()
    and (
        get_user_role() = 'admin'
        or branch_id = get_user_branch_id()
        or employee_id = auth.uid()
    )
);

-- 6. Suscripciones: Solo Admin de la org puede ver/editar
create policy "Subscriptions admin only" on organization_subscriptions for all
using (
    exists (
        select 1
        where get_user_role() = 'admin'
        and get_user_organization_id() = organization_subscriptions.organization_id
    )
);

-- 7. Servicios y Productos: Miembros de la org pueden ver
create policy "Services select" on services for select
using (
    organization_id = get_user_organization_id()
);

create policy "Products select" on products for select
using (
    organization_id = get_user_organization_id()
);

-- 8. Citas: Visibilidad según rol
create policy "Appointments select" on appointments for select
using (
    organization_id = get_user_organization_id()
    and (
        get_user_role() = 'admin'
        or branch_id = get_user_branch_id()
        or employee_id = auth.uid()
        or customer_id = auth.uid()
    )
);

-- 9. Categories: Miembros de la org pueden ver
create policy "Categories select" on categories for select
using (
    organization_id = get_user_organization_id()
);

-- 10. Employee Branch Assignments: Admin y Manager pueden ver
create policy "Employee assignments select" on employee_branch_assignments for select
using (
    get_user_role() in ('admin', 'manager')
    and is_branch_in_user_organization(employee_branch_assignments.branch_id)
);

create policy "Authenticated users can insert own auth audit logs" on audit_logs for insert
with check (
    auth.uid() is not null
    and user_id = auth.uid()
    and table_name = 'auth_sessions'
    and action = 'INSERT'
);

-- ============================================================================
-- 12. DATOS SEMILLA (SEED DATA) - PARA PRUEBAS INMEDIATAS
-- ============================================================================

-- Insertar Planes
insert into subscription_plans (slug, name, price_monthly, price_yearly, max_branches, max_users, feature_multi_branch, feature_manager_role, feature_inventory_transfer, feature_forensic_export, feature_api_access, feature_advanced_reports, feature_white_label) values
('emprende', 'Plan Emprende', 20.00, 204.00, 1, 5, false, false, false, false, false, false, false),
('crecimiento', 'Plan Crecimiento', 65.00, 663.00, 5, 50, true, true, true, false, false, true, false),
('enterprise', 'Plan Enterprise', 200.00, 2040.00, 999, 999, true, true, true, true, true, true, true);

-- ============================================================================
-- 13. ÍNDICES ADICIONALES PARA RENDIMIENTO
-- ============================================================================
create index idx_org_branches on branches(organization_id);
create index idx_profiles_org on profiles(organization_id);
create index idx_profiles_role on profiles(role);
create index idx_services_org on services(organization_id);
create index idx_products_org on products(organization_id);
create index idx_stock_branch on inventory_stock(branch_id);
create index idx_stock_product on inventory_stock(product_id);
create index idx_inventory_movements_branch_time on inventory_movements(branch_id, created_at desc);
create index idx_inventory_movements_product_time on inventory_movements(product_id, created_at desc);
create index idx_inventory_movements_org_time on inventory_movements(organization_id, created_at desc);
create index idx_transactions_branch_date on transactions(branch_id, created_at);
create index idx_transactions_org on transactions(organization_id);
create index idx_transaction_items_transaction on transaction_items(transaction_id);
create index idx_audit_logs_time on audit_logs(logged_at desc);
create index idx_audit_logs_user on audit_logs(user_id);
create index idx_audit_logs_table on audit_logs(table_name, record_id);
create index idx_org_sub_active on organization_subscriptions(organization_id, status);
create index idx_employee_assignments_user on employee_branch_assignments(user_id);
create index idx_employee_assignments_branch on employee_branch_assignments(branch_id);
create index idx_guest_customers_org on guest_customers(organization_id);
create index idx_guest_customers_branch on guest_customers(branch_id);
create index idx_guest_customers_phone on guest_customers(phone);

-- ============================================================================
-- FIN DEL SCRIPT - NEXUSPOS v3.0
-- ============================================================================
