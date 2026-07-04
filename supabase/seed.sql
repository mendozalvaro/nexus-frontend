-- ============================================================================
-- NEXUSPOS - REMOTE-ALIGNED DEMO SEED
-- Target: linked Supabase schema as of 2026-06-02
--
-- Demo organizations:
-- - Producto demo
-- - Servicios demo
-- - Hospedaje demo
-- - Multi-negocio demo (producto + servicio + hospedaje)
--
-- System user on linked remote:
-- - email: mendozalvarito@gmail.com
-- - name: Alvaro Mendoza
-- - password: 87654321
--
-- Demo password for the rest of seeded users:
-- - password: Demo123456!
-- ============================================================================

begin;

create or replace function pg_temp.seed_auth_user(
  p_id uuid,
  p_email text,
  p_password text,
  p_full_name text
) returns void
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at,
    is_sso_user,
    deleted_at,
    is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000',
    p_id,
    'authenticated',
    'authenticated',
    lower(trim(p_email)),
    crypt(p_password, gen_salt('bf')),
    now(),
    now(),
    '',
    now(),
    '',
    null,
    '',
    '',
    null,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name),
    false,
    now(),
    now(),
    null,
    null,
    '',
    '',
    null,
    '',
    0,
    null,
    '',
    null,
    false,
    null,
    false
  )
  on conflict (id) do update
  set
    email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    raw_user_meta_data = excluded.raw_user_meta_data,
    raw_app_meta_data = excluded.raw_app_meta_data,
    email_confirmed_at = now(),
    updated_at = now(),
    deleted_at = null,
    banned_until = null,
    is_anonymous = false;

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    p_id,
    p_id,
    jsonb_build_object('sub', p_id::text, 'email', lower(trim(p_email))),
    'email',
    lower(trim(p_email)),
    now(),
    now(),
    now()
  )
  on conflict (id) do update
  set
    user_id = excluded.user_id,
    identity_data = excluded.identity_data,
    provider = excluded.provider,
    provider_id = excluded.provider_id,
    last_sign_in_at = now(),
    updated_at = now();
end;
$$;

select pg_temp.seed_auth_user(
  '00000000-0000-0000-0000-000000000000',
  'system-seed@nexuspos.demo',
  '87654321',
  'System Seed User'
);

select pg_temp.seed_auth_user(
  '250306d0-f509-4ec5-820a-30c991e149cf',
  'mendozalvarito@gmail.com',
  '87654321',
  'Alvaro Mendoza'
);

update auth.users
set
  email = 'mendozalvarito@gmail.com',
  encrypted_password = crypt('87654321', gen_salt('bf')),
  raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
  raw_user_meta_data = jsonb_build_object('full_name', 'Alvaro Mendoza'),
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  updated_at = now(),
  deleted_at = null,
  banned_until = null,
  is_anonymous = false
where id = '250306d0-f509-4ec5-820a-30c991e149cf';

create or replace function public.ensure_org_anonymous_customer_template(
  p_organization_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_template_client_id uuid;
  anonymous_client_id uuid;
begin
  select co.client_id
  into existing_template_client_id
  from public.client_org co
  where co.organization_id = p_organization_id
    and co.status = 'active'
    and co.is_anonymous_template = true
  limit 1;

  if existing_template_client_id is not null then
    return;
  end if;

  insert into public.clients (
    user_id,
    first_name,
    last_name,
    phone,
    email,
    billing_data,
    preferences
  ) values (
    null,
    'Cliente',
    'Anonimo',
    null,
    null,
    '{}'::jsonb,
    jsonb_build_object('system', true, 'anonymous_template', true)
  )
  returning id into anonymous_client_id;

  insert into public.client_org (
    client_id,
    organization_id,
    status,
    billing_data,
    billing_name,
    billing_email,
    billing_phone,
    document_type,
    document_number,
    is_anonymous_template
  ) values (
    anonymous_client_id,
    p_organization_id,
    'active',
    '{}'::jsonb,
    'Cliente Anonimo',
    null,
    null,
    'SIN_DOC',
    null,
    true
  )
  on conflict (client_id, organization_id) do update
  set
    status = excluded.status,
    is_anonymous_template = true,
    billing_data = coalesce(public.client_org.billing_data, '{}'::jsonb),
    updated_at = now();
end;
$$;

-- ----------------------------------------------------------------------------
-- 1. Catalogo base de planes
-- ----------------------------------------------------------------------------

insert into public.subscription_plans (
  slug,
  name,
  price_monthly,
  price_yearly,
  business_only,
  description,
  resume,
  features,
  permissions,
  limits,
  available_billing_modes,
  trial,
  trial_duration,
  max_branches,
  max_users,
  max_storage_mb,
  feature_multi_branch,
  feature_manager_role,
  feature_inventory_transfer,
  feature_api_access,
  feature_white_label,
  feature_advanced_reports,
  feature_forensic_export,
  feature_hotel_module,
  allowed_business_types,
  max_business_types,
  is_active
) values
(
  'emprende',
  'Emprende',
  20.00,
  204.00,
  true,
  'Operacion inicial para un solo tipo de negocio.',
  'Base para comenzar',
  '["1 sucursal","3 usuarios","Catalogo basico","POS basico"]'::jsonb,
  '{
    "dashboard": true,
    "profile": true,
    "settings": true,
    "users": true,
    "clients": true,
    "pos.sales": true,
    "inventory": true,
    "appointments": true,
    "service_assignment": true,
    "reservations": true,
    "catalog.products": true,
    "catalog.services": true,
    "catalog.rooms": true,
    "catalog.categories.products": true,
    "catalog.categories.services": true,
    "catalog.categories.rooms": true,
    "reports.sales": true,
    "reports.services": true,
    "reports.lodging": true,
    "branches": false
  }'::jsonb,
  '{"users":3,"branches":1,"roles":{"manager":1,"employee":2}}'::jsonb,
  jsonb_build_object(
    'monthly', jsonb_build_object('label', 'monthly', 'enabled', true, 'discount_percent', 0),
    'quarterly', jsonb_build_object('label', 'quarterly', 'enabled', true, 'discount_percent', 10),
    'annual', jsonb_build_object('label', 'annual', 'enabled', true, 'discount_percent', 15)
  ),
  true,
  7,
  1,
  3,
  1000,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  '{product,service,lodging}'::public.business_type_enum[],
  1,
  true
),
(
  'crecimiento',
  'Crecimiento',
  65.00,
  663.00,
  false,
  'Operacion multi-sucursal para equipos en expansion.',
  'Escala inventario, agenda y reportes',
  '["4 sucursales","12 usuarios","Transferencias","Reportes","Reservas"]'::jsonb,
  '{
    "dashboard": true,
    "profile": true,
    "settings": true,
    "users": true,
    "clients": true,
    "pos.sales": true,
    "inventory": true,
    "appointments": true,
    "service_assignment": true,
    "reservations": true,
    "catalog.products": true,
    "catalog.services": true,
    "catalog.rooms": true,
    "catalog.categories.products": true,
    "catalog.categories.services": true,
    "catalog.categories.rooms": true,
    "reports.sales": true,
    "reports.services": true,
    "reports.lodging": true,
    "branches": true
  }'::jsonb,
  '{"users":12,"branches":4,"roles":{"manager":3,"employee":9}}'::jsonb,
  jsonb_build_object(
    'monthly', jsonb_build_object('label', 'monthly', 'enabled', true, 'discount_percent', 0),
    'quarterly', jsonb_build_object('label', 'quarterly', 'enabled', true, 'discount_percent', 10),
    'annual', jsonb_build_object('label', 'annual', 'enabled', true, 'discount_percent', 20)
  ),
  true,
  15,
  4,
  12,
  5000,
  true,
  true,
  true,
  false,
  false,
  true,
  false,
  true,
  '{product,service,lodging}'::public.business_type_enum[],
  2,
  true
),
(
  'enterprise',
  'Enterprise',
  200.00,
  2040.00,
  false,
  'Operacion integral con control multi-negocio.',
  'Suite completa',
  '["Sucursales amplias","Usuarios altos","Sistema","Facturacion","Reportes avanzados"]'::jsonb,
  '{
    "dashboard": true,
    "profile": true,
    "settings": true,
    "users": true,
    "clients": true,
    "pos.sales": true,
    "inventory": true,
    "appointments": true,
    "service_assignment": true,
    "reservations": true,
    "catalog.products": true,
    "catalog.services": true,
    "catalog.rooms": true,
    "catalog.categories.products": true,
    "catalog.categories.services": true,
    "catalog.categories.rooms": true,
    "reports.sales": true,
    "reports.services": true,
    "reports.lodging": true,
    "branches": true
  }'::jsonb,
  '{"users":999,"branches":20,"roles":{"manager":20,"employee":80}}'::jsonb,
  jsonb_build_object(
    'monthly', jsonb_build_object('label', 'monthly', 'enabled', true, 'discount_percent', 0),
    'quarterly', jsonb_build_object('label', 'quarterly', 'enabled', true, 'discount_percent', 12),
    'annual', jsonb_build_object('label', 'annual', 'enabled', true, 'discount_percent', 25)
  ),
  true,
  30,
  20,
  999,
  20000,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  '{product,service,lodging}'::public.business_type_enum[],
  3,
  true
)
on conflict (slug) do update
set
  name = excluded.name,
  price_monthly = excluded.price_monthly,
  price_yearly = excluded.price_yearly,
  business_only = excluded.business_only,
  description = excluded.description,
  resume = excluded.resume,
  features = excluded.features,
  permissions = excluded.permissions,
  limits = excluded.limits,
  available_billing_modes = excluded.available_billing_modes,
  trial = excluded.trial,
  trial_duration = excluded.trial_duration,
  max_branches = excluded.max_branches,
  max_users = excluded.max_users,
  max_storage_mb = excluded.max_storage_mb,
  feature_multi_branch = excluded.feature_multi_branch,
  feature_manager_role = excluded.feature_manager_role,
  feature_inventory_transfer = excluded.feature_inventory_transfer,
  feature_api_access = excluded.feature_api_access,
  feature_white_label = excluded.feature_white_label,
  feature_advanced_reports = excluded.feature_advanced_reports,
  feature_forensic_export = excluded.feature_forensic_export,
  feature_hotel_module = excluded.feature_hotel_module,
  allowed_business_types = excluded.allowed_business_types,
  max_business_types = excluded.max_business_types,
  is_active = excluded.is_active;

