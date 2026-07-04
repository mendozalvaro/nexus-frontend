-- Migration: Align subscription_plans catalog content for landing/onboarding
-- Date: 2026-04-18

update public.subscription_plans
set
  name = 'Emprende',
  business_only = true,
  description = 'Negocio de servicios o productos en etapa inicial.',
  resume = 'Base para iniciar y operar',
  features = '["3 usuarios (1 admin, 1 manager, 1 empleado)","1 sucursal","Negocio de servicios o productos","100 ventas mensuales por sucursal","Pedidos o reservas segun eleccion","Reportes basicos y alertas","Tienda virtual"]'::jsonb,
  limits = '{"users":3,"branches":1,"monthly_sales_per_branch":100,"roles":{"admin":1,"manager":1,"employee":1}}'::jsonb,
  available_billing_modes = jsonb_build_object(
    'monthly', jsonb_build_object('label', 'monthly', 'enabled', true, 'discount_percent', 10),
    'quarterly', jsonb_build_object('label', 'quarterly', 'enabled', true, 'discount_percent', 15),
    'annual', jsonb_build_object('label', 'annual', 'enabled', true, 'discount_percent', 20)
  ),
  max_users = 3,
  max_branches = 1
where slug = 'emprende';

update public.subscription_plans
set
  name = 'Crecimiento',
  business_only = false,
  description = 'Para equipos con mas personal y mas sucursales.',
  resume = 'Escala operacion multi-linea y multi-sucursal',
  features = '["12 usuarios (1 admin, 4 manager, 7 empleados)","4 sucursales","Negocio hibrido","300 ventas por sucursal","Pedidos y reservas","Reportes especializados y alertas","Tienda virtual"]'::jsonb,
  limits = '{"users":12,"branches":4,"monthly_sales_per_branch":300,"roles":{"admin":1,"manager":4,"employee":7}}'::jsonb,
  available_billing_modes = jsonb_build_object(
    'monthly', jsonb_build_object('label', 'monthly', 'enabled', true, 'discount_percent', 10),
    'quarterly', jsonb_build_object('label', 'quarterly', 'enabled', true, 'discount_percent', 15),
    'annual', jsonb_build_object('label', 'annual', 'enabled', true, 'discount_percent', 20)
  ),
  max_users = 12,
  max_branches = 4
where slug = 'crecimiento';

update public.subscription_plans
set
  name = 'Empresarial',
  business_only = false,
  description = 'Para operaciones grandes con personalizacion y escalabilidad.',
  resume = 'Control avanzado para operacion empresarial',
  features = '["Usuarios ilimitados (1 admin)","20 sucursales","Negocio hibrido","1000 ventas por sucursal","Pedidos y reservas","Reportes especializados y alertas","Tienda virtual personalizada"]'::jsonb,
  limits = '{"users":999999,"branches":20,"monthly_sales_per_branch":1000,"users_unlimited":true,"roles":{"admin":1}}'::jsonb,
  available_billing_modes = jsonb_build_object(
    'monthly', jsonb_build_object('label', 'monthly', 'enabled', true, 'discount_percent', 10),
    'quarterly', jsonb_build_object('label', 'quarterly', 'enabled', true, 'discount_percent', 15),
    'annual', jsonb_build_object('label', 'annual', 'enabled', true, 'discount_percent', 20)
  ),
  max_users = 999999,
  max_branches = 20
where slug = 'enterprise';
