alter table public.inventory_movements
  add column if not exists reference_code text;

create or replace function public.inventory_adjust_batch_execute(
  p_organization_id uuid,
  p_user_id uuid,
  p_idempotency_key text,
  p_branch_id uuid,
  p_mode text,
  p_reason text,
  p_reference_code text,
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
      reference_code,
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
      nullif(trim(coalesce(p_reference_code, '')), ''),
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