-- ----------------------------------------------------------------------------
-- 1b. Catalogo base de roles
-- ----------------------------------------------------------------------------

insert into public.user_roles (
  id,
  code,
  name,
  description,
  is_system,
  is_active
) values
('a1111111-1111-4111-8111-111111111111', 'admin', 'Administrador', 'Acceso administrativo de la organizacion.', true, true),
('a2222222-2222-4222-8222-222222222222', 'manager', 'Manager', 'Gestion operativa con alcance organizacional o de sucursal.', true, true),
('a3333333-3333-4333-8333-333333333333', 'employee', 'Empleado', 'Operacion diaria con permisos limitados.', true, true),
('a4444444-4444-4444-8444-444444444444', 'client', 'Cliente', 'Acceso al portal del cliente.', true, true)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  is_system = excluded.is_system,
  is_active = excluded.is_active,
  updated_at = now();

-- Sync source: supabase/shared/seed_default_role_module_permissions.sql
create or replace function public.seed_default_role_module_permissions()
returns void
language sql
set search_path = public
as $$
  delete from public.role_module_permissions
  where role_id in (
    select id
    from public.user_roles
    where code in ('admin', 'manager', 'employee', 'client')
  );

  with module_matrix as (
    select *
    from (values
      ('dashboard'),
      ('clients'),
      ('users'),
      ('branches'),
      ('settings'),
      ('profile'),
      ('pos.sales'),
      ('inventory'),
      ('appointments'),
      ('service_assignment'),
      ('reservations'),
      ('catalog.products'),
      ('catalog.services'),
      ('catalog.rooms'),
      ('catalog.categories.products'),
      ('catalog.categories.services'),
      ('catalog.categories.rooms'),
      ('reports.sales'),
      ('reports.services'),
      ('reports.lodging')
    ) as t(module_key)
  ),
  role_defaults as (
    select
      ur.id as role_id,
      ur.code,
      mm.module_key,
      case
        when ur.code = 'admin' then true
        when ur.code = 'manager' then mm.module_key in (
          'dashboard','clients','users','profile','pos.sales','inventory','appointments',
          'service_assignment','reservations','catalog.products','catalog.services',
          'catalog.rooms','catalog.categories.products','catalog.categories.services',
          'catalog.categories.rooms','reports.sales','reports.services','reports.lodging'
        )
        when ur.code = 'employee' then mm.module_key in ('dashboard','profile','pos.sales','appointments','reservations')
        when ur.code = 'client' then mm.module_key in ('appointments','profile')
        else false
      end as can_view,
      case
        when ur.code = 'admin' then true
        when ur.code = 'manager' then mm.module_key in (
          'users','pos.sales','inventory','appointments','service_assignment','reservations'
        )
        when ur.code = 'employee' then mm.module_key in ('pos.sales','appointments','reservations')
        when ur.code = 'client' then mm.module_key = 'appointments'
        else false
      end as can_create,
      case
        when ur.code = 'admin' then true
        when ur.code = 'manager' then mm.module_key in (
          'clients','users','profile','pos.sales','inventory','appointments','service_assignment',
          'reservations','catalog.products','catalog.services','catalog.rooms',
          'catalog.categories.products','catalog.categories.services','catalog.categories.rooms'
        )
        when ur.code = 'employee' then mm.module_key in ('profile','appointments','reservations')
        when ur.code = 'client' then mm.module_key = 'profile'
        else false
      end as can_edit,
      case
        when ur.code = 'admin' then true
        when ur.code = 'manager' then mm.module_key = 'reservations'
        else false
      end as can_delete,
      case
        when ur.code = 'admin' then true
        when ur.code = 'manager' then mm.module_key in ('reports.sales','reports.services','reports.lodging')
        else false
      end as can_export,
      (ur.code = 'admin') as can_manage,
      false as can_approve,
      case
        when ur.code in ('admin', 'manager') and mm.module_key = 'users' then true
        else false
      end as can_assign
    from public.user_roles ur
    cross join module_matrix mm
    where ur.code in ('admin', 'manager', 'employee', 'client')
  )
  insert into public.role_module_permissions (
    role_id,
    module_key,
    can_view,
    can_create,
    can_edit,
    can_delete,
    can_export,
    can_manage,
    can_approve,
    can_assign,
    created_at,
    updated_at
  )
  select
    role_id,
    module_key,
    can_view,
    can_create,
    can_edit,
    can_delete,
    can_export,
    can_manage,
    can_approve,
    can_assign,
    now(),
    now()
  from role_defaults;
$$;

select public.seed_default_role_module_permissions();

-- ----------------------------------------------------------------------------
-- 2. Limpieza idempotente de demo
-- ----------------------------------------------------------------------------

delete from public.notifications
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  '13333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.notification_templates
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  '13333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.notification_preferences
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  '13333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.sales_proformas
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  '13333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.sales_order_items
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  '13333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.sales_orders
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  '13333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.reservation_payments
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  '13333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.reservation_guests
where reservation_room_id in (
  select rr.id
  from public.reservation_rooms rr
  join public.reservations r on r.id = rr.reservation_id
  where r.organization_id in (
    '11111111-1111-4111-8111-111111111111',
    '12222222-2222-4222-8222-222222222222',
    '13333333-3333-4333-8333-333333333333',
    '14444444-4444-4444-8444-444444444444'
  )
);

delete from public.reservation_rooms
where reservation_id in (
  select id
  from public.reservations
  where organization_id in (
    '11111111-1111-4111-8111-111111111111',
    '12222222-2222-4222-8222-222222222222',
    '13333333-3333-4333-8333-333333333333',
    '14444444-4444-4444-8444-444444444444'
  )
);

delete from public.reservations
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  '13333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.transaction_items
where transaction_id in (
  select id
  from public.transactions
  where organization_id in (
    '11111111-1111-4111-8111-111111111111',
    '12222222-2222-4222-8222-222222222222',
    '13333333-3333-4333-8333-333333333333',
    '14444444-4444-4444-8444-444444444444'
  )
);

delete from public.transactions
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  '13333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.appointments
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  '13333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.inventory_transfer_batch_lines
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  '13333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.inventory_transfer_batches
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  '13333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.inventory_adjust_batches
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  '13333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.inventory_transfers
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  '13333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.inventory_movements
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  '13333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.inventory_stock
where branch_id in (
  '21111111-1111-4111-8111-111111111111',
  '22111111-1111-4111-8111-111111111111',
  '23111111-1111-4111-8111-111111111111',
  '24111111-1111-4111-8111-111111111111',
  '24222222-2222-4222-8222-222222222222',
  '24333333-3333-4333-8333-333333333333'
);

