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
    select line.*
    from public.inventory_transfer_batch_lines as line
    where line.batch_id = v_batch.id
      and line.status = 'pending'
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
