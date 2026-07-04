begin;

delete from public.appointments
where organization_id = '16666666-6666-4666-8666-666666666666';

delete from public.client_org
where organization_id = '16666666-6666-4666-8666-666666666666';

delete from public.employee_branch_assignments
where user_id in (
  select id
  from auth.users
  where email in (
    'admin.shapa@nexuspos.demo',
    'ariel.shapa@nexuspos.demo',
    'mateo.shapa@nexuspos.demo',
    'kevin.shapa@nexuspos.demo',
    'nadia.shapa@nexuspos.demo'
  )
);

delete from public.profiles
where organization_id = '16666666-6666-4666-8666-666666666666';

delete from public.services
where organization_id = '16666666-6666-4666-8666-666666666666';

delete from public.categories
where organization_id = '16666666-6666-4666-8666-666666666666';

delete from public.organization_storefront_settings
where organization_id = '16666666-6666-4666-8666-666666666666';

delete from public.organization_subscriptions
where organization_id = '16666666-6666-4666-8666-666666666666';

delete from public.organization_business_types
where organization_id = '16666666-6666-4666-8666-666666666666';

delete from public.branches
where organization_id = '16666666-6666-4666-8666-666666666666';

delete from public.organizations
where id = '16666666-6666-4666-8666-666666666666';

insert into public.organizations (
  id,
  name,
  slug,
  logo_url,
  currency_code,
  timezone,
  country,
  address,
  billing_data,
  status,
  is_active,
  default_receipt_format
) values (
  '16666666-6666-4666-8666-666666666666',
  'Barbers Shapa',
  'shapa-barber',
  '/brands/shapa-barber-logo.svg',
  'BOB',
  'America/La_Paz',
  'BO',
  'Av. Teniente Coronel Cornejo, ciudad de Cobija, frente a Casa Santa Elena',
  jsonb_build_object(
    'businessName', 'Barbers Shapa',
    'phone', '67231750',
    'whatsapp', '67231750',
    'facebook', 'https://www.facebook.com/barbers.shapa.2025',
    'tiktok', 'https://www.tiktok.com/@cobija_pando_bolvia',
    'city', 'Cobija',
    'booking_start', '09:00',
    'booking_end', '20:00',
    'hero_title', 'Tu imagen empieza aqui.',
    'hero_subtitle', 'Barberia, peluqueria y tratamientos en un espacio unisex pensado para salir impecable.',
    'about', 'Barbers Shapa combina cortes, barberia y tratamientos en una propuesta moderna, urbana y comercial para Cobija.'
  ),
  'active',
  true,
  'half_letter'
);

insert into public.organization_business_types (organization_id, business_type)
values ('16666666-6666-4666-8666-666666666666', 'service');

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
  '16666666-6666-4666-8666-666666666666'::uuid,
  sp.id,
  'active'::public.sub_status,
  'monthly',
  'transferencia',
  null::timestamptz,
  false,
  now() - interval '3 days',
  now() + interval '27 days',
  'sub_demo_shapa_001',
  false,
  'Barbers Shapa',
  'nit',
  '1001666666'
from public.subscription_plans sp
where sp.slug = 'crecimiento';

insert into public.branches (
  id,
  organization_id,
  name,
  code,
  address,
  phone,
  is_active,
  settings
) values (
  '26666666-6666-4666-8666-666666666666',
  '16666666-6666-4666-8666-666666666666',
  'Sucursal Cobija Centro',
  'SHP-CBJ',
  'Av. Teniente Coronel Cornejo, ciudad de Cobija, frente a Casa Santa Elena',
  '67231750',
  true,
  jsonb_build_object('booking_channel', 'storefront')
);

insert into public.profiles (
  id,
  organization_id,
  full_name,
  email,
  role,
  phone,
  is_active
)
select
  u.id,
  '16666666-6666-4666-8666-666666666666'::uuid,
  'Sonia Shapa',
  'admin.shapa@nexuspos.demo',
  'admin'::public.user_role,
  '+59167231750',
  true