delete from public.rooms
where organization_id in (
  '13333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.rooms
where category_id in (
  select id
  from public.categories
  where organization_id in (
    '11111111-1111-4111-8111-111111111111',
    '12222222-2222-4222-8222-222222222222',
    '13333333-3333-4333-8333-333333333333',
    '14444444-4444-4444-8444-444444444444'
  )
);

delete from public.products
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.services
where organization_id in (
  '12222222-2222-4222-8222-222222222222',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.categories
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  '13333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.billing_ledger
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  '13333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.payment_validations
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  '13333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.onboarding_progress
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  '13333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444'
)
or user_id in (
  '31111111-1111-4111-8111-111111111111',
  '32111111-1111-4111-8111-111111111111',
  '33111111-1111-4111-8111-111111111111',
  '34111111-1111-4111-8111-111111111111'
);

delete from public.organization_siat_config
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.pos_number_sequences
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.inventory_document_sequences
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.profile_client_map
where profile_id in (
  '35111111-1111-4111-8111-111111111111',
  '35222222-2222-4222-8222-222222222222',
  '35333333-3333-4333-8333-333333333333',
  '35444444-4444-4444-8444-444444444444'
);

delete from public.client_org_billing_history
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  '13333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.client_org
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  '13333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.clients
where id in (
  select co.client_id
  from public.client_org co
  where co.organization_id in (
    '11111111-1111-4111-8111-111111111111',
    '12222222-2222-4222-8222-222222222222',
    '13333333-3333-4333-8333-333333333333',
    '14444444-4444-4444-8444-444444444444'
  )
)
or id in (
  '45111111-1111-4111-8111-111111111111',
  '45222222-2222-4222-8222-222222222222',
  '45333333-3333-4333-8333-333333333333',
  '45444444-4444-4444-8444-444444444444',
  '46111111-1111-4111-8111-111111111111',
  '46222222-2222-4222-8222-222222222222',
  '46333333-3333-4333-8333-333333333333',
  '46444444-4444-4444-8444-444444444444'
)
or user_id in (
  '35111111-1111-4111-8111-111111111111',
  '35222222-2222-4222-8222-222222222222',
  '35333333-3333-4333-8333-333333333333',
  '35444444-4444-4444-8444-444444444444'
);

delete from public.employee_branch_assignments
where user_id in (
  '31111111-1111-4111-8111-111111111111',
  '31222222-2222-4222-8222-222222222222',
  '32111111-1111-4111-8111-111111111111',
  '32222222-2222-4222-8222-222222222222',
  '32333333-3333-4333-8333-333333333333',
  '33111111-1111-4111-8111-111111111111',
  '33222222-2222-4222-8222-222222222222',
  '34111111-1111-4111-8111-111111111111',
  '34222222-2222-4222-8222-222222222222',
  '34333333-3333-4333-8333-333333333333'
);

delete from public.employee_branch_assignments
where user_id in (
  select id
  from public.profiles
  where email ilike '%@nexuspos.demo'
);

delete from public.system_users
where user_id in (
  '00000000-0000-0000-0000-000000000000',
  '250306d0-f509-4ec5-820a-30c991e149cf'
);

delete from public.profiles
where id in (
  '31111111-1111-4111-8111-111111111111',
  '31222222-2222-4222-8222-222222222222',
  '32111111-1111-4111-8111-111111111111',
  '32222222-2222-4222-8222-222222222222',
  '32333333-3333-4333-8333-333333333333',
  '33111111-1111-4111-8111-111111111111',
  '33222222-2222-4222-8222-222222222222',
  '34111111-1111-4111-8111-111111111111',
  '34222222-2222-4222-8222-222222222222',
  '34333333-3333-4333-8333-333333333333',
  '35111111-1111-4111-8111-111111111111',
  '35222222-2222-4222-8222-222222222222',
  '35333333-3333-4333-8333-333333333333',
  '35444444-4444-4444-8444-444444444444'
);

delete from public.profiles
where email ilike '%@nexuspos.demo';

delete from auth.identities
where user_id in (
  '31111111-1111-4111-8111-111111111111',
  '31222222-2222-4222-8222-222222222222',
  '32111111-1111-4111-8111-111111111111',
  '32222222-2222-4222-8222-222222222222',
  '32333333-3333-4333-8333-333333333333',
  '33111111-1111-4111-8111-111111111111',
  '33222222-2222-4222-8222-222222222222',
  '34111111-1111-4111-8111-111111111111',
  '34222222-2222-4222-8222-222222222222',
  '34333333-3333-4333-8333-333333333333',
  '35111111-1111-4111-8111-111111111111',
  '35222222-2222-4222-8222-222222222222',
  '35333333-3333-4333-8333-333333333333',
  '35444444-4444-4444-8444-444444444444'
);

delete from auth.identities
where provider_id ilike '%@nexuspos.demo'
  and user_id <> '00000000-0000-0000-0000-000000000000';

delete from auth.users
where id in (
  '31111111-1111-4111-8111-111111111111',
  '31222222-2222-4222-8222-222222222222',
  '32111111-1111-4111-8111-111111111111',
  '32222222-2222-4222-8222-222222222222',
  '32333333-3333-4333-8333-333333333333',
  '33111111-1111-4111-8111-111111111111',
  '33222222-2222-4222-8222-222222222222',
  '34111111-1111-4111-8111-111111111111',
  '34222222-2222-4222-8222-222222222222',
  '34333333-3333-4333-8333-333333333333',
  '35111111-1111-4111-8111-111111111111',
  '35222222-2222-4222-8222-222222222222',
  '35333333-3333-4333-8333-333333333333',
  '35444444-4444-4444-8444-444444444444'
);

delete from auth.users
where email ilike '%@nexuspos.demo'
  and id <> '00000000-0000-0000-0000-000000000000';

delete from public.organization_business_types
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  '13333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.organization_subscriptions
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  '13333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.branches
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  '13333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444'
);

delete from public.organizations
where id in (
  '11111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  '13333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444'
);

-- ----------------------------------------------------------------------------
-- 3. Usuarios auth demo
-- ----------------------------------------------------------------------------

select pg_temp.seed_auth_user('31111111-1111-4111-8111-111111111111', 'admin.producto@nexuspos.demo', 'Demo123456!', 'Paola Producto');
select pg_temp.seed_auth_user('31222222-2222-4222-8222-222222222222', 'staff.producto@nexuspos.demo', 'Demo123456!', 'Pedro Bodega');
select pg_temp.seed_auth_user('32111111-1111-4111-8111-111111111111', 'admin.servicios@nexuspos.demo', 'Demo123456!', 'Sofia Salon');
select pg_temp.seed_auth_user('32222222-2222-4222-8222-222222222222', 'manager.servicios@nexuspos.demo', 'Demo123456!', 'Marcos Agenda');
select pg_temp.seed_auth_user('32333333-3333-4333-8333-333333333333', 'staff.servicios@nexuspos.demo', 'Demo123456!', 'Lucia Estilista');
select pg_temp.seed_auth_user('33111111-1111-4111-8111-111111111111', 'admin.hospedaje@nexuspos.demo', 'Demo123456!', 'Ruben Hotel');
select pg_temp.seed_auth_user('33222222-2222-4222-8222-222222222222', 'staff.hospedaje@nexuspos.demo', 'Demo123456!', 'Nora Recepcion');
select pg_temp.seed_auth_user('34111111-1111-4111-8111-111111111111', 'admin.multi@nexuspos.demo', 'Demo123456!', 'Elena Omni');
select pg_temp.seed_auth_user('34222222-2222-4222-8222-222222222222', 'manager.multi@nexuspos.demo', 'Demo123456!', 'Diego Operaciones');
select pg_temp.seed_auth_user('34333333-3333-4333-8333-333333333333', 'staff.multi@nexuspos.demo', 'Demo123456!', 'Valeria Frontdesk');
select pg_temp.seed_auth_user('35111111-1111-4111-8111-111111111111', 'cliente.producto@nexuspos.demo', 'Demo123456!', 'Camila Compra');
select pg_temp.seed_auth_user('35222222-2222-4222-8222-222222222222', 'cliente.servicios@nexuspos.demo', 'Demo123456!', 'Jorge Cortez');
select pg_temp.seed_auth_user('35333333-3333-4333-8333-333333333333', 'cliente.hospedaje@nexuspos.demo', 'Demo123456!', 'Ana Viaja');
select pg_temp.seed_auth_user('35444444-4444-4444-8444-444444444444', 'cliente.multi@nexuspos.demo', 'Demo123456!', 'Mario Combo');

-- ----------------------------------------------------------------------------
-- 4. Organizaciones, tipos y suscripciones
-- ----------------------------------------------------------------------------

insert into public.organizations (
  id,
  name,
  slug,
  currency_code,
  timezone,
  country,
  address,
  billing_data,
  status,
  is_active,
  default_receipt_format
) values
(
  '11111111-1111-4111-8111-111111111111',
  'Demo Retail Producto',
  'demo-retail-producto',
  'BOB',
  'America/La_Paz',
  'BO',
  'Av. Comercio 101, La Paz',
  jsonb_build_object('businessName', 'Demo Retail Producto', 'inventory_code_prefix', 'RET'),
  'active',
  true,
  'thermal'
),
(
  '12222222-2222-4222-8222-222222222222',
  'Demo Servicios Salon',
  'demo-servicios-salon',
  'BOB',
  'America/La_Paz',
  'BO',
  'Av. Belleza 202, Cochabamba',
  jsonb_build_object('businessName', 'Demo Servicios Salon', 'inventory_code_prefix', 'SAL'),
  'active',
  true,
  'thermal'
),
(
  '13333333-3333-4333-8333-333333333333',
  'Demo Hospedaje Andes',
  'demo-hospedaje-andes',
  'BOB',
  'America/La_Paz',
  'BO',
  'Calle Turismo 303, Uyuni',
  jsonb_build_object('businessName', 'Demo Hospedaje Andes'),
  'active',
  true,
  'half_letter'
),
(
  '14444444-4444-4444-8444-444444444444',
  'Demo Multi Negocio Nexus',
  'demo-multi-negocio-nexus',
  'BOB',
  'America/La_Paz',
  'BO',
  'Av. Integracion 404, Santa Cruz',
  jsonb_build_object('businessName', 'Demo Multi Negocio Nexus', 'inventory_code_prefix', 'OMNI'),
  'active',
  true,
  'thermal'
);

