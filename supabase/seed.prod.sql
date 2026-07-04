-- ============================================================================
-- NEXUSPOS - PRODUCTION BASELINE SEED
-- Target: clean production project
--
-- Includes only:
-- - subscription plans
-- - system user
-- - one demo organization per business shape
-- - one admin demo user per organization
-- - branches, subscriptions and baseline assignments
--
-- Skips:
-- - clients
-- - catalog items
-- - inventory, POS, appointments, reservations
-- - notifications, SIAT, payment validations, billing ledger
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
  '{"dashboard":true,"profile":true,"settings":true,"users":true,"clients":true,"pos.sales":true,"inventory":true,"appointments":true,"service_assignment":true,"reservations":true,"catalog.products":true,"catalog.services":true,"catalog.rooms":true,"catalog.categories.products":true,"catalog.categories.services":true,"catalog.categories.rooms":true,"reports.sales":true,"reports.services":true,"reports.lodging":true,"branches":false}'::jsonb,
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
  '{"dashboard":true,"profile":true,"settings":true,"users":true,"clients":true,"pos.sales":true,"inventory":true,"appointments":true,"service_assignment":true,"reservations":true,"catalog.products":true,"catalog.services":true,"catalog.rooms":true,"catalog.categories.products":true,"catalog.categories.services":true,"catalog.categories.rooms":true,"reports.sales":true,"reports.services":true,"reports.lodging":true,"branches":true}'::jsonb,
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
  '{"dashboard":true,"profile":true,"settings":true,"users":true,"clients":true,"pos.sales":true,"inventory":true,"appointments":true,"service_assignment":true,"reservations":true,"catalog.products":true,"catalog.services":true,"catalog.rooms":true,"catalog.categories.products":true,"catalog.categories.services":true,"catalog.categories.rooms":true,"reports.sales":true,"reports.services":true,"reports.lodging":true,"branches":true}'::jsonb,
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

select pg_temp.seed_auth_user(
  '31111111-1111-4111-8111-111111111111',
  'admin.producto@nexuspos.demo',
  'Demo123456!',
  'Paola Producto'
);

select pg_temp.seed_auth_user(
  '32111111-1111-4111-8111-111111111111',
  'admin.servicios@nexuspos.demo',
  'Demo123456!',
  'Sofia Salon'
);

select pg_temp.seed_auth_user(
  '33111111-1111-4111-8111-111111111111',
  'admin.hospedaje@nexuspos.demo',
  'Demo123456!',
  'Ruben Hotel'
);

select pg_temp.seed_auth_user(
  '34111111-1111-4111-8111-111111111111',
  'admin.multi@nexuspos.demo',
  'Demo123456!',
  'Elena Omni'
);

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
)
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  currency_code = excluded.currency_code,
  timezone = excluded.timezone,
  country = excluded.country,
  address = excluded.address,
  billing_data = excluded.billing_data,
  status = excluded.status,
  is_active = excluded.is_active,
  default_receipt_format = excluded.default_receipt_format,
  updated_at = now();

delete from public.organization_business_types
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  '13333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444'
);

insert into public.organization_business_types (organization_id, business_type) values
('11111111-1111-4111-8111-111111111111', 'product'),
('12222222-2222-4222-8222-222222222222', 'service'),
('13333333-3333-4333-8333-333333333333', 'lodging'),
('14444444-4444-4444-8444-444444444444', 'product'),
('14444444-4444-4444-8444-444444444444', 'service'),
('14444444-4444-4444-8444-444444444444', 'lodging');

delete from public.organization_subscriptions
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  '13333333-3333-4333-8333-333333333333',
  '14444444-4444-4444-8444-444444444444'
);

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
)
on conflict (id) do update
set
  organization_id = excluded.organization_id,
  name = excluded.name,
  code = excluded.code,
  address = excluded.address,
  phone = excluded.phone,
  is_active = excluded.is_active,
  settings = excluded.settings,
  updated_at = now();

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
('32111111-1111-4111-8111-111111111111', '12222222-2222-4222-8222-222222222222', 'Sofia Salon', 'admin.servicios@nexuspos.demo', 'admin', '+59172111111', true, now() - interval '2 days'),
('33111111-1111-4111-8111-111111111111', '13333333-3333-4333-8333-333333333333', 'Ruben Hotel', 'admin.hospedaje@nexuspos.demo', 'admin', '+59173111111', true, now() - interval '1 day'),
('34111111-1111-4111-8111-111111111111', '14444444-4444-4444-8444-444444444444', 'Elena Omni', 'admin.multi@nexuspos.demo', 'admin', '+59174111111', true, now() - interval '2 hours')
on conflict (id) do update
set
  organization_id = excluded.organization_id,
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  phone = excluded.phone,
  is_active = excluded.is_active,
  last_login_at = excluded.last_login_at,
  updated_at = now();

delete from public.employee_branch_assignments
where user_id in (
  '31111111-1111-4111-8111-111111111111',
  '32111111-1111-4111-8111-111111111111',
  '33111111-1111-4111-8111-111111111111',
  '34111111-1111-4111-8111-111111111111'
);

insert into public.employee_branch_assignments (
  user_id,
  branch_id,
  can_manage_inventory,
  can_override_prices,
  skills,
  is_primary
) values
('31111111-1111-4111-8111-111111111111', '21111111-1111-4111-8111-111111111111', true, true, '["inventory","sales"]'::jsonb, true),
('32111111-1111-4111-8111-111111111111', '22111111-1111-4111-8111-111111111111', true, true, '["appointments","services"]'::jsonb, true),
('33111111-1111-4111-8111-111111111111', '23111111-1111-4111-8111-111111111111', true, true, '["reservations","billing"]'::jsonb, true),
('34111111-1111-4111-8111-111111111111', '24111111-1111-4111-8111-111111111111', true, true, '["all"]'::jsonb, true);

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
)
on conflict (user_id) do update
set
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  is_active = excluded.is_active,
  permissions = excluded.permissions,
  updated_at = now();

select public.ensure_org_anonymous_customer_template('11111111-1111-4111-8111-111111111111');
select public.ensure_org_anonymous_customer_template('12222222-2222-4222-8222-222222222222');
select public.ensure_org_anonymous_customer_template('13333333-3333-4333-8333-333333333333');
select public.ensure_org_anonymous_customer_template('14444444-4444-4444-8444-444444444444');

commit;
