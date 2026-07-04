-- Tenant demo idempotente para boutique publica "Moda Calida"

begin;

delete from public.sales_order_items
where organization_id = '15555555-5555-4555-8555-555555555555';

delete from public.sales_orders
where organization_id = '15555555-5555-4555-8555-555555555555';

delete from public.profiles
where organization_id = '15555555-5555-4555-8555-555555555555';

delete from public.inventory_stock
where branch_id = '25555555-5555-4555-8555-555555555555';

delete from public.products
where organization_id = '15555555-5555-4555-8555-555555555555';

delete from public.categories
where organization_id = '15555555-5555-4555-8555-555555555555';

delete from public.branches
where organization_id = '15555555-5555-4555-8555-555555555555';

delete from public.organization_subscriptions
where organization_id = '15555555-5555-4555-8555-555555555555';

delete from public.organization_business_types
where organization_id = '15555555-5555-4555-8555-555555555555';

delete from public.organizations
where id = '15555555-5555-4555-8555-555555555555';

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
) values (
  '15555555-5555-4555-8555-555555555555',
  'Moda Calida',
  'moda-calida',
  'BOB',
  'America/La_Paz',
  'BO',
  'Calle 21 de Calacoto, Torre Boutique 5, La Paz',
  jsonb_build_object(
    'businessName', 'Moda Calida',
    'inventory_code_prefix', 'MCA',
    'hero_title', 'Piezas femeninas para temporadas cambiantes, tardes tibias y noches con textura.',
    'hero_subtitle', 'Una boutique pensada para mezclar vestidos fluidos, sastreria suave, knitwear ligero y sets listos para pedir por WhatsApp.',
    'about', 'Moda Calida trabaja colecciones pequenas con foco en siluetas comerciales, tonos crema, arena, terracota y vino suave.',
    'whatsapp', '59170123456',
    'instagram', 'modacalida.bo',
    'city', 'La Paz',
    'shipping_message', 'Envios nacionales y retiro con cita previa en showroom.',
    'seasonal_note', 'El catalogo rota por temporada: verano suave, transicion urbana, oficina elegante y noches especiales.'
  ),
  'active',
  true,
  'half_letter'
);

insert into public.organization_business_types (organization_id, business_type)
values ('15555555-5555-4555-8555-555555555555', 'product');

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
  '15555555-5555-4555-8555-555555555555'::uuid,
  sp.id,
  'active'::public.sub_status,
  'monthly',
  'transferencia',
  null::timestamptz,
  false,
  now() - interval '7 days',
  now() + interval '23 days',
  'sub_demo_moda_calida_001',
  false,
  'Moda Calida Boutique',
  'nit',
  '1001001555'
from public.subscription_plans sp
where sp.slug = 'emprende';

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
  '25555555-5555-4555-8555-555555555555',
  '15555555-5555-4555-8555-555555555555',
  'Showroom Calacoto',
  'MCA-LP',
  'Calle 21 de Calacoto, Torre Boutique 5, La Paz',
  '+59170123456',
  true,
  jsonb_build_object('sales_channel', 'showroom')
);

insert into public.profiles (
  id,
  organization_id,
  full_name,
  email,
  role,
  is_active
)
select
  u.id,
  '15555555-5555-4555-8555-555555555555'::uuid,
  'Martina Calida',
  'admin.modacalida@nexuspos.demo',
  'admin'::public.user_role,
  true
from auth.users u
where u.email = 'admin.modacalida@nexuspos.demo'
on conflict (id) do update
set
  organization_id = excluded.organization_id,
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.categories (id, organization_id, name, type, parent_id, description, is_active) values
('55551000-5555-4555-8555-555555555555', '15555555-5555-4555-8555-555555555555', 'Vestidos', 'product', null, 'Vestidos ligeros, midi y de ocasion.', true),
('55552000-5555-4555-8555-555555555555', '15555555-5555-4555-8555-555555555555', 'Sastreria', 'product', null, 'Blazers, pantalones y piezas de oficina elegante.', true),
('55553000-5555-4555-8555-555555555555', '15555555-5555-4555-8555-555555555555', 'Tejidos y capas', 'product', null, 'Knits, cardigans y abrigos livianos.', true),
('55554000-5555-4555-8555-555555555555', '15555555-5555-4555-8555-555555555555', 'Sets y escapes', 'product', null, 'Conjuntos para viaje, brunch y fines de semana.', true),
('55551111-5555-4555-8555-555555555555', '15555555-5555-4555-8555-555555555555', 'Midi fluidos', 'product', '55551000-5555-4555-8555-555555555555', 'Vestidos midi con caida suave.', true),
('55551222-5555-4555-8555-555555555555', '15555555-5555-4555-8555-555555555555', 'Largos de ocasion', 'product', '55551000-5555-4555-8555-555555555555', 'Vestidos largos para eventos y noches especiales.', true),
('55552111-5555-4555-8555-555555555555', '15555555-5555-4555-8555-555555555555', 'Blazers', 'product', '55552000-5555-4555-8555-555555555555', 'Blazers suaves para oficina y eventos.', true),
('55552222-5555-4555-8555-555555555555', '15555555-5555-4555-8555-555555555555', 'Pantalones rectos', 'product', '55552000-5555-4555-8555-555555555555', 'Pantalones de estructura ligera.', true),
('55553111-5555-4555-8555-555555555555', '15555555-5555-4555-8555-555555555555', 'Cardigans', 'product', '55553000-5555-4555-8555-555555555555', 'Capas livianas para noches frescas.', true),
('55553222-5555-4555-8555-555555555555', '15555555-5555-4555-8555-555555555555', 'Abrigos livianos', 'product', '55553000-5555-4555-8555-555555555555', 'Abrigos cortos y suaves.', true),
('55554111-5555-4555-8555-555555555555', '15555555-5555-4555-8555-555555555555', 'Sets brunch', 'product', '55554000-5555-4555-8555-555555555555', 'Conjuntos para salidas de dia.', true),
('55554222-5555-4555-8555-555555555555', '15555555-5555-4555-8555-555555555555', 'Sets de media estacion', 'product', '55554000-5555-4555-8555-555555555555', 'Conjuntos elegantes para clima cambiante.', true);