insert into public.organization_business_types (organization_id, business_type) values
('11111111-1111-4111-8111-111111111111', 'product'),
('12222222-2222-4222-8222-222222222222', 'service'),
('13333333-3333-4333-8333-333333333333', 'lodging'),
('14444444-4444-4444-8444-444444444444', 'product'),
('14444444-4444-4444-8444-444444444444', 'service'),
('14444444-4444-4444-8444-444444444444', 'lodging');

insert into public.organization_subscriptions (
  organization_id,
  plan_id,
  status,
  billing_mode,
  payment_method,
  trial_ends_at,
  is_trial,
  current_period_start,
  current_period_end,
  provider_subscription_id,
  cancel_at_period_end,
  invoice_name,
  doc_type,
  doc_number
)
  select
    '11111111-1111-4111-8111-111111111111'::uuid,
    sp.id,
    'active'::public.sub_status,
    'monthly',
    'qr',
    null::timestamptz,
    false,
    now() - interval '20 days',
    now() + interval '70 days',
    'sub_demo_retail_001',
    false,
    'Demo Retail Producto SRL',
    'nit',
  '1001001001'
from public.subscription_plans sp
where sp.slug = 'emprende'
union all
select
  '12222222-2222-4222-8222-222222222222'::uuid,
  sp.id,
  'active'::public.sub_status,
  'quarterly',
  'transferencia',
  null::timestamptz,
  false,
  now() - interval '20 days',
  now() + interval '70 days',
  'sub_demo_service_001',
  false,
  'Demo Servicios Salon SRL',
  'nit',
  '1001001002'
from public.subscription_plans sp
where sp.slug = 'crecimiento'
union all
select
  '13333333-3333-4333-8333-333333333333'::uuid,
  sp.id,
  'trial'::public.sub_status,
  'monthly',
  null::text,
  now() + interval '10 days',
  true,
  now() - interval '20 days',
  now() + interval '10 days',
  'sub_demo_hotel_001',
  false,
  'Demo Hospedaje Andes',
  'nit',
  '1001001003'
from public.subscription_plans sp
where sp.slug = 'crecimiento'
union all
select
  '14444444-4444-4444-8444-444444444444'::uuid,
  sp.id,
  'active'::public.sub_status,
  'annual',
  'tarjeta',
  null::timestamptz,
  false,
  now() - interval '45 days',
  now() + interval '320 days',
  'sub_demo_omni_001',
  false,
  'Demo Multi Negocio Nexus SA',
  'nit',
  '1001001004'
from public.subscription_plans sp
where sp.slug = 'enterprise';

insert into public.branches (
  id,
  organization_id,
  name,
  code,
  address,
  phone,
  is_active,
  settings
) values
(
  '21111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'Tienda Central',
  'RET-CEN',
  'Av. Comercio 101, La Paz',
  '+59170010001',
  true,
  '{"receipt_prefix":"RET","opensAt":"08:00","closesAt":"20:00"}'::jsonb
),
(
  '22111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  'Salon Principal',
  'SAL-CEN',
  'Av. Belleza 202, Cochabamba',
  '+59170010002',
  true,
  '{"receipt_prefix":"SAL","appointment_color":"rose"}'::jsonb
),
(
  '23111111-1111-4111-8111-111111111111',
  '13333333-3333-4333-8333-333333333333',
  'Recepcion Hotel',
  'HOT-CEN',
  'Calle Turismo 303, Uyuni',
  '+59170010003',
  true,
  '{"receipt_prefix":"HOT"}'::jsonb
),
(
  '24111111-1111-4111-8111-111111111111',
  '14444444-4444-4444-8444-444444444444',
  'Omni Central',
  'OMN-CEN',
  'Av. Integracion 404, Santa Cruz',
  '+59170010004',
  true,
  '{"receipt_prefix":"OMC","appointment_color":"sky"}'::jsonb
),
(
  '24222222-2222-4222-8222-222222222222',
  '14444444-4444-4444-8444-444444444444',
  'Omni Spa',
  'OMN-SPA',
  'Av. Integracion 405, Santa Cruz',
  '+59170010005',
  true,
  '{"receipt_prefix":"OMS","appointment_color":"emerald"}'::jsonb
),
(
  '24333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444',
  'Omni Hotel',
  'OMN-HOT',
  'Av. Integracion 406, Santa Cruz',
  '+59170010006',
  true,
  '{"receipt_prefix":"OMH"}'::jsonb
);

-- ----------------------------------------------------------------------------
-- 5. Perfiles, system user y asignaciones
-- ----------------------------------------------------------------------------

insert into public.profiles (
  id,
  organization_id,
  full_name,
  email,
  role,
  phone,
  is_active,
  last_login_at
) values
('31111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Paola Producto', 'admin.producto@nexuspos.demo', 'admin', '+59171111111', true, now() - interval '1 day'),
('31222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Pedro Bodega', 'staff.producto@nexuspos.demo', 'employee', '+59171222222', true, now() - interval '5 hours'),
('32111111-1111-4111-8111-111111111111', '12222222-2222-4222-8222-222222222222', 'Sofia Salon', 'admin.servicios@nexuspos.demo', 'admin', '+59172111111', true, now() - interval '2 days'),
('32222222-2222-4222-8222-222222222222', '12222222-2222-4222-8222-222222222222', 'Marcos Agenda', 'manager.servicios@nexuspos.demo', 'manager', '+59172222222', true, now() - interval '8 hours'),
('32333333-3333-4333-8333-333333333333', '12222222-2222-4222-8222-222222222222', 'Lucia Estilista', 'staff.servicios@nexuspos.demo', 'employee', '+59172333333', true, now() - interval '3 hours'),
('33111111-1111-4111-8111-111111111111', '13333333-3333-4333-8333-333333333333', 'Ruben Hotel', 'admin.hospedaje@nexuspos.demo', 'admin', '+59173111111', true, now() - interval '1 day'),
('33222222-2222-4222-8222-222222222222', '13333333-3333-4333-8333-333333333333', 'Nora Recepcion', 'staff.hospedaje@nexuspos.demo', 'employee', '+59173222222', true, now() - interval '7 hours'),
('34111111-1111-4111-8111-111111111111', '14444444-4444-4444-8444-444444444444', 'Elena Omni', 'admin.multi@nexuspos.demo', 'admin', '+59174111111', true, now() - interval '2 hours'),
('34222222-2222-4222-8222-222222222222', '14444444-4444-4444-8444-444444444444', 'Diego Operaciones', 'manager.multi@nexuspos.demo', 'manager', '+59174222222', true, now() - interval '4 hours'),
('34333333-3333-4333-8333-333333333333', '14444444-4444-4444-8444-444444444444', 'Valeria Frontdesk', 'staff.multi@nexuspos.demo', 'employee', '+59174333333', true, now() - interval '1 hour'),
('35111111-1111-4111-8111-111111111111', null, 'Camila Compra', 'cliente.producto@nexuspos.demo', 'client', '+59175111111', true, now() - interval '10 days'),
('35222222-2222-4222-8222-222222222222', null, 'Jorge Cortez', 'cliente.servicios@nexuspos.demo', 'client', '+59175222222', true, now() - interval '6 days'),
('35333333-3333-4333-8333-333333333333', null, 'Ana Viaja', 'cliente.hospedaje@nexuspos.demo', 'client', '+59175333333', true, now() - interval '4 days'),
('35444444-4444-4444-8444-444444444444', null, 'Mario Combo', 'cliente.multi@nexuspos.demo', 'client', '+59175444444', true, now() - interval '2 days');

