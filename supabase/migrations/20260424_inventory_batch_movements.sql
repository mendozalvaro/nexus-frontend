create table if not exists public.inventory_adjust_batches (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  mode text not null check (mode in ('set', 'add', 'remove')),
  reason text not null,
  note text,
  total_lines integer not null check (total_lines > 0),
  processed_count integer not null default 0 check (processed_count >= 0),
  processed_by uuid references public.profiles(id) on delete set null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create index if not exists idx_inventory_adjust_batches_org_created_at
  on public.inventory_adjust_batches(organization_id, created_at desc);

create table if not exists public.inventory_transfer_batches (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_branch_id uuid not null references public.branches(id) on delete cascade,
  destination_branch_id uuid not null references public.branches(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'received', 'cancelled')),
  observations text,
  internal_note text,
  total_lines integer not null check (total_lines > 0),
  total_quantity integer not null check (total_quantity > 0),
  requested_by uuid references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  received_by uuid references public.profiles(id) on delete set null,
  received_at timestamptz,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_transfer_batches_distinct_branches check (source_branch_id <> destination_branch_id),
  unique (organization_id, idempotency_key)
);

create index if not exists idx_inventory_transfer_batches_org_status
  on public.inventory_transfer_batches(organization_id, status, requested_at desc);

create table if not exists public.inventory_transfer_batch_lines (
  id uuid primary key default uuid_generate_v4(),
  batch_id uuid not null references public.inventory_transfer_batches(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  status text not null default 'pending' check (status in ('pending', 'received', 'cancelled')),
  source_previous_quantity integer,
  source_new_quantity integer,
  destination_previous_quantity integer,
  destination_new_quantity integer,
  received_by uuid references public.profiles(id) on delete set null,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, product_id)
);

create index if not exists idx_inventory_transfer_batch_lines_batch
  on public.inventory_transfer_batch_lines(batch_id, status);

alter table public.inventory_adjust_batches enable row level security;
alter table public.inventory_transfer_batches enable row level security;
alter table public.inventory_transfer_batch_lines enable row level security;

drop policy if exists "Inventory adjust batches select" on public.inventory_adjust_batches;
create policy "Inventory adjust batches select" on public.inventory_adjust_batches
for select using (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);

drop policy if exists "Inventory transfer batches select" on public.inventory_transfer_batches;
create policy "Inventory transfer batches select" on public.inventory_transfer_batches
for select using (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);

drop policy if exists "Inventory transfer batch lines select" on public.inventory_transfer_batch_lines;
create policy "Inventory transfer batch lines select" on public.inventory_transfer_batch_lines
for select using (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);

