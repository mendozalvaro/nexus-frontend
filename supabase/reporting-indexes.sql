create index if not exists idx_transactions_org_created_at
  on public.transactions (organization_id, created_at desc);

create index if not exists idx_transactions_org_branch_created_at
  on public.transactions (organization_id, branch_id, created_at desc);

create index if not exists idx_transactions_org_employee_created_at
  on public.transactions (organization_id, employee_id, created_at desc);

create index if not exists idx_appointments_org_start_time
  on public.appointments (organization_id, start_time desc);

create index if not exists idx_appointments_org_branch_start_time
  on public.appointments (organization_id, branch_id, start_time desc);

create index if not exists idx_appointments_org_employee_start_time
  on public.appointments (organization_id, employee_id, start_time desc);

create index if not exists idx_transaction_items_transaction_type
  on public.transaction_items (transaction_id, item_type);

create index if not exists idx_transaction_items_product_id
  on public.transaction_items (product_id)
  where product_id is not null;

create index if not exists idx_transaction_items_service_id
  on public.transaction_items (service_id)
  where service_id is not null;

create index if not exists idx_inventory_movements_org_created_at
  on public.inventory_movements (organization_id, created_at desc);

create index if not exists idx_inventory_stock_branch_product
  on public.inventory_stock (branch_id, product_id);