insert into public.employee_branch_assignments (
  user_id,
  branch_id,
  can_manage_inventory,
  can_override_prices,
  skills,
  is_primary
) values
('31111111-1111-4111-8111-111111111111', '21111111-1111-4111-8111-111111111111', true, true, '["inventory","sales"]'::jsonb, true),
('31222222-2222-4222-8222-222222222222', '21111111-1111-4111-8111-111111111111', true, false, '["inventory"]'::jsonb, true),
('32111111-1111-4111-8111-111111111111', '22111111-1111-4111-8111-111111111111', true, true, '["appointments","services"]'::jsonb, true),
('32222222-2222-4222-8222-222222222222', '22111111-1111-4111-8111-111111111111', true, false, '["appointments","reports"]'::jsonb, true),
('32333333-3333-4333-8333-333333333333', '22111111-1111-4111-8111-111111111111', false, false, '["haircut","spa"]'::jsonb, true),
('33111111-1111-4111-8111-111111111111', '23111111-1111-4111-8111-111111111111', true, true, '["reservations","billing"]'::jsonb, true),
('33222222-2222-4222-8222-222222222222', '23111111-1111-4111-8111-111111111111', false, false, '["frontdesk"]'::jsonb, true),
('34111111-1111-4111-8111-111111111111', '24111111-1111-4111-8111-111111111111', true, true, '["all"]'::jsonb, true),
('34222222-2222-4222-8222-222222222222', '24111111-1111-4111-8111-111111111111', true, true, '["inventory","appointments","reports"]'::jsonb, true),
('34333333-3333-4333-8333-333333333333', '24222222-2222-4222-8222-222222222222', false, false, '["massage","checkin"]'::jsonb, true),
('34333333-3333-4333-8333-333333333333', '24333333-3333-4333-8333-333333333333', false, false, '["frontdesk"]'::jsonb, false);

insert into public.system_users (
  user_id,
  full_name,
  email,
  role,
  is_active,
  permissions,
  created_by
) values (
  '250306d0-f509-4ec5-820a-30c991e149cf',
  'Alvaro Mendoza',
  'mendozalvarito@gmail.com',
  'system',
  true,
  '["system.access","system.admin","system.users.manage","system.payments.validate"]'::jsonb,
  '250306d0-f509-4ec5-820a-30c991e149cf'
);

-- ----------------------------------------------------------------------------
-- 6. Clientes y vinculaciones
-- ----------------------------------------------------------------------------

insert into public.clients (
  id,
  user_id,
  first_name,
  last_name,
  phone,
  email,
  billing_data,
  preferences,
  notification_preferences
) values
('45111111-1111-4111-8111-111111111111', '35111111-1111-4111-8111-111111111111', 'Camila', 'Compra', '+59175111111', 'cliente.producto@nexuspos.demo', '{}'::jsonb, '{"channel":"portal"}'::jsonb, '{"whatsapp":true}'::jsonb),
('45222222-2222-4222-8222-222222222222', '35222222-2222-4222-8222-222222222222', 'Jorge', 'Cortez', '+59175222222', 'cliente.servicios@nexuspos.demo', '{}'::jsonb, '{"channel":"portal"}'::jsonb, '{"whatsapp":true}'::jsonb),
('45333333-3333-4333-8333-333333333333', '35333333-3333-4333-8333-333333333333', 'Ana', 'Viaja', '+59175333333', 'cliente.hospedaje@nexuspos.demo', '{}'::jsonb, '{"channel":"portal"}'::jsonb, '{"whatsapp":false}'::jsonb),
('45444444-4444-4444-8444-444444444444', '35444444-4444-4444-8444-444444444444', 'Mario', 'Combo', '+59175444444', 'cliente.multi@nexuspos.demo', '{}'::jsonb, '{"channel":"portal"}'::jsonb, '{"whatsapp":true}'::jsonb),
('46111111-1111-4111-8111-111111111111', null, 'Walter', 'Retail', '+59176111111', 'walkin.producto@nexuspos.demo', '{}'::jsonb, '{}'::jsonb, '{"whatsapp":false}'::jsonb),
('46222222-2222-4222-8222-222222222222', null, 'Bianca', 'Salon', '+59176222222', 'walkin.servicios@nexuspos.demo', '{}'::jsonb, '{}'::jsonb, '{"whatsapp":true}'::jsonb),
('46333333-3333-4333-8333-333333333333', null, 'Kevin', 'Hospedaje', '+59176333333', 'walkin.hospedaje@nexuspos.demo', '{}'::jsonb, '{}'::jsonb, '{"whatsapp":false}'::jsonb),
('46444444-4444-4444-8444-444444444444', null, 'Natalia', 'Omni', '+59176444444', 'walkin.multi@nexuspos.demo', '{}'::jsonb, '{}'::jsonb, '{"whatsapp":true}'::jsonb);

insert into public.profile_client_map (profile_id, client_id) values
('35111111-1111-4111-8111-111111111111', '45111111-1111-4111-8111-111111111111'),
('35222222-2222-4222-8222-222222222222', '45222222-2222-4222-8222-222222222222'),
('35333333-3333-4333-8333-333333333333', '45333333-3333-4333-8333-333333333333'),
('35444444-4444-4444-8444-444444444444', '45444444-4444-4444-8444-444444444444');