create or replace function public.inventory_adjust_batch_precheck(
  p_organization_id uuid,
  p_branch_id uuid,
  p_mode text,
  p_lines jsonb
)
returns table (
  line_index integer,
  product_id uuid,
  quantity integer,
  is_valid boolean,
  error_code text,
  error_message text,
  current_quantity integer,
  next_quantity integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line record;
  v_stock public.inventory_stock%rowtype;
  v_product_exists boolean;
  v_current integer;
  v_next integer;
  v_reserved integer;
begin
  if p_mode not in ('set', 'add', 'remove') then
    raise exception 'INVALID_STOCK_MODE';
  end if;

  if jsonb_typeof(p_lines) <> 'array' then
    raise exception 'INVALID_BATCH_LINES';
  end if;

  if jsonb_array_length(p_lines) < 1 or jsonb_array_length(p_lines) > 50 then
    raise exception 'INVALID_BATCH_LINES';
  end if;

  for v_line in
    select ordinality as idx,
           (value->>'product_id')::uuid as product_id,
           coalesce((value->>'quantity')::integer, 0) as quantity
    from jsonb_array_elements(p_lines) with ordinality
  loop
    line_index := v_line.idx;
    product_id := v_line.product_id;
    quantity := v_line.quantity;
    is_valid := true;
    error_code := null;
    error_message := null;
    current_quantity := null;
    next_quantity := null;

    if v_line.product_id is null or v_line.quantity <= 0 then
      is_valid := false;
      error_code := 'INVALID_LINE';
      error_message := 'La linea no contiene un producto/cantidad valida.';
      return next;
      continue;
    end if;

    select exists(
      select 1
      from public.products p
      where p.id = v_line.product_id
        and p.organization_id = p_organization_id
    ) into v_product_exists;

    if not v_product_exists then
      is_valid := false;
      error_code := 'PRODUCT_NOT_FOUND';
      error_message := 'El producto no existe en la organizacion.';
      return next;
      continue;
    end if;

    select * into v_stock
    from public.inventory_stock s
    where s.branch_id = p_branch_id
      and s.product_id = v_line.product_id;

    v_current := coalesce(v_stock.quantity, 0);
    v_reserved := coalesce(v_stock.reserved_quantity, 0);

    if p_mode = 'set' then
      v_next := v_line.quantity;
    elsif p_mode = 'add' then
      v_next := v_current + v_line.quantity;
    else
      if (v_current - v_reserved) < v_line.quantity then
        is_valid := false;
        error_code := 'INSUFFICIENT_AVAILABLE_STOCK';
        error_message := 'No hay stock disponible suficiente para la salida.';
        current_quantity := v_current;
        next_quantity := null;
        return next;
        continue;
      end if;
      v_next := v_current - v_line.quantity;
    end if;

    if v_next < 0 then
      is_valid := false;
      error_code := 'NEGATIVE_STOCK_NOT_ALLOWED';
      error_message := 'La operacion deja stock negativo.';
      current_quantity := v_current;
      next_quantity := null;
      return next;
      continue;
    end if;

    current_quantity := v_current;
    next_quantity := v_next;
    return next;
  end loop;
end;
$$;

create or replace function public.inventory_adjust_batch_execute(
  p_organization_id uuid,
  p_user_id uuid,
  p_idempotency_key text,
  p_branch_id uuid,
  p_mode text,
  p_reason text,
  p_note text,
  p_lines jsonb
)
returns table (
  batch_id uuid,
  processed_count integer,
  idempotent boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.inventory_adjust_batches%rowtype;
  v_batch_id uuid;
  v_processed integer := 0;
  v_line record;
  v_stock public.inventory_stock%rowtype;
  v_current integer;
  v_next integer;
  v_reserved integer;
  v_min_stock integer;
  v_movement_type text;
  v_product_exists boolean;
begin
  if p_mode not in ('set', 'add', 'remove') then
    raise exception 'INVALID_STOCK_MODE';
  end if;

  if coalesce(length(trim(p_idempotency_key)), 0) = 0 then
    raise exception 'MISSING_IDEMPOTENCY_KEY';
  end if;

  if jsonb_typeof(p_lines) <> 'array' then
    raise exception 'INVALID_BATCH_LINES';
  end if;

  if jsonb_array_length(p_lines) < 1 or jsonb_array_length(p_lines) > 50 then
    raise exception 'INVALID_BATCH_LINES';
  end if;

  select * into v_existing
  from public.inventory_adjust_batches
  where organization_id = p_organization_id
    and idempotency_key = p_idempotency_key;

  if found then
    batch_id := v_existing.id;
    processed_count := v_existing.processed_count;
    idempotent := true;
    return next;
    return;
  end if;

  insert into public.inventory_adjust_batches (
    organization_id,
    branch_id,
    mode,
    reason,
    note,
    total_lines,
    processed_count,
    processed_by,
    idempotency_key
  ) values (
    p_organization_id,
    p_branch_id,
    p_mode,
    trim(p_reason),
    nullif(trim(coalesce(p_note, '')), ''),
    jsonb_array_length(p_lines),
    0,
    p_user_id,
    trim(p_idempotency_key)
  ) returning id into v_batch_id;

  if p_mode = 'set' then
    v_movement_type := 'adjustment';
  elsif p_mode = 'add' then
    v_movement_type := 'entry';
  else
    v_movement_type := 'exit';
  end if;

  for v_line in
    select (value->>'product_id')::uuid as product_id,
           (value->>'quantity')::integer as quantity,
           (value->>'min_stock_level')::integer as min_stock_level
    from jsonb_array_elements(p_lines)
  loop
    if v_line.product_id is null or coalesce(v_line.quantity, 0) <= 0 then
      raise exception 'INVALID_LINE';
    end if;

    select exists(
      select 1
      from public.products p
      where p.id = v_line.product_id
        and p.organization_id = p_organization_id
    ) into v_product_exists;

    if not v_product_exists then
      raise exception 'PRODUCT_NOT_FOUND';
    end if;

    if p_mode in ('set', 'add') then
      insert into public.inventory_stock (
        branch_id,
        product_id,
        quantity,
        min_stock_level,
        reserved_quantity
      ) values (
        p_branch_id,
        v_line.product_id,
        0,
        coalesce(v_line.min_stock_level, 5),
        0
      )
      on conflict (branch_id, product_id) do nothing;
    end if;

    select * into v_stock
    from public.inventory_stock s
    where s.branch_id = p_branch_id
      and s.product_id = v_line.product_id
    for update;

    if not found then
      raise exception 'INVENTORY_STOCK_NOT_FOUND';
    end if;

    v_current := coalesce(v_stock.quantity, 0);
    v_reserved := coalesce(v_stock.reserved_quantity, 0);

    if p_mode = 'set' then
      v_next := v_line.quantity;
    elsif p_mode = 'add' then
      v_next := v_current + v_line.quantity;
    else
      if (v_current - v_reserved) < v_line.quantity then
        raise exception 'INSUFFICIENT_AVAILABLE_STOCK';
      end if;
      v_next := v_current - v_line.quantity;
    end if;

    if v_next < 0 then
      raise exception 'NEGATIVE_STOCK_NOT_ALLOWED';
    end if;

    v_min_stock := coalesce(v_line.min_stock_level, v_stock.min_stock_level, 5);

    update public.inventory_stock
    set quantity = v_next,
        min_stock_level = v_min_stock,
        updated_at = now()
    where id = v_stock.id;

    insert into public.inventory_movements (
      organization_id,
      branch_id,
      product_id,
      movement_type,
      quantity,
      previous_quantity,
      new_quantity,
      reason,
      note,
      reference_type,
      reference_id,
      source_branch_id,
      destination_branch_id,
      created_by
    ) values (
      p_organization_id,
      p_branch_id,
      v_line.product_id,
      v_movement_type,
      v_line.quantity,
      v_current,
      v_next,
      trim(p_reason),
      nullif(trim(coalesce(p_note, '')), ''),
      'manual_adjustment_batch',
      v_batch_id,
      case when p_mode = 'remove' then p_branch_id else null end,
      case when p_mode = 'add' then p_branch_id else null end,
      p_user_id
    );

    v_processed := v_processed + 1;
  end loop;

  update public.inventory_adjust_batches
  set processed_count = v_processed,
      updated_at = now()
  where id = v_batch_id;

  batch_id := v_batch_id;
  processed_count := v_processed;
  idempotent := false;
  return next;
end;
$$;

create or replace function public.inventory_transfer_batch_precheck(
  p_organization_id uuid,
  p_source_branch_id uuid,
  p_destination_branch_id uuid,
  p_lines jsonb
)
returns table (
  line_index integer,
  product_id uuid,
  quantity integer,
  is_valid boolean,
  error_code text,
  error_message text,
  current_quantity integer,
  next_quantity integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line record;
  v_stock public.inventory_stock%rowtype;
  v_product_exists boolean;
  v_current integer;
  v_reserved integer;
  v_next integer;
begin
  if p_source_branch_id = p_destination_branch_id then
    raise exception 'INVALID_TRANSFER_BRANCHES';
  end if;

  if jsonb_typeof(p_lines) <> 'array' then
    raise exception 'INVALID_BATCH_LINES';
  end if;

  if jsonb_array_length(p_lines) < 1 or jsonb_array_length(p_lines) > 50 then
    raise exception 'INVALID_BATCH_LINES';
  end if;

  for v_line in
    select ordinality as idx,
           (value->>'product_id')::uuid as product_id,
           coalesce((value->>'quantity')::integer, 0) as quantity
    from jsonb_array_elements(p_lines) with ordinality
  loop
    line_index := v_line.idx;
    product_id := v_line.product_id;
    quantity := v_line.quantity;
    is_valid := true;
    error_code := null;
    error_message := null;
    current_quantity := null;
    next_quantity := null;

    if v_line.product_id is null or v_line.quantity <= 0 then
      is_valid := false;
      error_code := 'INVALID_LINE';
      error_message := 'La linea no contiene un producto/cantidad valida.';
      return next;
      continue;
    end if;

    select exists(
      select 1
      from public.products p
      where p.id = v_line.product_id
        and p.organization_id = p_organization_id
    ) into v_product_exists;

    if not v_product_exists then
      is_valid := false;
      error_code := 'PRODUCT_NOT_FOUND';
      error_message := 'El producto no existe en la organizacion.';
      return next;
      continue;
    end if;

    select * into v_stock
    from public.inventory_stock s
    where s.branch_id = p_source_branch_id
      and s.product_id = v_line.product_id;

    if not found then
      is_valid := false;
      error_code := 'INVENTORY_STOCK_NOT_FOUND';
      error_message := 'No existe stock en la sucursal origen para este producto.';
      return next;
      continue;
    end if;

    v_current := coalesce(v_stock.quantity, 0);
    v_reserved := coalesce(v_stock.reserved_quantity, 0);

    if (v_current - v_reserved) < v_line.quantity then
      is_valid := false;
      error_code := 'INSUFFICIENT_AVAILABLE_STOCK';
      error_message := 'No hay stock disponible suficiente en origen.';
      current_quantity := v_current;
      next_quantity := null;
      return next;
      continue;
    end if;

    v_next := v_current - v_line.quantity;
    current_quantity := v_current;
    next_quantity := v_next;
    return next;
  end loop;
end;
$$;

create or replace function public.inventory_transfer_batch_create(
  p_organization_id uuid,
  p_user_id uuid,
  p_idempotency_key text,
  p_source_branch_id uuid,
  p_destination_branch_id uuid,
  p_observations text,
  p_internal_note text,
  p_lines jsonb
)
returns table (
  batch_id uuid,
  processed_count integer,
  idempotent boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.inventory_transfer_batches%rowtype;
  v_batch_id uuid;
  v_processed integer := 0;
  v_total_quantity integer := 0;
  v_line record;
  v_stock public.inventory_stock%rowtype;
  v_current integer;
  v_next integer;
  v_reserved integer;
  v_product_exists boolean;
begin
  if p_source_branch_id = p_destination_branch_id then
    raise exception 'INVALID_TRANSFER_BRANCHES';
  end if;

  if coalesce(length(trim(p_idempotency_key)), 0) = 0 then
    raise exception 'MISSING_IDEMPOTENCY_KEY';
  end if;

  if jsonb_typeof(p_lines) <> 'array' then
    raise exception 'INVALID_BATCH_LINES';
  end if;

  if jsonb_array_length(p_lines) < 1 or jsonb_array_length(p_lines) > 50 then
    raise exception 'INVALID_BATCH_LINES';
  end if;

  select * into v_existing
  from public.inventory_transfer_batches
  where organization_id = p_organization_id
    and idempotency_key = p_idempotency_key;

  if found then
    batch_id := v_existing.id;
    processed_count := v_existing.total_lines;
    idempotent := true;
    return next;
    return;
  end if;

  insert into public.inventory_transfer_batches (
    organization_id,
    source_branch_id,
    destination_branch_id,
    status,
    observations,
    internal_note,
    total_lines,
    total_quantity,
    requested_by,
    requested_at,
    idempotency_key
  ) values (
    p_organization_id,
    p_source_branch_id,
    p_destination_branch_id,
    'pending',
    trim(p_observations),
    nullif(trim(coalesce(p_internal_note, '')), ''),
    jsonb_array_length(p_lines),
    0,
    p_user_id,
    now(),
    trim(p_idempotency_key)
  ) returning id into v_batch_id;

  for v_line in
    select (value->>'product_id')::uuid as product_id,
           (value->>'quantity')::integer as quantity
    from jsonb_array_elements(p_lines)
  loop
    if v_line.product_id is null or coalesce(v_line.quantity, 0) <= 0 then
      raise exception 'INVALID_LINE';
    end if;

    select exists(
      select 1
      from public.products p
      where p.id = v_line.product_id
        and p.organization_id = p_organization_id
    ) into v_product_exists;

    if not v_product_exists then
      raise exception 'PRODUCT_NOT_FOUND';
    end if;

    select * into v_stock
    from public.inventory_stock s
    where s.branch_id = p_source_branch_id
      and s.product_id = v_line.product_id
    for update;

    if not found then
      raise exception 'INVENTORY_STOCK_NOT_FOUND';
    end if;

    v_current := coalesce(v_stock.quantity, 0);
    v_reserved := coalesce(v_stock.reserved_quantity, 0);

    if (v_current - v_reserved) < v_line.quantity then
      raise exception 'INSUFFICIENT_AVAILABLE_STOCK';
    end if;

    v_next := v_current - v_line.quantity;

    update public.inventory_stock
    set quantity = v_next,
        updated_at = now()
    where id = v_stock.id;

    insert into public.inventory_transfer_batch_lines (
      batch_id,
      organization_id,
      product_id,
      quantity,
      status,
      source_previous_quantity,
      source_new_quantity
    ) values (
      v_batch_id,
      p_organization_id,
      v_line.product_id,
      v_line.quantity,
      'pending',
      v_current,
      v_next
    );

    insert into public.inventory_movements (
      organization_id,
      branch_id,
      product_id,
      movement_type,
      quantity,
      previous_quantity,
      new_quantity,
      reason,
      note,
      reference_type,
      reference_id,
      source_branch_id,
      destination_branch_id,
      created_by
    ) values (
      p_organization_id,
      p_source_branch_id,
      v_line.product_id,
      'transfer_out',
      v_line.quantity,
      v_current,
      v_next,
      trim(p_observations),
      nullif(trim(coalesce(p_internal_note, '')), ''),
      'branch_transfer_batch',
      v_batch_id,
      p_source_branch_id,
      p_destination_branch_id,
      p_user_id
    );

    v_processed := v_processed + 1;
    v_total_quantity := v_total_quantity + v_line.quantity;
  end loop;

  update public.inventory_transfer_batches
  set total_quantity = v_total_quantity,
      updated_at = now()
  where id = v_batch_id;

  batch_id := v_batch_id;
  processed_count := v_processed;
  idempotent := false;
  return next;
end;
$$;

create or replace function public.inventory_transfer_batch_receive(
  p_organization_id uuid,
  p_user_id uuid,
  p_batch_id uuid
)
returns table (
  batch_id uuid,
  processed_count integer,
  idempotent boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.inventory_transfer_batches%rowtype;
  v_line public.inventory_transfer_batch_lines%rowtype;
  v_stock public.inventory_stock%rowtype;
  v_current integer;
  v_next integer;
  v_processed integer := 0;
begin
  select * into v_batch
  from public.inventory_transfer_batches
  where id = p_batch_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'TRANSFER_BATCH_NOT_FOUND';
  end if;

  if v_batch.status = 'received' then
    batch_id := v_batch.id;
    processed_count := v_batch.total_lines;
    idempotent := true;
    return next;
    return;
  end if;

  if v_batch.status <> 'pending' then
    raise exception 'INVALID_TRANSFER_BATCH_STATUS';
  end if;

  for v_line in
    select *
    from public.inventory_transfer_batch_lines
    where batch_id = v_batch.id
      and status = 'pending'
    for update
  loop
    insert into public.inventory_stock (
      branch_id,
      product_id,
      quantity,
      min_stock_level,
      reserved_quantity
    ) values (
      v_batch.destination_branch_id,
      v_line.product_id,
      0,
      5,
      0
    )
    on conflict (branch_id, product_id) do nothing;

    select * into v_stock
    from public.inventory_stock s
    where s.branch_id = v_batch.destination_branch_id
      and s.product_id = v_line.product_id
    for update;

    v_current := coalesce(v_stock.quantity, 0);
    v_next := v_current + v_line.quantity;

    update public.inventory_stock
    set quantity = v_next,
        updated_at = now()
    where id = v_stock.id;

    update public.inventory_transfer_batch_lines
    set status = 'received',
        destination_previous_quantity = v_current,
        destination_new_quantity = v_next,
        received_by = p_user_id,
        received_at = now(),
        updated_at = now()
    where id = v_line.id;

    insert into public.inventory_movements (
      organization_id,
      branch_id,
      product_id,
      movement_type,
      quantity,
      previous_quantity,
      new_quantity,
      reason,
      note,
      reference_type,
      reference_id,
      source_branch_id,
      destination_branch_id,
      created_by
    ) values (
      p_organization_id,
      v_batch.destination_branch_id,
      v_line.product_id,
      'transfer_in',
      v_line.quantity,
      v_current,
      v_next,
      v_batch.observations,
      v_batch.internal_note,
      'branch_transfer_batch_reception',
      v_batch.id,
      v_batch.source_branch_id,
      v_batch.destination_branch_id,
      p_user_id
    );

    v_processed := v_processed + 1;
  end loop;

  update public.inventory_transfer_batches
  set status = 'received',
      received_by = p_user_id,
      received_at = now(),
      updated_at = now()
  where id = v_batch.id;

  batch_id := v_batch.id;
  processed_count := v_processed;
  idempotent := false;
  return next;
end;
$$;
