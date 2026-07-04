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

  select coalesce(sum((value->>'quantity')::integer), 0)
  into v_total_quantity
  from jsonb_array_elements(p_lines);

  if v_total_quantity <= 0 then
    raise exception 'INVALID_BATCH_LINES';
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
    v_total_quantity,
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
  end loop;

  update public.inventory_transfer_batches
  set updated_at = now()
  where id = v_batch_id;

  batch_id := v_batch_id;
  processed_count := v_processed;
  idempotent := false;
  return next;
end;
$$;