insert into public.client_org (
  client_id,
  organization_id,
  status,
  billing_data,
  document_type,
  document_number,
  billing_name,
  billing_email,
  billing_phone,
  is_anonymous_template
) values
('45111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'active', '{}'::jsonb, 'CI', '7894561', 'Camila Compra', 'cliente.producto@nexuspos.demo', '+59175111111', false),
('46111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'active', '{}'::jsonb, 'NIT', '2001002001', 'Walter Retail', 'walkin.producto@nexuspos.demo', '+59176111111', false),
('45222222-2222-4222-8222-222222222222', '12222222-2222-4222-8222-222222222222', 'active', '{}'::jsonb, 'CI', '7894562', 'Jorge Cortez', 'cliente.servicios@nexuspos.demo', '+59175222222', false),
('46222222-2222-4222-8222-222222222222', '12222222-2222-4222-8222-222222222222', 'active', '{}'::jsonb, 'NIT', '2001002002', 'Bianca Salon', 'walkin.servicios@nexuspos.demo', '+59176222222', false),
('45333333-3333-4333-8333-333333333333', '13333333-3333-4333-8333-333333333333', 'active', '{}'::jsonb, 'CI', '7894563', 'Ana Viaja', 'cliente.hospedaje@nexuspos.demo', '+59175333333', false),
('46333333-3333-4333-8333-333333333333', '13333333-3333-4333-8333-333333333333', 'active', '{}'::jsonb, 'SIN_DOC', null, 'Kevin Hospedaje', 'walkin.hospedaje@nexuspos.demo', '+59176333333', false),
('45444444-4444-4444-8444-444444444444', '14444444-4444-4444-8444-444444444444', 'active', '{}'::jsonb, 'CI', '7894564', 'Mario Combo', 'cliente.multi@nexuspos.demo', '+59175444444', false),
('46444444-4444-4444-8444-444444444444', '14444444-4444-4444-8444-444444444444', 'active', '{}'::jsonb, 'NIT', '2001002004', 'Natalia Omni', 'walkin.multi@nexuspos.demo', '+59176444444', false);

-- ----------------------------------------------------------------------------
-- 7. Catalogo, inventario y movimientos
-- ----------------------------------------------------------------------------

insert into public.categories (id, organization_id, name, type, description, is_active) values
('51111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Bebidas', 'product', 'Bebidas refrigeradas y calientes.', true),
('51222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Snacks', 'product', 'Productos de impulso.', true),
('52111111-1111-4111-8111-111111111111', '12222222-2222-4222-8222-222222222222', 'Cabello', 'service', 'Servicios de cabello.', true),
('52222222-2222-4222-8222-222222222222', '12222222-2222-4222-8222-222222222222', 'Spa', 'service', 'Servicios de bienestar.', true),
('53111111-1111-4111-8111-111111111111', '13333333-3333-4333-8333-333333333333', 'Habitacion Simple', 'lodging', 'Habitacion para 1 huesped.', true),
('53222222-2222-4222-8222-222222222222', '13333333-3333-4333-8333-333333333333', 'Habitacion Doble', 'lodging', 'Habitacion para 2 huespedes.', true),
('54111111-1111-4111-8111-111111111111', '14444444-4444-4444-8444-444444444444', 'Market', 'product', 'Retail de apoyo.', true),
('54222222-2222-4222-8222-222222222222', '14444444-4444-4444-8444-444444444444', 'Spa Premium', 'service', 'Servicios premium.', true),
('54333333-3333-4333-8333-333333333333', '14444444-4444-4444-8444-444444444444', 'Suite Vista', 'lodging', 'Categoria de suite.', true);

insert into public.services (
  id,
  organization_id,
  name,
  description,
  duration_minutes,
  price,
  category_id,
  is_active
) values
('62111111-1111-4111-8111-111111111111', '12222222-2222-4222-8222-222222222222', 'Corte Clasico', 'Corte + peinado.', 45, 35.00, '52111111-1111-4111-8111-111111111111', true),
('62222222-2222-4222-8222-222222222222', '12222222-2222-4222-8222-222222222222', 'Color Premium', 'Coloracion completa.', 120, 95.00, '52111111-1111-4111-8111-111111111111', true),
('62333333-3333-4333-8333-333333333333', '12222222-2222-4222-8222-222222222222', 'Masaje Relajante', 'Sesion de 60 minutos.', 60, 70.00, '52222222-2222-4222-8222-222222222222', true),
('65111111-1111-4111-8111-111111111111', '14444444-4444-4444-8444-444444444444', 'Circuito Spa', 'Tratamiento corporal premium.', 90, 120.00, '54222222-2222-4222-8222-222222222222', true),
('65222222-2222-4222-8222-222222222222', '14444444-4444-4444-8444-444444444444', 'Barber Deluxe', 'Barba y corte.', 50, 48.00, '54222222-2222-4222-8222-222222222222', true);

insert into public.products (
  id,
  organization_id,
  sku,
  name,
  description,
  cost_price,
  sale_price,
  category_id,
  track_inventory,
  is_active
) values
('61111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'RET-AGUA-001', 'Agua 600ml', 'Botella de agua.', 2.50, 5.00, '51111111-1111-4111-8111-111111111111', true, true),
('61222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'RET-CAFE-002', 'Cafe Molido 250g', 'Cafe premium.', 18.00, 30.00, '51111111-1111-4111-8111-111111111111', true, true),
('61333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'RET-SNACK-003', 'Mix Andino', 'Snack salado.', 6.00, 12.00, '51222222-2222-4222-8222-222222222222', true, true),
('64111111-1111-4111-8111-111111111111', '14444444-4444-4444-8444-444444444444', 'OMN-KIT-001', 'Kit Bienvenida', 'Kit para huesped y spa.', 20.00, 42.00, '54111111-1111-4111-8111-111111111111', true, true),
('64222222-2222-4222-8222-222222222222', '14444444-4444-4444-8444-444444444444', 'OMN-AROMA-002', 'Aromaterapia', 'Aceite aromatico.', 12.00, 25.00, '54111111-1111-4111-8111-111111111111', true, true);

insert into public.inventory_stock (
  branch_id,
  product_id,
  quantity,
  min_stock_level,
  reserved_quantity
) values
('21111111-1111-4111-8111-111111111111', '61111111-1111-4111-8111-111111111111', 60, 12, 3),
('21111111-1111-4111-8111-111111111111', '61222222-2222-4222-8222-222222222222', 25, 6, 0),
('21111111-1111-4111-8111-111111111111', '61333333-3333-4333-8333-333333333333', 40, 10, 2),
('24111111-1111-4111-8111-111111111111', '64111111-1111-4111-8111-111111111111', 18, 4, 1),
('24111111-1111-4111-8111-111111111111', '64222222-2222-4222-8222-222222222222', 30, 8, 0),
('24222222-2222-4222-8222-222222222222', '64111111-1111-4111-8111-111111111111', 8, 4, 0),
('24222222-2222-4222-8222-222222222222', '64222222-2222-4222-8222-222222222222', 16, 6, 0);

insert into public.inventory_movements (
  id,
  organization_id,
  branch_id,
  product_id,
  movement_type,
  quantity,
  previous_quantity,
  new_quantity,
  reference_code,
  reason,
  note,
  created_by
) values
('71111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '21111111-1111-4111-8111-111111111111', '61111111-1111-4111-8111-111111111111', 'entry', 60, 0, 60, 'RET-ENT-001', 'stock_initial', 'Carga inicial retail', '31111111-1111-4111-8111-111111111111'),
('71222222-2222-4222-8222-222222222222', '14444444-4444-4444-8444-444444444444', '24111111-1111-4111-8111-111111111111', '64111111-1111-4111-8111-111111111111', 'entry', 18, 0, 18, 'OMN-ENT-001', 'stock_initial', 'Carga central omni', '34111111-1111-4111-8111-111111111111'),
('71333333-3333-4333-8333-333333333333', '14444444-4444-4444-8444-444444444444', '24222222-2222-4222-8222-222222222222', '64222222-2222-4222-8222-222222222222', 'entry', 16, 0, 16, 'OMN-ENT-002', 'stock_initial', 'Carga spa omni', '34222222-2222-4222-8222-222222222222');

insert into public.inventory_transfers (
  id,
  organization_id,
  product_id,
  source_branch_id,
  destination_branch_id,
  quantity,
  status,
  observations,
  reference_code,
  requested_by,
  requested_at,
  received_by,
  received_at
) values
(
  '72111111-1111-4111-8111-111111111111',
  '14444444-4444-4444-8444-444444444444',
  '64111111-1111-4111-8111-111111111111',
  '24111111-1111-4111-8111-111111111111',
  '24222222-2222-4222-8222-222222222222',
  4,
  'received',
  'Reposicion para tratamientos spa.',
  'OMN-TRF-001',
  '34222222-2222-4222-8222-222222222222',
  now() - interval '3 days',
  '34333333-3333-4333-8333-333333333333',
  now() - interval '2 days'
);

insert into public.inventory_transfer_batches (
  id,
  organization_id,
  source_branch_id,
  destination_branch_id,
  status,
  observations,
  total_lines,
  total_quantity,
  requested_by,
  requested_at,
  received_by,
  received_at,
  idempotency_key,
  reference_code
) values
(
  '72222222-2222-4222-8222-222222222222',
  '14444444-4444-4444-8444-444444444444',
  '24111111-1111-4111-8111-111111111111',
  '24222222-2222-4222-8222-222222222222',
  'received',
  'Transferencia batch de demo.',
  1,
  4,
  '34222222-2222-4222-8222-222222222222',
  now() - interval '3 days',
  '34333333-3333-4333-8333-333333333333',
  now() - interval '2 days',
  'seed-omni-transfer-batch-001',
  'OMN-BTR-001'
);

insert into public.inventory_transfer_batch_lines (
  id,
  batch_id,
  organization_id,
  product_id,
  quantity,
  status,
  source_previous_quantity,
  source_new_quantity,
  destination_previous_quantity,
  destination_new_quantity,
  received_by,
  received_at
) values
(
  '72333333-3333-4333-8333-333333333333',
  '72222222-2222-4222-8222-222222222222',
  '14444444-4444-4444-8444-444444444444',
  '64111111-1111-4111-8111-111111111111',
  4,
  'received',
  18,
  14,
  8,
  12,
  '34333333-3333-4333-8333-333333333333',
  now() - interval '2 days'
);

insert into public.inventory_adjust_batches (
  id,
  organization_id,
  branch_id,
  mode,
  reason,
  note,
  total_lines,
  processed_count,
  processed_by,
  idempotency_key
) values
(
  '72444444-4444-4444-8444-444444444444',
  '11111111-1111-4111-8111-111111111111',
  '21111111-1111-4111-8111-111111111111',
  'set',
  'opening_count',
  'Conteo inicial de apertura.',
  3,
  3,
  '31222222-2222-4222-8222-222222222222',
  'seed-retail-adjust-001'
);

-- ----------------------------------------------------------------------------
-- 8. Habitaciones, reservas y pagos
-- ----------------------------------------------------------------------------

insert into public.rooms (
  id,
  organization_id,
  branch_id,
  category_id,
  room_number,
  floor,
  status,
  base_price,
  notes,
  is_active
) values
('73111111-1111-4111-8111-111111111111', '13333333-3333-4333-8333-333333333333', '23111111-1111-4111-8111-111111111111', '53111111-1111-4111-8111-111111111111', '101', 1, 'available', 120.00, 'Vista patio.', true),
('73222222-2222-4222-8222-222222222222', '13333333-3333-4333-8333-333333333333', '23111111-1111-4111-8111-111111111111', '53222222-2222-4222-8222-222222222222', '102', 1, 'occupied', 180.00, 'Vista salar.', true),
('74111111-1111-4111-8111-111111111111', '14444444-4444-4444-8444-444444444444', '24333333-3333-4333-8333-333333333333', '54333333-3333-4333-8333-333333333333', '201', 2, 'occupied', 260.00, 'Suite demo principal.', true),
('74222222-2222-4222-8222-222222222222', '14444444-4444-4444-8444-444444444444', '24333333-3333-4333-8333-333333333333', '54333333-3333-4333-8333-333333333333', '202', 2, 'available', 280.00, 'Suite ejecutiva.', true);

insert into public.reservations (
  id,
  organization_id,
  branch_id,
  check_in,
  check_out,
  status,
  total_amount,
  paid_amount,
  source,
  notes,
  created_by
) values
('91111111-1111-4111-8111-111111111111', '13333333-3333-4333-8333-333333333333', '23111111-1111-4111-8111-111111111111', current_date - 1, current_date + 2, 'checked_in', 540.00, 300.00, 'staff', 'Reserva vigente de demostracion.', '33222222-2222-4222-8222-222222222222'),
('91222222-2222-4222-8222-222222222222', '14444444-4444-4444-8444-444444444444', '24333333-3333-4333-8333-333333333333', current_date + 3, current_date + 6, 'pending_payment', 780.00, 150.00, 'staff', 'Reserva multi-negocio con saldo pendiente.', '34333333-3333-4333-8333-333333333333');

insert into public.reservation_rooms (
  id,
  reservation_id,
  room_id,
  room_price,
  subtotal,
  notes
) values
('92111111-1111-4111-8111-111111111111', '91111111-1111-4111-8111-111111111111', '73222222-2222-4222-8222-222222222222', 180.00, 540.00, '3 noches tarifadas.'),
('92222222-2222-4222-8222-222222222222', '91222222-2222-4222-8222-222222222222', '74111111-1111-4111-8111-111111111111', 260.00, 780.00, '3 noches suite omni.');

insert into public.reservation_guests (
  id,
  reservation_room_id,
  full_name,
  document_type,
  document_number,
  address,
  phone,
  email,
  nationality,
  is_main_guest,
  birth_date,
  sex
) values
('93111111-1111-4111-8111-111111111111', '92111111-1111-4111-8111-111111111111', 'Ana Viaja', 'CI', '7894563', 'La Paz', '+59175333333', 'cliente.hospedaje@nexuspos.demo', 'BO', true, date '1995-03-12', 'female'),
('93222222-2222-4222-8222-222222222222', '92222222-2222-4222-8222-222222222222', 'Mario Combo', 'CI', '7894564', 'Santa Cruz', '+59175444444', 'cliente.multi@nexuspos.demo', 'BO', true, date '1991-08-21', 'male');

insert into public.reservation_payments (
  id,
  organization_id,
  reservation_id,
  amount,
  payment_method,
  payment_type,
  reference,
  notes,
  created_by
) values
('94111111-1111-4111-8111-111111111111', '13333333-3333-4333-8333-333333333333', '91111111-1111-4111-8111-111111111111', 300.00, 'transfer', 'deposit', 'HOT-DEP-001', 'Anticipo confirmado.', '33111111-1111-4111-8111-111111111111'),
('94222222-2222-4222-8222-222222222222', '14444444-4444-4444-8444-444444444444', '91222222-2222-4222-8222-222222222222', 150.00, 'card', 'deposit', 'OMN-DEP-001', 'Reserva parcial.', '34111111-1111-4111-8111-111111111111');

-- ----------------------------------------------------------------------------
-- 9. Citas, POS y comprobantes
-- ----------------------------------------------------------------------------

insert into public.appointments (
  id,
  organization_id,
  branch_id,
  customer_id,
  customer_name,
  customer_phone,
  employee_id,
  service_id,
  start_time,
  end_time,
  status,
  notes,
  source
) values
('81111111-1111-4111-8111-111111111111', '12222222-2222-4222-8222-222222222222', '22111111-1111-4111-8111-111111111111', '45222222-2222-4222-8222-222222222222', 'Jorge Cortez', '+59175222222', '32333333-3333-4333-8333-333333333333', '62111111-1111-4111-8111-111111111111', now() - interval '3 days', now() - interval '3 days' + interval '45 minutes', 'completed', 'Cita cerrada con venta adicional.', 'manual'),
('81222222-2222-4222-8222-222222222222', '12222222-2222-4222-8222-222222222222', '22111111-1111-4111-8111-111111111111', '46222222-2222-4222-8222-222222222222', 'Bianca Salon', '+59176222222', '32333333-3333-4333-8333-333333333333', '62222222-2222-4222-8222-222222222222', now() + interval '1 day', now() + interval '1 day' + interval '120 minutes', 'confirmed', 'Color premium reservado.', 'client_booking'),
('81333333-3333-4333-8333-333333333333', '14444444-4444-4444-8444-444444444444', '24222222-2222-4222-8222-222222222222', '45444444-4444-4444-8444-444444444444', 'Mario Combo', '+59175444444', '34333333-3333-4333-8333-333333333333', '65111111-1111-4111-8111-111111111111', now() + interval '2 hours', now() + interval '2 hours' + interval '90 minutes', 'confirmed', 'Circuito spa previo a check-in.', 'manual');

insert into public.transactions (
  id,
  organization_id,
  branch_id,
  invoice_number,
  customer_id,
  employee_id,
  total_amount,
  discount_amount,
  tax_amount,
  final_amount,
  payment_method,
  type,
  status,
  created_at
) values
('82111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '21111111-1111-4111-8111-111111111111', 1001, '46111111-1111-4111-8111-111111111111', '31222222-2222-4222-8222-222222222222', 47.00, 0.00, 0.00, 47.00, 'cash', 'sale', 'completed', now() - interval '2 days'),
('82222222-2222-4222-8222-222222222222', '12222222-2222-4222-8222-222222222222', '22111111-1111-4111-8111-111111111111', 2001, '45222222-2222-4222-8222-222222222222', '32333333-3333-4333-8333-333333333333', 35.00, 0.00, 0.00, 35.00, 'card', 'sale', 'completed', now() - interval '3 days'),
('82333333-3333-4333-8333-333333333333', '14444444-4444-4444-8444-444444444444', '24222222-2222-4222-8222-222222222222', 3001, '45444444-4444-4444-8444-444444444444', '34333333-3333-4333-8333-333333333333', 162.00, 12.00, 0.00, 150.00, 'mixed', 'sale', 'completed', now() - interval '12 hours');

update public.appointments
set transaction_id = '82222222-2222-4222-8222-222222222222'
where id = '81111111-1111-4111-8111-111111111111';

insert into public.transaction_items (
  id,
  transaction_id,
  product_id,
  service_id,
  quantity,
  unit_price,
  subtotal,
  item_type,
  snapshot_data,
  appointment_id
) values
('83111111-1111-4111-8111-111111111111', '82111111-1111-4111-8111-111111111111', '61111111-1111-4111-8111-111111111111', null, 5, 5.00, 25.00, 'product', '{"name":"Agua 600ml"}'::jsonb, null),
('83222222-2222-4222-8222-222222222222', '82111111-1111-4111-8111-111111111111', '61333333-3333-4333-8333-333333333333', null, 2, 11.00, 22.00, 'product', '{"name":"Mix Andino"}'::jsonb, null),
('83333333-3333-4333-8333-333333333333', '82222222-2222-4222-8222-222222222222', null, '62111111-1111-4111-8111-111111111111', 1, 35.00, 35.00, 'service', '{"name":"Corte Clasico"}'::jsonb, '81111111-1111-4111-8111-111111111111'),
('83444444-4444-4444-8444-444444444444', '82333333-3333-4333-8333-333333333333', null, '65111111-1111-4111-8111-111111111111', 1, 120.00, 120.00, 'service', '{"name":"Circuito Spa"}'::jsonb, null),
('83555555-5555-4555-8555-555555555555', '82333333-3333-4333-8333-333333333333', '64111111-1111-4111-8111-111111111111', null, 1, 42.00, 42.00, 'product', '{"name":"Kit Bienvenida"}'::jsonb, null);

insert into public.sales_orders (
  id,
  organization_id,
  branch_id,
  sales_order_number,
  created_by,
  customer_mode,
  customer_id,
  customer_full_name,
  customer_phone,
  customer_email,
  discount_type,
  discount_value,
  subtotal,
  discount_amount,
  tax_amount,
  final_amount,
  note,
  status,
  charged_transaction_id,
  charged_at
) values
('84111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '21111111-1111-4111-8111-111111111111', 1, '31111111-1111-4111-8111-111111111111', 'existing', '45111111-1111-4111-8111-111111111111', 'Camila Compra', '+59175111111', 'cliente.producto@nexuspos.demo', 'none', 0, 35.00, 0.00, 0.00, 35.00, 'Pedido retail listo para cobro.', 'charged', '82111111-1111-4111-8111-111111111111', now() - interval '2 days'),
('84222222-2222-4222-8222-222222222222', '14444444-4444-4444-8444-444444444444', '24111111-1111-4111-8111-111111111111', 1, '34222222-2222-4222-8222-222222222222', 'walk_in', '46444444-4444-4444-8444-444444444444', 'Natalia Omni', '+59176444444', 'walkin.multi@nexuspos.demo', 'fixed', 10.00, 130.00, 10.00, 0.00, 120.00, 'Orden mixta con proforma.', 'ready_to_charge', null, null);

insert into public.sales_order_items (
  id,
  sales_order_id,
  organization_id,
  branch_id,
  item_type,
  product_id,
  service_id,
  employee_id,
  scheduled_date,
  scheduled_time,
  quantity,
  unit_price,
  subtotal,
  snapshot_data
) values
('85111111-1111-4111-8111-111111111111', '84111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '21111111-1111-4111-8111-111111111111', 'product', '61222222-2222-4222-8222-222222222222', null, null, null, null, 1, 30.00, 30.00, '{"name":"Cafe Molido 250g"}'::jsonb),
('85222222-2222-4222-8222-222222222222', '84111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '21111111-1111-4111-8111-111111111111', 'product', '61111111-1111-4111-8111-111111111111', null, null, null, null, 1, 5.00, 5.00, '{"name":"Agua 600ml"}'::jsonb),
('85333333-3333-4333-8333-333333333333', '84222222-2222-4222-8222-222222222222', '14444444-4444-4444-8444-444444444444', '24111111-1111-4111-8111-111111111111', 'service', null, '65222222-2222-4222-8222-222222222222', '34333333-3333-4333-8333-333333333333', to_char(current_date + 1, 'YYYY-MM-DD'), '15:00', 1, 48.00, 48.00, '{"name":"Barber Deluxe"}'::jsonb),
('85444444-4444-4444-8444-444444444444', '84222222-2222-4222-8222-222222222222', '14444444-4444-4444-8444-444444444444', '24111111-1111-4111-8111-111111111111', 'product', '64111111-1111-4111-8111-111111111111', null, null, null, null, 2, 41.00, 82.00, '{"name":"Kit Bienvenida"}'::jsonb);

insert into public.sales_proformas (
  id,
  organization_id,
  branch_id,
  sales_order_id,
  proforma_number,
  status,
  snapshot,
  issued_by
) values
('86111111-1111-4111-8111-111111111111', '14444444-4444-4444-8444-444444444444', '24111111-1111-4111-8111-111111111111', '84222222-2222-4222-8222-222222222222', 1, 'issued', '{"customer":"Natalia Omni","items":2,"source":"seed"}'::jsonb, '34222222-2222-4222-8222-222222222222');

insert into public.pos_number_sequences (
  organization_id,
  sales_order_last,
  proforma_last
) values
('11111111-1111-4111-8111-111111111111', 1, 0),
('14444444-4444-4444-8444-444444444444', 1, 1);

-- ----------------------------------------------------------------------------
-- 10. Notificaciones, SIAT, onboarding y billing
-- ----------------------------------------------------------------------------

insert into public.notification_preferences (
  id,
  organization_id,
  whatsapp_enabled,
  whatsapp_phone_id,
  whatsapp_access_token,
  whatsapp_business_account_id,
  send_sale_receipt,
  send_appointment_confirmation,
  send_appointment_reminder,
  send_appointment_status_change,
  reminder_minutes_before
) values
('87111111-1111-4111-8111-111111111111', '12222222-2222-4222-8222-222222222222', true, 'phone-demo-svc', 'token-demo-svc', 'waba-demo-svc', true, true, true, true, 60),
('87222222-2222-4222-8222-222222222222', '14444444-4444-4444-8444-444444444444', true, 'phone-demo-omni', 'token-demo-omni', 'waba-demo-omni', true, true, true, true, 90);

insert into public.notification_templates (
  id,
  organization_id,
  notification_type,
  whatsapp_template_name,
  template_body,
  variables,
  is_active
) values
('88111111-1111-4111-8111-111111111111', '12222222-2222-4222-8222-222222222222', 'appointment_confirmation', 'appointment_confirmation_demo', 'Hola {{name}}, tu cita es el {{date}} a las {{time}}.', '["name","date","time"]'::jsonb, true),
('88222222-2222-4222-8222-222222222222', '14444444-4444-4444-8444-444444444444', 'sale_receipt', 'sale_receipt_demo', 'Gracias {{name}}, tu recibo total es {{amount}}.', '["name","amount"]'::jsonb, true);

insert into public.notifications (
  id,
  organization_id,
  notification_type,
  channel,
  recipient_phone,
  recipient_name,
  template_id,
  payload,
  status,
  whatsapp_message_id,
  retry_count,
  sent_at
) values
('89111111-1111-4111-8111-111111111111', '12222222-2222-4222-8222-222222222222', 'appointment_confirmation', 'whatsapp', '+59175222222', 'Jorge Cortez', '88111111-1111-4111-8111-111111111111', '{"date":"manana","time":"10:00"}'::jsonb, 'sent', 'wamid.demo.001', 0, now() - interval '30 minutes'),
('89222222-2222-4222-8222-222222222222', '14444444-4444-4444-8444-444444444444', 'sale_receipt', 'whatsapp', '+59175444444', 'Mario Combo', '88222222-2222-4222-8222-222222222222', '{"amount":"150.00"}'::jsonb, 'pending', null, 0, null);

insert into public.organization_siat_config (
  id,
  organization_id,
  razon_social,
  nit,
  regimen_tributario,
  actividad_economica,
  sucursal_siat,
  direccion_matriz,
  codigo_autorizacion,
  punto_venta,
  sistema_facturacion,
  codigo_sistema,
  resolucion_numero,
  is_active,
  last_sync_at
) values
('90111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Demo Retail Producto SRL', '1001001001', 'general', 'Comercio minorista', '0', 'Av. Comercio 101, La Paz', 'AUTH-RET-001', 'PV-1', 'siat_linea', 'SIS-RET-001', 'RES-RET-001', true, now() - interval '1 day'),
('90222222-2222-4222-8222-222222222222', '14444444-4444-4444-8444-444444444444', 'Demo Multi Negocio Nexus SA', '1001001004', 'general', 'Operacion multi-negocio', '0', 'Av. Integracion 404, Santa Cruz', 'AUTH-OMN-001', 'PV-1', 'propio', 'SIS-OMN-001', 'RES-OMN-001', true, now() - interval '2 hours');

insert into public.payment_validations (
  id,
  organization_id,
  user_id,
  amount,
  payment_method,
  transaction_ref,
  receipt_storage_path,
  receipt_filename,
  receipt_mime_type,
  status,
  rejection_reason,
  reviewed_at,
  reviewed_by_system_user
) values
('91111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', '31111111-1111-4111-8111-111111111111', 20.00, 'qr', 'PAY-RET-001', '250306d0-f509-4ec5-820a-30c991e149cf/11111111-1111-4111-8111-111111111111/retail.png', 'retail.png', 'image/png', 'approved', null, now() - interval '20 days', '250306d0-f509-4ec5-820a-30c991e149cf'),
('92222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '12222222-2222-4222-8222-222222222222', '32111111-1111-4111-8111-111111111111', 65.00, 'transfer', 'PAY-SVC-001', '250306d0-f509-4ec5-820a-30c991e149cf/12222222-2222-4222-8222-222222222222/service.png', 'service.png', 'image/png', 'approved', null, now() - interval '12 days', '250306d0-f509-4ec5-820a-30c991e149cf'),
('93333333-cccc-4ccc-8ccc-cccccccccccc', '13333333-3333-4333-8333-333333333333', '33111111-1111-4111-8111-111111111111', 65.00, 'cash', 'PAY-HOT-001', '00000000-0000-0000-0000-000000000000/13333333-3333-4333-8333-333333333333/hotel.png', 'hotel.png', 'image/png', 'pending', null, null, null),
('94444444-dddd-4ddd-8ddd-dddddddddddd', '14444444-4444-4444-8444-444444444444', '34111111-1111-4111-8111-111111111111', 200.00, 'card', 'PAY-OMN-001', '250306d0-f509-4ec5-820a-30c991e149cf/14444444-4444-4444-8444-444444444444/omni.png', 'omni.png', 'image/png', 'approved', null, now() - interval '40 days', '250306d0-f509-4ec5-820a-30c991e149cf');

insert into public.billing_ledger (
  id,
  organization_id,
  plan_id,
  event_type,
  amount,
  currency,
  billing_mode,
  description,
  metadata,
  created_by
)
select
  '95111111-1111-4111-8111-111111111111'::uuid,
  '11111111-1111-4111-8111-111111111111'::uuid,
  sp.id,
  'payment',
  20.00,
  'BOB',
  'monthly',
  'Activacion retail demo.',
  '{"source":"seed"}'::jsonb,
      '250306d0-f509-4ec5-820a-30c991e149cf'::uuid
from public.subscription_plans sp
where sp.slug = 'emprende'
union all
select
  '95222222-2222-4222-8222-222222222222'::uuid,
  '14444444-4444-4444-8444-444444444444'::uuid,
  sp.id,
  'payment',
  200.00,
  'BOB',
  'annual',
  'Activacion enterprise demo.',
  '{"source":"seed"}'::jsonb,
      '250306d0-f509-4ec5-820a-30c991e149cf'::uuid
from public.subscription_plans sp
where sp.slug = 'enterprise';

insert into public.onboarding_progress (
  user_id,
  organization_id,
  current_step,
  progress_data
) values
('31111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'completed', '{"seed":true,"module":"product"}'::jsonb),
('32111111-1111-4111-8111-111111111111', '12222222-2222-4222-8222-222222222222', 'completed', '{"seed":true,"module":"service"}'::jsonb),
('33111111-1111-4111-8111-111111111111', '13333333-3333-4333-8333-333333333333', 'payment', '{"seed":true,"module":"lodging"}'::jsonb),
('34111111-1111-4111-8111-111111111111', '14444444-4444-4444-8444-444444444444', 'completed', '{"seed":true,"module":"omni"}'::jsonb);

commit;