from auth.users u
where u.email = 'admin.shapa@nexuspos.demo'
on conflict (id) do update
set
  organization_id = excluded.organization_id,
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  phone = excluded.phone,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.profiles (
  id,
  organization_id,
  full_name,
  email,
  role,
  phone,
  is_active
)
select
  u.id,
  '16666666-6666-4666-8666-666666666666'::uuid,
  'Ariel Fade',
  'ariel.shapa@nexuspos.demo',
  'manager'::public.user_role,
  '+59167231751',
  true
from auth.users u
where u.email = 'ariel.shapa@nexuspos.demo'
on conflict (id) do update
set
  organization_id = excluded.organization_id,
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  phone = excluded.phone,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.profiles (
  id,
  organization_id,
  full_name,
  email,
  role,
  phone,
  is_active
)
select
  u.id,
  '16666666-6666-4666-8666-666666666666'::uuid,
  'Mateo Studio',
  'mateo.shapa@nexuspos.demo',
  'employee'::public.user_role,
  '+59167231752',
  true
from auth.users u
where u.email = 'mateo.shapa@nexuspos.demo'
on conflict (id) do update
set
  organization_id = excluded.organization_id,
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  phone = excluded.phone,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.profiles (
  id,
  organization_id,
  full_name,
  email,
  role,
  phone,
  is_active
)
select
  u.id,
  '16666666-6666-4666-8666-666666666666'::uuid,
  'Kevin Blend',
  'kevin.shapa@nexuspos.demo',
  'employee'::public.user_role,
  '+59167231753',
  true
from auth.users u
where u.email = 'kevin.shapa@nexuspos.demo'
on conflict (id) do update
set
  organization_id = excluded.organization_id,
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  phone = excluded.phone,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.profiles (
  id,
  organization_id,
  full_name,
  email,
  role,
  phone,
  is_active
)
select
  u.id,
  '16666666-6666-4666-8666-666666666666'::uuid,
  'Nadia Care',
  'nadia.shapa@nexuspos.demo',
  'employee'::public.user_role,
  '+59167231754',
  true
from auth.users u
where u.email = 'nadia.shapa@nexuspos.demo'
on conflict (id) do update
set
  organization_id = excluded.organization_id,
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  phone = excluded.phone,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.categories (id, organization_id, name, type, description, is_active) values
('56661111-6666-4666-8666-666666666666', '16666666-6666-4666-8666-666666666666', 'Peluqueria', 'service', 'Cortes, peinados y estilizado.', true),
('56662222-6666-4666-8666-666666666666', '16666666-6666-4666-8666-666666666666', 'Barberia', 'service', 'Barba, afeitado y combos clasicos.', true),
('56663333-6666-4666-8666-666666666666', '16666666-6666-4666-8666-666666666666', 'Tratamientos', 'service', 'Cuidado capilar y facial.', true);

