alter table public.inventory_transfer_batches
  add column if not exists reference_code text;

alter table public.inventory_transfers
  add column if not exists reference_code text;

update public.inventory_transfer_batches
set reference_code = nullif(trim(internal_note), '')
where coalesce(trim(reference_code), '') = ''
  and coalesce(trim(internal_note), '') <> '';

update public.inventory_transfers
set reference_code = nullif(trim(internal_note), '')
where coalesce(trim(reference_code), '') = ''
  and coalesce(trim(internal_note), '') <> '';

drop function if exists public.inventory_transfer_batch_create(uuid, uuid, text, uuid, uuid, text, text, jsonb);

create or replace function public.inventory_transfer_batch_create(
  p_organization_id uuid,
  p_user_id uuid,
  p_idempotency_key text,
  p_source_branch_id uuid,
  p_destination_branch_id uuid,
  p_observations text,
  p_reference_code text,
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
  v_reference_code text;
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

  v_reference_code := nullif(trim(coalesce(p_reference_code, '')), '');

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
    reference_code,
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
    v_reference_code,
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
      reference_code,
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
      v_reference_code,
      v_reference_code,
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
      reference_code,
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
      v_batch.reference_code,
      v_batch.reference_code,
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

alter table public.inventory_transfer_batches
  drop column if exists internal_note;

alter table public.inventory_transfers
  drop column if exists internal_note;