insert into public.products (
  id,
  organization_id,
  sku,
  name,
  description,
  cost_price,
  sale_price,
  category_id,
  image_url,
  track_inventory,
  is_active
) values
('65551111-5555-4555-8555-555555555555', '15555555-5555-4555-8555-555555555555', 'MCA-VES-001', 'Vestido Siena Midi', 'Vestido midi en tono terracota con caida suave y manga corta estructurada.', 145.00, 289.00, '55551111-5555-4555-8555-555555555555', 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80', true, true),
('65552222-5555-4555-8555-555555555555', '15555555-5555-4555-8555-555555555555', 'MCA-VES-002', 'Vestido Nube Marfil', 'Vestido largo marfil para dias calidos y capas ligeras por la tarde.', 168.00, 320.00, '55551222-5555-4555-8555-555555555555', 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80', true, true),
('65553333-5555-4555-8555-555555555555', '15555555-5555-4555-8555-555555555555', 'MCA-SAS-003', 'Blazer Arena Atelier', 'Blazer relajado con hombro suave para oficina, eventos y capas de media estacion.', 190.00, 360.00, '55552111-5555-4555-8555-555555555555', 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80', true, true),
('65554444-5555-4555-8555-555555555555', '15555555-5555-4555-8555-555555555555', 'MCA-SAS-004', 'Pantalon Brisa Recto', 'Pantalon de tiro alto en tono hueso con corte recto y estructura ligera.', 120.00, 245.00, '55552222-5555-4555-8555-555555555555', 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80', true, true),
('65555555-5555-4555-8555-555555555555', '15555555-5555-4555-8555-555555555555', 'MCA-TEJ-005', 'Cardigan Vino Suave', 'Tejido liviano para noches frescas y capas de transicion.', 132.00, 258.00, '55553111-5555-4555-8555-555555555555', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80', true, true),
('65556666-5555-4555-8555-555555555555', '15555555-5555-4555-8555-555555555555', 'MCA-TEJ-006', 'Abrigo Latte Corto', 'Abrigo corto de tacto suave para capas urbanas y combinaciones neutras.', 210.00, 410.00, '55553222-5555-4555-8555-555555555555', 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80', true, true),
('65557777-5555-4555-8555-555555555555', '15555555-5555-4555-8555-555555555555', 'MCA-SET-007', 'Set Costa Clara', 'Conjunto de top y falda para brunch, escapadas y dias de sol tibio.', 175.00, 335.00, '55554111-5555-4555-8555-555555555555', 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=900&q=80', true, true),
('65558888-5555-4555-8555-555555555555', '15555555-5555-4555-8555-555555555555', 'MCA-SET-008', 'Set Aurora Otono', 'Camisa satinada y pantalon palazzo para una propuesta elegante de media estacion.', 186.00, 349.00, '55554222-5555-4555-8555-555555555555', 'https://images.unsplash.com/photo-1495385794356-15371f348c31?auto=format&fit=crop&w=900&q=80', true, true);

insert into public.inventory_stock (
  branch_id,
  product_id,
  quantity,
  min_stock_level,
  reserved_quantity
) values
('25555555-5555-4555-8555-555555555555', '65551111-5555-4555-8555-555555555555', 8, 2, 0),
('25555555-5555-4555-8555-555555555555', '65552222-5555-4555-8555-555555555555', 6, 2, 0),
('25555555-5555-4555-8555-555555555555', '65553333-5555-4555-8555-555555555555', 5, 1, 0),
('25555555-5555-4555-8555-555555555555', '65554444-5555-4555-8555-555555555555', 7, 2, 0),
('25555555-5555-4555-8555-555555555555', '65555555-5555-4555-8555-555555555555', 4, 1, 0),
('25555555-5555-4555-8555-555555555555', '65556666-5555-4555-8555-555555555555', 3, 1, 0),
('25555555-5555-4555-8555-555555555555', '65557777-5555-4555-8555-555555555555', 5, 1, 0),
('25555555-5555-4555-8555-555555555555', '65558888-5555-4555-8555-555555555555', 4, 1, 0);

commit;

select
  o.slug,
  o.name,
  count(distinct c.id) as category_count,
  count(distinct p.id) as product_count
from public.organizations o
left join public.categories c on c.organization_id = o.id
left join public.products p on p.organization_id = o.id
where o.id = '15555555-5555-4555-8555-555555555555'
group by o.slug, o.name;
