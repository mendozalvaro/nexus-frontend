create table if not exists public.organization_storefront_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  business_type public.business_type_enum not null default 'product',
  template_key text not null,
  color_preset_key text not null default 'neutral',
  primary_color text not null default '#111827',
  secondary_color text not null default '#F3F4F6',
  accent_color text not null default '#2563EB',
  company_description text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_storefront_settings_primary_color_check check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint organization_storefront_settings_secondary_color_check check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint organization_storefront_settings_accent_color_check check (accent_color ~ '^#[0-9A-Fa-f]{6}$')
);

create table if not exists public.organization_storefront_entitlements (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  can_view boolean not null default false,
  can_manage boolean not null default false,
  can_publish boolean not null default false,
  can_custom_colors boolean not null default false,
  max_sites integer not null default 0 check (max_sites >= 0),
  template_keys text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_organization_storefront_settings_published
  on public.organization_storefront_settings (is_published);

create trigger organization_storefront_settings_set_updated_at
before update on public.organization_storefront_settings
for each row execute function public.update_updated_at_column();

create trigger organization_storefront_entitlements_set_updated_at
before update on public.organization_storefront_entitlements
for each row execute function public.update_updated_at_column();

alter table public.organization_storefront_settings enable row level security;
alter table public.organization_storefront_entitlements enable row level security;

update public.subscription_plans
set
  permissions = coalesce(permissions, '{}'::jsonb)
    || jsonb_build_object(
      'storefront.view', false,
      'storefront.manage', false,
      'storefront.publish', false,
      'storefront.custom_colors', false
    ),
  limits = coalesce(limits, '{}'::jsonb)
    || jsonb_build_object('storefront.max_sites', 0)
where slug = 'emprende';

update public.subscription_plans
set
  permissions = coalesce(permissions, '{}'::jsonb)
    || jsonb_build_object(
      'storefront.view', true,
      'storefront.manage', true,
      'storefront.publish', true,
      'storefront.custom_colors', false
    ),
  limits = coalesce(limits, '{}'::jsonb)
    || jsonb_build_object('storefront.max_sites', 1)
where slug = 'crecimiento';

update public.subscription_plans
set
  permissions = coalesce(permissions, '{}'::jsonb)
    || jsonb_build_object(
      'storefront.view', false,
      'storefront.manage', false,
      'storefront.publish', false,
      'storefront.custom_colors', false
    ),
  limits = coalesce(limits, '{}'::jsonb)
    || jsonb_build_object('storefront.max_sites', 0)
where slug = 'enterprise';
