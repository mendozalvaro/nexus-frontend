create table if not exists pos_number_sequences (
  organization_id uuid primary key references organizations(id) on delete cascade,
  sales_order_last bigint not null default 0,
  proforma_last bigint not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function next_sales_order_number(p_organization_id uuid)
returns bigint
language plpgsql
security definer
as $$
declare
  v_next bigint;
begin
  insert into pos_number_sequences (organization_id, sales_order_last, proforma_last)
  values (p_organization_id, 1, 0)
  on conflict (organization_id)
  do update set
    sales_order_last = pos_number_sequences.sales_order_last + 1,
    updated_at = now()
  returning sales_order_last into v_next;

  return v_next;
end;
$$;

create or replace function next_proforma_number(p_organization_id uuid)
returns bigint
language plpgsql
security definer
as $$
declare
  v_next bigint;
begin
  insert into pos_number_sequences (organization_id, sales_order_last, proforma_last)
  values (p_organization_id, 0, 1)
  on conflict (organization_id)
  do update set
    proforma_last = pos_number_sequences.proforma_last + 1,
    updated_at = now()
  returning proforma_last into v_next;

  return v_next;
end;
$$;

create table if not exists sales_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete restrict,
  sales_order_number bigint not null,
  created_by uuid not null references profiles(id) on delete restrict,
  customer_mode text not null check (customer_mode in ('existing', 'walk_in')),
  customer_id uuid null references clients(id) on delete set null,
  customer_full_name text not null,
  customer_phone text null,
  customer_email text null,
  discount_type text not null default 'none' check (discount_type in ('none', 'percentage', 'fixed')),
  discount_value numeric(12,2) not null default 0 check (discount_value >= 0),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  final_amount numeric(12,2) not null default 0 check (final_amount >= 0),
  note text null,
  status text not null default 'draft' check (status in ('draft', 'ready_to_charge', 'charged', 'cancelled')),
  charged_transaction_id uuid null references transactions(id) on delete set null,
  charged_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sales_order_number)
);

create table if not exists sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references sales_orders(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete restrict,
  item_type text not null check (item_type in ('product', 'service')),
  product_id uuid null references products(id) on delete set null,
  service_id uuid null references services(id) on delete set null,
  employee_id uuid null references profiles(id) on delete set null,
  scheduled_date text null,
  scheduled_time text null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  snapshot_data jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (item_type = 'product' and product_id is not null and service_id is null)
    or (item_type = 'service' and service_id is not null and product_id is null)
  )
);

create table if not exists sales_proformas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete restrict,
  sales_order_id uuid not null references sales_orders(id) on delete cascade,
  proforma_number bigint not null,
  status text not null default 'issued' check (status in ('issued', 'cancelled', 'consumed')),
  snapshot jsonb not null,
  issued_by uuid not null references profiles(id) on delete restrict,
  issued_at timestamptz not null default now(),
  consumed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, proforma_number)
);

create index if not exists idx_sales_orders_org_status on sales_orders(organization_id, status);
create index if not exists idx_sales_orders_branch_status on sales_orders(branch_id, status);
create index if not exists idx_sales_order_items_order on sales_order_items(sales_order_id);
create index if not exists idx_sales_proformas_org_status on sales_proformas(organization_id, status);

alter table sales_orders enable row level security;
alter table sales_order_items enable row level security;
alter table sales_proformas enable row level security;
alter table pos_number_sequences enable row level security;

create policy "Sales orders staff select" on sales_orders for select
using (
  organization_id = get_user_organization_id()
  and get_user_role() in ('admin', 'manager', 'employee')
);

create policy "Sales orders staff write" on sales_orders for all
using (
  organization_id = get_user_organization_id()
  and get_user_role() in ('admin', 'manager', 'employee')
)
with check (
  organization_id = get_user_organization_id()
  and get_user_role() in ('admin', 'manager', 'employee')
);

create policy "Sales order items staff select" on sales_order_items for select
using (
  organization_id = get_user_organization_id()
  and get_user_role() in ('admin', 'manager', 'employee')
);

create policy "Sales order items staff write" on sales_order_items for all
using (
  organization_id = get_user_organization_id()
  and get_user_role() in ('admin', 'manager', 'employee')
)
with check (
  organization_id = get_user_organization_id()
  and get_user_role() in ('admin', 'manager', 'employee')
);

create policy "Sales proformas staff select" on sales_proformas for select
using (
  organization_id = get_user_organization_id()
  and get_user_role() in ('admin', 'manager', 'employee')
);

create policy "Sales proformas staff write" on sales_proformas for all
using (
  organization_id = get_user_organization_id()
  and get_user_role() in ('admin', 'manager', 'employee')
)
with check (
  organization_id = get_user_organization_id()
  and get_user_role() in ('admin', 'manager', 'employee')
);

create policy "POS sequence staff select" on pos_number_sequences for select
using (
  organization_id = get_user_organization_id()
  and get_user_role() in ('admin', 'manager', 'employee')
);