insert into public.services (
  id,
  organization_id,
  name,
  description,
  duration_minutes,
  price,
  category_id,
  image_url,
  is_active
) values
('66661111-6666-4666-8666-666666666666', '16666666-6666-4666-8666-666666666666', 'Corte clasico', 'Corte limpio con acabado profesional y peinado final.', 45, 35.00, '56661111-6666-4666-8666-666666666666', 'https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&w=1200&q=80', true),
('66662222-6666-4666-8666-666666666666', '16666666-6666-4666-8666-666666666666', 'Fade moderno', 'Laterales degradados, contorno definido y textura superior.', 60, 45.00, '56661111-6666-4666-8666-666666666666', 'https://images.unsplash.com/photo-1622288432450-277d0fef5ed6?auto=format&fit=crop&w=1200&q=80', true),
('66663333-6666-4666-8666-666666666666', '16666666-6666-4666-8666-666666666666', 'Perfilado de barba', 'Definicion de lineas, rebaje y acabado uniforme.', 25, 25.00, '56662222-6666-4666-8666-666666666666', 'https://images.unsplash.com/photo-1512690459411-b0fd1d276b22?auto=format&fit=crop&w=1200&q=80', true),
('66664444-6666-4666-8666-666666666666', '16666666-6666-4666-8666-666666666666', 'Corte + barba', 'Combo comercial para renovar imagen completa.', 75, 65.00, '56662222-6666-4666-8666-666666666666', 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80', true),
('66665555-6666-4666-8666-666666666666', '16666666-6666-4666-8666-666666666666', 'Hidratacion capilar', 'Tratamiento de nutricion y brillo para cabello seco o procesado.', 45, 50.00, '56663333-6666-4666-8666-666666666666', 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1200&q=80', true),
('66666666-6666-4666-8666-666666666666', '16666666-6666-4666-8666-666666666666', 'Spa capilar premium', 'Masaje, reparacion profunda y ritual de cierre.', 75, 85.00, '56663333-6666-4666-8666-666666666666', 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80', true),
('66667777-6666-4666-8666-666666666666', '16666666-6666-4666-8666-666666666666', 'Limpieza facial express', 'Rutina corta para limpieza, calma e hidratacion.', 35, 45.00, '56663333-6666-4666-8666-666666666666', 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1200&q=80', true);

insert into public.employee_branch_assignments (
  user_id,
  branch_id,
  can_manage_inventory,
  can_override_prices,
  skills,
  is_primary
)
select
  u.id,
  '26666666-6666-4666-8666-666666666666'::uuid,
  true,
  true,
  '["66661111-6666-4666-8666-666666666666","66662222-6666-4666-8666-666666666666","66663333-6666-4666-8666-666666666666","66664444-6666-4666-8666-666666666666"]'::jsonb,
  true
from auth.users u
where u.email = 'ariel.shapa@nexuspos.demo';

insert into public.employee_branch_assignments (
  user_id,
  branch_id,
  can_manage_inventory,
  can_override_prices,
  skills,
  is_primary
)
select
  u.id,
  '26666666-6666-4666-8666-666666666666'::uuid,
  false,
  false,
  '["66661111-6666-4666-8666-666666666666","66662222-6666-4666-8666-666666666666","66664444-6666-4666-8666-666666666666"]'::jsonb,
  true
from auth.users u
where u.email = 'mateo.shapa@nexuspos.demo';

insert into public.employee_branch_assignments (
  user_id,
  branch_id,
  can_manage_inventory,
  can_override_prices,
  skills,
  is_primary
)
select
  u.id,
  '26666666-6666-4666-8666-666666666666'::uuid,
  false,
  false,
  '["66661111-6666-4666-8666-666666666666","66663333-6666-4666-8666-666666666666","66664444-6666-4666-8666-666666666666"]'::jsonb,
  true
from auth.users u
where u.email = 'kevin.shapa@nexuspos.demo';

insert into public.employee_branch_assignments (
  user_id,
  branch_id,
  can_manage_inventory,
  can_override_prices,
  skills,
  is_primary
)
select
  u.id,
  '26666666-6666-4666-8666-666666666666'::uuid,
  false,
  false,
  '["66665555-6666-4666-8666-666666666666","66666666-6666-4666-8666-666666666666","66667777-6666-4666-8666-666666666666"]'::jsonb,
  true
from auth.users u
where u.email = 'nadia.shapa@nexuspos.demo';

insert into public.organization_storefront_settings (
  organization_id,
  business_type,
  template_key,
  color_preset_key,
  primary_color,
  secondary_color,
  accent_color,
  company_description,
  hero_image_url,
  is_published
) values (
  '16666666-6666-4666-8666-666666666666',
  'service',
  'service-salon',
  'industrial',
  '#111111',
  '#F4EDE1',
  '#D94B5A',
  'Barberia, peluqueria y tratamientos en una experiencia unisex con reservas por horario real.',
  'https://images.unsplash.com/photo-1512690459411-b0fd1d276b22?auto=format&fit=crop&w=1600&q=80',
  true
);

commit;

select
  o.slug,
  o.name,
  count(distinct s.id) as service_count,
  count(distinct p.id) as profile_count
from public.organizations o
left join public.services s on s.organization_id = o.id
left join public.profiles p on p.organization_id = o.id
where o.id = '16666666-6666-4666-8666-666666666666'
group by o.slug, o.name;
