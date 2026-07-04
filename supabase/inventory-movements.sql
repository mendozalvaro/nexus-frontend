create table if not exists public.inventory_movements (
    id uuid default extensions.uuid_generate_v4() primary key,
    organization_id uuid references public.organizations(id) on delete cascade not null,
    branch_id uuid references public.branches(id) on delete cascade not null,
    product_id uuid references public.products(id) on delete cascade not null,
    movement_type text not null check (movement_type in ('entry', 'exit', 'adjustment', 'transfer_in', 'transfer_out')),
    quantity int not null check (quantity > 0),
    previous_quantity int not null check (previous_quantity >= 0),
    new_quantity int not null check (new_quantity >= 0),
    reason text,
    reference_code text,
    note text,
    reference_type text,
    reference_id uuid,
    source_branch_id uuid references public.branches(id) on delete set null,
    destination_branch_id uuid references public.branches(id) on delete set null,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz default now()
);

alter table public.inventory_movements enable row level security;

drop policy if exists "Inventory movements select" on public.inventory_movements;
create policy "Inventory movements select" on public.inventory_movements for select
using (
    organization_id = public.get_user_organization_id()
    and (
        public.get_user_role() = 'admin'
        or branch_id = public.get_user_branch_id()
        or public.is_user_assigned_to_branch(branch_id)
        or (source_branch_id is not null and public.is_user_assigned_to_branch(source_branch_id))
        or (destination_branch_id is not null and public.is_user_assigned_to_branch(destination_branch_id))
    )
);

create index if not exists idx_inventory_movements_branch_time on public.inventory_movements(branch_id, created_at desc);
create index if not exists idx_inventory_movements_product_time on public.inventory_movements(product_id, created_at desc);
create index if not exists idx_inventory_movements_org_time on public.inventory_movements(organization_id, created_at desc);
