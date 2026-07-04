create or replace function public.apply_inventory_stock_mutation(
  p_branch_id uuid,
  p_product_id uuid,
  p_mode text,
  p_quantity integer,
  p_min_stock_level integer default null,
  p_require_available boolean default false
)
returns table (
  stock_id uuid,
  previous_quantity integer,
  new_quantity integer,
  reserved_quantity integer,
  min_stock_level integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock public.inventory_stock%rowtype;
  v_previous_quantity integer;
  v_reserved_quantity integer;
  v_next_quantity integer;
  v_min_stock_level integer;
begin
  if p_mode not in ('set', 'add', 'remove') then
    raise exception 'INVALID_STOCK_MODE';
  end if;

  if p_quantity <= 0 then
    raise exception 'INVALID_STOCK_QUANTITY';
  end if;

  if p_mode in ('set', 'add') then
    insert into public.inventory_stock (
      branch_id,
      product_id,
      quantity,
      min_stock_level,
      reserved_quantity
    )
    values (
      p_branch_id,
      p_product_id,
      0,
      coalesce(p_min_stock_level, 5),
      0
    )
    on conflict (branch_id, product_id) do nothing;
  end if;

  select *
  into v_stock
  from public.inventory_stock
  where branch_id = p_branch_id
    and product_id = p_product_id
  for update;

  if not found then
    raise exception 'INVENTORY_STOCK_NOT_FOUND';
  end if;

  v_previous_quantity := coalesce(v_stock.quantity, 0);
  v_reserved_quantity := coalesce(v_stock.reserved_quantity, 0);
  v_min_stock_level := coalesce(p_min_stock_level, v_stock.min_stock_level, 5);

  if p_mode = 'set' then
    v_next_quantity := p_quantity;
  elsif p_mode = 'add' then
    v_next_quantity := v_previous_quantity + p_quantity;
  else
    if p_require_available then
      if (v_previous_quantity - v_reserved_quantity) < p_quantity then
        raise exception 'INSUFFICIENT_AVAILABLE_STOCK';
      end if;
    elsif v_previous_quantity < p_quantity then
      raise exception 'INSUFFICIENT_STOCK';
    end if;

    v_next_quantity := v_previous_quantity - p_quantity;
  end if;

  if v_next_quantity < 0 then
    raise exception 'NEGATIVE_STOCK_NOT_ALLOWED';
  end if;

  update public.inventory_stock
  set
    quantity = v_next_quantity,
    min_stock_level = v_min_stock_level,
    updated_at = now()
  where id = v_stock.id;

  return query
  select
    v_stock.id,
    v_previous_quantity,
    v_next_quantity,
    v_reserved_quantity,
    v_min_stock_level;
end;
$$;
