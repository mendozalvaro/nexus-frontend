


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."appointment_source" AS ENUM (
    'manual',
    'pos_checkout',
    'client_booking'
);


ALTER TYPE "public"."appointment_source" OWNER TO "postgres";


CREATE TYPE "public"."appointment_status" AS ENUM (
    'pending',
    'confirmed',
    'in_progress',
    'completed',
    'cancelled',
    'no_show'
);


ALTER TYPE "public"."appointment_status" OWNER TO "postgres";


CREATE TYPE "public"."audit_action" AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'LOGIN_FAILED',
    'PERMISSION_DENIED'
);


ALTER TYPE "public"."audit_action" OWNER TO "postgres";


CREATE TYPE "public"."business_type_enum" AS ENUM (
    'product',
    'service',
    'lodging'
);


ALTER TYPE "public"."business_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."payment_method" AS ENUM (
    'cash',
    'card',
    'transfer',
    'mixed',
    'digital_wallet'
);


ALTER TYPE "public"."payment_method" OWNER TO "postgres";


CREATE TYPE "public"."reservation_status" AS ENUM (
    'pending',
    'confirmed',
    'checked_in',
    'checked_out',
    'cancelled',
    'no_show',
    'pending_payment'
);


ALTER TYPE "public"."reservation_status" OWNER TO "postgres";


CREATE TYPE "public"."room_status" AS ENUM (
    'available',
    'occupied',
    'maintenance',
    'cleaning'
);


ALTER TYPE "public"."room_status" OWNER TO "postgres";


CREATE TYPE "public"."sub_status" AS ENUM (
    'active',
    'past_due',
    'canceled',
    'trial',
    'over_limit'
);


ALTER TYPE "public"."sub_status" OWNER TO "postgres";


CREATE TYPE "public"."transaction_type" AS ENUM (
    'sale',
    'refund',
    'adjustment',
    'void'
);


ALTER TYPE "public"."transaction_type" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'manager',
    'employee',
    'client'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_payment_validation_detail"("p_validation_id" "uuid") RETURNS TABLE("id" "uuid", "organization_id" "uuid", "organization_name" "text", "organization_slug" "text", "organization_status" "text", "organization_address" "text", "billing_data" "jsonb", "user_id" "uuid", "user_full_name" "text", "user_email" "text", "amount" numeric, "payment_method" "text", "transaction_ref" "text", "status" "text", "created_at" timestamp with time zone, "reviewed_at" timestamp with time zone, "rejection_reason" "text", "reviewed_by_name" "text", "receipt_filename" "text", "receipt_mime_type" "text", "receipt_storage_path" "text", "subscription_status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_system_user(auth.uid()) then
    raise exception 'SYSTEM_ACCESS_REQUIRED'
      using errcode = '42501';
  end if;

  return query
  select
    pv.id,
    pv.organization_id,
    org.name as organization_name,
    org.slug as organization_slug,
    org.status as organization_status,
    org.address as organization_address,
    coalesce(org.billing_data, '{}'::jsonb) as billing_data,
    pv.user_id,
    submitter.full_name as user_full_name,
    submitter.email as user_email,
    pv.amount,
    pv.payment_method,
    pv.transaction_ref,
    pv.status,
    pv.created_at,
    pv.reviewed_at,
    pv.rejection_reason,
    reviewer.full_name as reviewed_by_name,
    pv.receipt_filename,
    pv.receipt_mime_type,
    pv.receipt_storage_path,
    subscription.status::text as subscription_status
  from public.payment_validations pv
  inner join public.organizations org on org.id = pv.organization_id
  inner join public.profiles submitter on submitter.id = pv.user_id
  left join public.organization_subscriptions subscription on subscription.organization_id = pv.organization_id
  left join public.system_users reviewer on reviewer.user_id = pv.reviewed_by_system_user
  where pv.id = p_validation_id
  limit 1;
end;
$$;


ALTER FUNCTION "public"."admin_get_payment_validation_detail"("p_validation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_payment_validations"("p_search" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT 'all'::"text", "p_date_from" "date" DEFAULT NULL::"date", "p_date_to" "date" DEFAULT NULL::"date", "p_page" integer DEFAULT 1, "p_page_size" integer DEFAULT 20) RETURNS TABLE("total_count" bigint, "id" "uuid", "organization_id" "uuid", "organization_name" "text", "organization_slug" "text", "user_id" "uuid", "user_full_name" "text", "user_email" "text", "amount" numeric, "payment_method" "text", "transaction_ref" "text", "status" "text", "created_at" timestamp with time zone, "reviewed_at" timestamp with time zone, "rejection_reason" "text", "reviewed_by_name" "text", "receipt_filename" "text", "receipt_mime_type" "text", "receipt_storage_path" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  safe_page integer := greatest(coalesce(p_page, 1), 1);
  safe_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 100);
  safe_offset integer := (greatest(coalesce(p_page, 1), 1) - 1) * least(greatest(coalesce(p_page_size, 20), 1), 100);
  normalized_search text := nullif(trim(coalesce(p_search, '')), '');
  normalized_status text := lower(coalesce(p_status, 'all'));
begin
  if not public.is_system_user(auth.uid()) then
    raise exception 'SYSTEM_ACCESS_REQUIRED'
      using errcode = '42501';
  end if;

  return query
  with filtered as (
    select
      pv.id,
      pv.organization_id,
      org.name as organization_name,
      org.slug as organization_slug,
      pv.user_id,
      submitter.full_name as user_full_name,
      submitter.email as user_email,
      pv.amount,
      pv.payment_method,
      pv.transaction_ref,
      pv.status,
      pv.created_at,
      pv.reviewed_at,
      pv.rejection_reason,
      reviewer.full_name as reviewed_by_name,
      pv.receipt_filename,
      pv.receipt_mime_type,
      pv.receipt_storage_path
    from public.payment_validations pv
    inner join public.organizations org on org.id = pv.organization_id
    inner join public.profiles submitter on submitter.id = pv.user_id
    left join public.system_users reviewer on reviewer.user_id = pv.reviewed_by_system_user
    where
      (
        normalized_status = 'all'
        or pv.status = normalized_status
      )
      and (p_date_from is null or pv.created_at::date >= p_date_from)
      and (p_date_to is null or pv.created_at::date <= p_date_to)
      and (
        normalized_search is null
        or org.name ilike '%' || normalized_search || '%'
        or org.slug ilike '%' || normalized_search || '%'
        or submitter.full_name ilike '%' || normalized_search || '%'
        or submitter.email ilike '%' || normalized_search || '%'
        or coalesce(pv.transaction_ref, '') ilike '%' || normalized_search || '%'
        or pv.receipt_filename ilike '%' || normalized_search || '%'
      )
  )
  select
    count(*) over()::bigint as total_count,
    filtered.id,
    filtered.organization_id,
    filtered.organization_name,
    filtered.organization_slug,
    filtered.user_id,
    filtered.user_full_name,
    filtered.user_email,
    filtered.amount,
    filtered.payment_method,
    filtered.transaction_ref,
    filtered.status,
    filtered.created_at,
    filtered.reviewed_at,
    filtered.rejection_reason,
    filtered.reviewed_by_name,
    filtered.receipt_filename,
    filtered.receipt_mime_type,
    filtered.receipt_storage_path
  from filtered
  order by
    case when filtered.status = 'pending' then 0 else 1 end,
    filtered.created_at desc
  limit safe_page_size
  offset safe_offset;
end;
$$;


ALTER FUNCTION "public"."admin_list_payment_validations"("p_search" "text", "p_status" "text", "p_date_from" "date", "p_date_to" "date", "p_page" integer, "p_page_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_payment_validation_stats"() RETURNS TABLE("pending_count" bigint, "approved_today" bigint, "rejected_today" bigint, "avg_review_minutes" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_system_user(auth.uid()) then
    raise exception 'SYSTEM_ACCESS_REQUIRED'
      using errcode = '42501';
  end if;

  return query
  select
    aps.pending_count::bigint,
    aps.approved_today::bigint,
    aps.rejected_today::bigint,
    coalesce(aps.avg_review_minutes, 0)::numeric
  from public.admin_payment_stats aps;
end;
$$;


ALTER FUNCTION "public"."admin_payment_validation_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_review_payment_validation"("p_validation_id" "uuid", "p_decision" "text", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  validation_row public.payment_validations%rowtype;
  organization_row public.organizations%rowtype;
  submitter_row public.profiles%rowtype;
  decision text := lower(trim(coalesce(p_decision, '')));
  review_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not public.is_system_user(auth.uid()) then
    raise exception 'SYSTEM_ACCESS_REQUIRED'
      using errcode = '42501';
  end if;

  if decision not in ('approved', 'rejected') then
    raise exception 'INVALID_REVIEW_DECISION'
      using errcode = '22023';
  end if;

  if decision = 'rejected' and review_reason is null then
    raise exception 'REJECTION_REASON_REQUIRED'
      using errcode = '22023';
  end if;

  select *
  into validation_row
  from public.payment_validations
  where id = p_validation_id
  for update;

  if not found then
    raise exception 'PAYMENT_VALIDATION_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if validation_row.status <> 'pending' then
    raise exception 'PAYMENT_VALIDATION_ALREADY_REVIEWED'
      using errcode = '23514';
  end if;

  select *
  into organization_row
  from public.organizations
  where id = validation_row.organization_id;

  select *
  into submitter_row
  from public.profiles
  where id = validation_row.user_id;

  update public.payment_validations
  set
    status = decision,
    rejection_reason = case when decision = 'rejected' then review_reason else null end,
    reviewed_at = now(),
    reviewed_by_system_user = auth.uid(),
    updated_at = now()
  where id = validation_row.id;

  if decision = 'approved' then
    update public.organizations
    set
      status = 'active',
      updated_at = now()
    where id = validation_row.organization_id;

    update public.organization_subscriptions
    set
      status = 'active',
      updated_at = now()
    where organization_id = validation_row.organization_id;

    update public.onboarding_progress
    set
      current_step = 'completed',
      updated_at = now()
    where user_id = validation_row.user_id;
  else
    update public.organizations
    set
      status = 'pending',
      updated_at = now()
    where id = validation_row.organization_id;

    update public.onboarding_progress
    set
      current_step = 'payment',
      updated_at = now()
    where user_id = validation_row.user_id;
  end if;

  insert into public.audit_logs (
    action,
    table_name,
    record_id,
    user_id,
    context
  )
  values (
    'UPDATE',
    'system_payment_validations',
    validation_row.id,
    auth.uid(),
    jsonb_build_object(
      'event',
      case when decision = 'approved' then 'PAYMENT_APPROVED' else 'PAYMENT_REJECTED' end,
      'organization_id',
      validation_row.organization_id,
      'payment_validation_id',
      validation_row.id,
      'submitted_by',
      validation_row.user_id,
      'reason',
      review_reason
    )
  );

  return jsonb_build_object(
    'id', validation_row.id,
    'decision', decision,
    'organization_id', validation_row.organization_id,
    'organization_name', organization_row.name,
    'organization_slug', organization_row.slug,
    'user_email', submitter_row.email,
    'user_full_name', submitter_row.full_name
  );
end;
$$;


ALTER FUNCTION "public"."admin_review_payment_validation"("p_validation_id" "uuid", "p_decision" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_inventory_stock_mutation"("p_branch_id" "uuid", "p_product_id" "uuid", "p_mode" "text", "p_quantity" integer, "p_min_stock_level" integer DEFAULT NULL::integer, "p_require_available" boolean DEFAULT false) RETURNS TABLE("stock_id" "uuid", "previous_quantity" integer, "new_quantity" integer, "reserved_quantity" integer, "min_stock_level" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."apply_inventory_stock_mutation"("p_branch_id" "uuid", "p_product_id" "uuid", "p_mode" "text", "p_quantity" integer, "p_min_stock_level" integer, "p_require_available" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_organization_creation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, table_name, record_id, context)
  VALUES (
    auth.uid(),
    'INSERT',
    'organizations',
    new.id,
    jsonb_build_object('name', new.name, 'country', new.country)
  );
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."audit_organization_creation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_trigger_func"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_old_data jsonb;
  v_new_data jsonb;
  v_checksum text;
begin
  if tg_op = 'DELETE' then
    v_old_data = to_jsonb(old);
    v_new_data = null;
  elsif tg_op = 'UPDATE' then
    v_old_data = to_jsonb(old);
    v_new_data = to_jsonb(new);
  elsif tg_op = 'INSERT' then
    v_old_data = null;
    v_new_data = to_jsonb(new);
  end if;

  v_checksum = md5((coalesce(v_old_data::text, '') || coalesce(v_new_data::text, '') || tg_table_name || now()::text)::bytea);

  insert into public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data,
    ip_address,
    user_agent,
    context,
    checksum
  ) values (
    coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    tg_op::public.audit_action,
    tg_table_name,
    coalesce(old.id, new.id),
    v_old_data,
    v_new_data,
    inet_client_addr(),
    nullif(current_setting('request.headers', true)::json ->> 'user-agent', ''),
    nullif(current_setting('app.audit_context', true)::jsonb, null),
    v_checksum
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."audit_trigger_func"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_subscription_limit"("org_id" "uuid", "resource_type" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_plan_id uuid;
  v_limit int;
  v_current_count int;
  v_feature_enabled boolean;
begin
  if resource_type = 'branch' then
    select count(*) into v_current_count
    from public.branches
    where organization_id = org_id;
  end if;

  select os.plan_id into v_plan_id
  from public.organization_subscriptions os
  where os.organization_id = org_id
    and os.status in ('active', 'trial')
    and os.current_period_end > now();

  if v_plan_id is null and resource_type = 'branch' and coalesce(v_current_count, 0) = 0 then
    select os.plan_id into v_plan_id
    from public.organization_subscriptions os
    where os.organization_id = org_id
      and os.status = 'past_due'
    order by os.updated_at desc nulls last, os.created_at desc nulls last
    limit 1;
  end if;

  if v_plan_id is null then
    raise exception 'No active subscription found.';
  end if;

  if resource_type = 'branch' then
    if coalesce(v_current_count, 0) = 0 then
      return true;
    end if;

    select max_branches into v_limit from public.subscription_plans where id = v_plan_id;

    if v_current_count >= v_limit then
      return false;
    end if;

    if v_current_count > 1 then
      select feature_multi_branch into v_feature_enabled from public.subscription_plans where id = v_plan_id;
      if not coalesce(v_feature_enabled, false) then
        return false;
      end if;
    end if;
  elsif resource_type = 'user' then
    select max_users into v_limit from public.subscription_plans where id = v_plan_id;
    select count(*) into v_current_count
    from public.profiles
    where organization_id = org_id
      and role <> 'client';

    if v_current_count >= v_limit then
      return false;
    end if;
  end if;

  return true;
end;
$$;


ALTER FUNCTION "public"."check_subscription_limit"("org_id" "uuid", "resource_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_onboarding_organization"("p_name" "text", "p_country" "text", "p_address" "text" DEFAULT NULL::"text", "p_full_name" "text" DEFAULT NULL::"text", "p_email" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_organization_id uuid;
  v_plan_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Tu sesion no es valida. Inicia sesion nuevamente.';
  END IF;

  -- Check if user already has an organization
  SELECT organization_id INTO v_organization_id
  FROM profiles
  WHERE id = v_user_id;

  IF v_organization_id IS NOT NULL THEN
    RETURN v_organization_id;
  END IF;

  -- Get or create emprende plan
  SELECT id INTO v_plan_id FROM subscription_plans WHERE slug = 'emprende' LIMIT 1;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'No se encontro el plan emprende.';
  END IF;

  -- Create organization with simplified fields
  INSERT INTO organizations (name, country, address)
  VALUES (TRIM(COALESCE(p_name, '')), p_country, p_address)
  RETURNING id INTO v_organization_id;

  -- Create trial subscription
  INSERT INTO organization_subscriptions (organization_id, plan_id, status, current_period_end)
  VALUES (v_organization_id, v_plan_id, 'trial', NOW() + INTERVAL '30 days');

  -- Update user profile
  UPDATE profiles
  SET organization_id = v_organization_id,
      full_name = COALESCE(NULLIF(TRIM(p_full_name), ''), full_name),
      email = COALESCE(NULLIF(TRIM(LOWER(p_email)), ''), email),
      phone = COALESCE(NULLIF(TRIM(p_phone), ''), phone)
  WHERE id = v_user_id;

  RETURN v_organization_id;
END;
$$;


ALTER FUNCTION "public"."create_onboarding_organization"("p_name" "text", "p_country" "text", "p_address" "text", "p_full_name" "text", "p_email" "text", "p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_onboarding_organization"("p_name" "text", "p_slug" "text", "p_timezone" "text", "p_currency" "text", "p_address" "text", "p_billing_data" "jsonb", "p_full_name" "text", "p_email" "text", "p_phone" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_existing_org_id uuid;
  v_organization_id uuid;
  v_plan_id uuid;
  v_name text;
  v_slug text;
  v_timezone text;
  v_currency text;
  v_address text;
  v_full_name text;
  v_email text;
  v_phone text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Tu sesion no es valida. Inicia sesion nuevamente.';
  end if;

  v_name := nullif(trim(coalesce(p_name, '')), '');
  v_slug := nullif(trim(coalesce(p_slug, '')), '');
  v_timezone := nullif(trim(coalesce(p_timezone, '')), '');
  v_currency := upper(nullif(trim(coalesce(p_currency, '')), ''));
  v_address := nullif(trim(coalesce(p_address, '')), '');
  v_full_name := nullif(trim(coalesce(p_full_name, '')), '');
  v_email := lower(nullif(trim(coalesce(p_email, '')), ''));
  v_phone := nullif(trim(coalesce(p_phone, '')), '');

  if v_name is null or v_slug is null or v_timezone is null or v_currency is null or v_address is null then
    raise exception 'Completa todos los campos requeridos de la organizacion.';
  end if;

  select organization_id
    into v_existing_org_id
  from public.profiles
  where id = v_user_id;

  if v_existing_org_id is not null then
    return v_existing_org_id;
  end if;

  if exists (
    select 1
    from public.organizations
    where slug = v_slug
  ) then
    raise exception 'Este nombre de organizacion no esta disponible.';
  end if;

  insert into public.organizations (
    name,
    slug,
    currency_code,
    timezone,
    address,
    billing_data,
    status,
    is_active
  )
  values (
    v_name,
    v_slug,
    v_currency,
    v_timezone,
    v_address,
    coalesce(p_billing_data, '{}'::jsonb),
    'pending',
    true
  )
  returning id into v_organization_id;

  insert into public.profiles (
    id,
    email,
    full_name,
    phone,
    organization_id,
    role,
    is_active,
    updated_at
  )
  values (
    v_user_id,
    coalesce(v_email, ''),
    coalesce(v_full_name, 'Administrador NexusPOS'),
    v_phone,
    v_organization_id,
    'admin',
    true,
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    phone = excluded.phone,
    organization_id = excluded.organization_id,
    role = excluded.role,
    is_active = excluded.is_active,
    updated_at = now();

  select id
    into v_plan_id
  from public.subscription_plans
  where slug = 'emprende'
  limit 1;

  if v_plan_id is not null then
    insert into public.organization_subscriptions (
      organization_id,
      plan_id,
      status,
      current_period_start,
      current_period_end
    )
    values (
      v_organization_id,
      v_plan_id,
      'trial',
      now(),
      now() + interval '7 days'
    )
    on conflict (organization_id) do update
    set
      plan_id = excluded.plan_id,
      status = excluded.status,
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end;
  end if;

  insert into public.onboarding_progress (
    user_id,
    organization_id,
    current_step,
    progress_data,
    updated_at
  )
  values (
    v_user_id,
    v_organization_id,
    'payment',
    jsonb_build_object(
      'organizationId', v_organization_id,
      'organizationDraft', jsonb_build_object(
        'organizationName', v_name,
        'slug', v_slug,
        'timezone', v_timezone,
        'currency', v_currency,
        'address', v_address,
        'billingData', coalesce(p_billing_data, '{}'::jsonb),
        'logoPreviewUrl', null,
        'logoFileName', null
      )
    ),
    now()
  )
  on conflict (user_id) do update
  set
    organization_id = excluded.organization_id,
    current_step = excluded.current_step,
    progress_data = excluded.progress_data,
    updated_at = now();

  return v_organization_id;
end;
$$;


ALTER FUNCTION "public"."create_onboarding_organization"("p_name" "text", "p_slug" "text", "p_timezone" "text", "p_currency" "text", "p_address" "text", "p_billing_data" "jsonb", "p_full_name" "text", "p_email" "text", "p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_onboarding_organization"("p_name" "text", "p_business_type" "text" DEFAULT 'both'::"text", "p_country" "text" DEFAULT 'BO'::"text", "p_currency" "text" DEFAULT 'BOB'::"text", "p_timezone" "text" DEFAULT 'America/La_Paz'::"text", "p_billing_mode" "text" DEFAULT 'monthly'::"text", "p_full_name" "text" DEFAULT NULL::"text", "p_email" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_org_id uuid;
    v_user_id uuid;
    v_plan_id uuid;
    v_plan_slug text;
begin
    v_user_id := auth.uid();
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;

    -- Get plan from user_metadata
    v_plan_slug := coalesce(
        (select (u.raw_user_meta_data->>'selectedPlan')::text from auth.users u where u.id = v_user_id),
        'emprende'
    );
    select id into v_plan_id from subscription_plans where slug = v_plan_slug limit 1;
    if v_plan_id is null then
        select id into v_plan_id from subscription_plans where slug = 'emprende' limit 1;
    end if;

    -- Create organization
    insert into organizations (name, currency_code, timezone, country, business_type)
    values (p_name, p_currency, p_timezone, p_country, p_business_type)
    returning id into v_org_id;

    -- Create subscription (trial 30 days)
    insert into organization_subscriptions (organization_id, plan_id, status, current_period_end)
    values (v_org_id, v_plan_id, 'trial', now() + interval '30 days');

    -- Update profile
    update profiles
    set organization_id = v_org_id,
        role = 'admin',
        full_name = coalesce(p_full_name, full_name),
        email = coalesce(p_email, email),
        phone = coalesce(p_phone, phone)
    where id = v_user_id;

    -- Create default branch
    insert into branches (organization_id, name, code)
    values (v_org_id, 'Principal', 'MAIN');

    -- Assign user to default branch
    insert into employee_branch_assignments (user_id, branch_id, is_primary)
    select v_user_id, b.id, true
    from branches b where b.organization_id = v_org_id limit 1;

    return v_org_id;
end;
$$;


ALTER FUNCTION "public"."create_onboarding_organization"("p_name" "text", "p_business_type" "text", "p_country" "text", "p_currency" "text", "p_timezone" "text", "p_billing_mode" "text", "p_full_name" "text", "p_email" "text", "p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_onboarding_organization"("p_name" "text", "p_business_types" "public"."business_type_enum"[] DEFAULT '{product}'::"public"."business_type_enum"[], "p_country" "text" DEFAULT 'BO'::"text", "p_currency" "text" DEFAULT 'BOB'::"text", "p_timezone" "text" DEFAULT 'America/La_Paz'::"text", "p_billing_mode" "text" DEFAULT 'monthly'::"text", "p_full_name" "text" DEFAULT NULL::"text", "p_email" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_org_id uuid;
    v_user_id uuid;
    v_plan_id uuid;
    v_plan_slug text;
    v_type business_type_enum;
begin
    v_user_id := auth.uid();
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;

    -- Get plan from user_metadata
    v_plan_slug := coalesce(
        (select (u.raw_user_meta_data->>'selectedPlan')::text from auth.users u where u.id = v_user_id),
        'emprende'
    );
    select id into v_plan_id from subscription_plans where slug = v_plan_slug limit 1;
    if v_plan_id is null then
        select id into v_plan_id from subscription_plans where slug = 'emprende' limit 1;
    end if;

    -- Create organization (no business_type column)
    insert into organizations (name, currency_code, timezone)
    values (p_name, p_currency, p_timezone)
    returning id into v_org_id;

    -- Create subscription (trial 30 days)
    insert into organization_subscriptions (organization_id, plan_id, status, current_period_end)
    values (v_org_id, v_plan_id, 'trial', now() + interval '30 days');

    -- Insert business types
    foreach v_type in array p_business_types loop
        insert into organization_business_types (organization_id, business_type)
        values (v_org_id, v_type);
    end loop;

    -- Update profile
    update profiles
    set organization_id = v_org_id,
        role = 'admin',
        full_name = coalesce(p_full_name, full_name),
        email = coalesce(p_email, email),
        phone = coalesce(p_phone, phone)
    where id = v_user_id;

    -- Create default branch
    insert into branches (organization_id, name, code)
    values (v_org_id, 'Principal', 'MAIN');

    -- Assign user to default branch
    insert into employee_branch_assignments (user_id, branch_id, is_primary)
    select v_user_id, b.id, true
    from branches b where b.organization_id = v_org_id limit 1;

    return v_org_id;
end;
$$;


ALTER FUNCTION "public"."create_onboarding_organization"("p_name" "text", "p_business_types" "public"."business_type_enum"[], "p_country" "text", "p_currency" "text", "p_timezone" "text", "p_billing_mode" "text", "p_full_name" "text", "p_email" "text", "p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_onboarding_organization"("p_name" "text", "p_business_type" "text" DEFAULT 'hybrid'::"text", "p_country" "text" DEFAULT 'BO'::"text", "p_currency" "text" DEFAULT 'BOB'::"text", "p_timezone" "text" DEFAULT 'America/La_Paz'::"text", "p_billing_mode" "text" DEFAULT 'monthly'::"text", "p_slug" "text" DEFAULT NULL::"text", "p_address" "text" DEFAULT NULL::"text", "p_billing_data" "jsonb" DEFAULT NULL::"jsonb", "p_full_name" "text" DEFAULT NULL::"text", "p_email" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_org_id uuid;
    v_user_id uuid;
    v_existing_org_id uuid;
    v_branch_id uuid;
    v_plan_id uuid;
    v_plan_slug text;
    v_business_only boolean;
    v_trial boolean;
    v_trial_duration int;
    v_available_billing_modes jsonb;
    v_now timestamptz;
    v_trial_ends_at timestamptz;
    v_profile_full_name text;
    v_profile_email text;
    v_profile_phone text;
begin
    v_user_id := auth.uid();
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;

    if p_business_type not in ('services', 'products', 'hybrid') then
      raise exception 'business_type invalido';
    end if;

    select p.organization_id
      into v_existing_org_id
    from public.profiles p
    where p.id = v_user_id
    limit 1;

    if v_existing_org_id is not null then
      return v_existing_org_id;
    end if;

    v_plan_slug := coalesce(
      (select (u.raw_user_meta_data->>'selectedPlan')::text from auth.users u where u.id = v_user_id),
      'emprende'
    );

    select
      id,
      business_only,
      trial,
      trial_duration,
      available_billing_modes
    into
      v_plan_id,
      v_business_only,
      v_trial,
      v_trial_duration,
      v_available_billing_modes
    from public.subscription_plans
    where slug = v_plan_slug
      and coalesce(is_active, true)
    limit 1;

    if v_plan_id is null then
      select
        id,
        business_only,
        trial,
        trial_duration,
        available_billing_modes
      into
        v_plan_id,
        v_business_only,
        v_trial,
        v_trial_duration,
        v_available_billing_modes
      from public.subscription_plans
      where slug = 'emprende'
        and coalesce(is_active, true)
      limit 1;
    end if;

    if v_plan_id is null then
      raise exception 'No se encontro un plan valido para onboarding';
    end if;

    if coalesce(v_business_only, false) = true and p_business_type = 'hybrid' then
      raise exception 'El plan seleccionado no permite negocio hibrido';
    end if;

    if not public.plan_billing_mode_enabled(v_available_billing_modes, p_billing_mode) then
      raise exception 'El modo de facturacion no esta habilitado para este plan';
    end if;

    v_now := now();
    if coalesce(v_trial, false) = true and coalesce(v_trial_duration, 0) > 0 then
      v_trial_ends_at := v_now + make_interval(days => v_trial_duration);
    else
      v_trial_ends_at := null;
    end if;

    insert into public.organizations (
      name,
      currency_code,
      timezone,
      country,
      business_type,
      slug,
      address,
      billing_data
    )
    values (
      p_name,
      p_currency,
      p_timezone,
      p_country,
      p_business_type,
      p_slug,
      p_address,
      p_billing_data
    )
    returning id into v_org_id;

    insert into public.organization_subscriptions (
      organization_id,
      plan_id,
      status,
      current_period_start,
      current_period_end,
      billing_mode,
      payment_method,
      trial_ends_at,
      is_trial
    )
    values (
      v_org_id,
      v_plan_id,
      case when v_trial_ends_at is not null then 'trial'::public.sub_status else 'past_due'::public.sub_status end,
      v_now,
      coalesce(v_trial_ends_at, v_now),
      p_billing_mode,
      null,
      v_trial_ends_at,
      (v_trial_ends_at is not null)
    )
    on conflict (organization_id) do update set
      plan_id = excluded.plan_id,
      status = excluded.status,
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      billing_mode = excluded.billing_mode,
      payment_method = excluded.payment_method,
      trial_ends_at = excluded.trial_ends_at,
      is_trial = excluded.is_trial;

    v_profile_full_name := coalesce(
      nullif(trim(p_full_name), ''),
      (select nullif(trim(p.full_name), '') from public.profiles p where p.id = v_user_id),
      (select nullif(trim((u.raw_user_meta_data->>'full_name')::text), '') from auth.users u where u.id = v_user_id),
      'Administrador NexusPOS'
    );

    v_profile_email := coalesce(
      nullif(lower(trim(p_email)), ''),
      (select nullif(lower(trim(p.email)), '') from public.profiles p where p.id = v_user_id),
      (select nullif(lower(trim(u.email)), '') from auth.users u where u.id = v_user_id),
      concat(v_user_id::text, '@nexuspos.local')
    );

    v_profile_phone := coalesce(
      nullif(trim(p_phone), ''),
      (select nullif(trim(p.phone), '') from public.profiles p where p.id = v_user_id),
      (select nullif(trim((u.raw_user_meta_data->>'phone')::text), '') from auth.users u where u.id = v_user_id)
    );

    insert into public.profiles (
      id,
      organization_id,
      role,
      full_name,
      email,
      phone,
      is_active,
      updated_at
    )
    values (
      v_user_id,
      v_org_id,
      'admin',
      v_profile_full_name,
      v_profile_email,
      v_profile_phone,
      true,
      now()
    )
    on conflict (id) do update
    set
      organization_id = excluded.organization_id,
      role = 'admin',
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      email = coalesce(excluded.email, public.profiles.email),
      phone = coalesce(excluded.phone, public.profiles.phone),
      is_active = true,
      updated_at = now();

    insert into public.branches (organization_id, name, code)
    values (v_org_id, 'Principal', 'MAIN')
    returning id into v_branch_id;

    insert into public.employee_branch_assignments (user_id, branch_id, is_primary)
    values (v_user_id, v_branch_id, true)
    on conflict (user_id, branch_id) do update
    set is_primary = excluded.is_primary;

    return v_org_id;
end;
$$;


ALTER FUNCTION "public"."create_onboarding_organization"("p_name" "text", "p_business_type" "text", "p_country" "text", "p_currency" "text", "p_timezone" "text", "p_billing_mode" "text", "p_slug" "text", "p_address" "text", "p_billing_data" "jsonb", "p_full_name" "text", "p_email" "text", "p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_onboarding_organization"("p_name" "text", "p_business_types" "public"."business_type_enum"[] DEFAULT '{product}'::"public"."business_type_enum"[], "p_country" "text" DEFAULT 'BO'::"text", "p_currency" "text" DEFAULT 'BOB'::"text", "p_timezone" "text" DEFAULT 'America/La_Paz'::"text", "p_billing_mode" "text" DEFAULT 'monthly'::"text", "p_plan_slug" "text" DEFAULT 'emprende'::"text", "p_activation_mode" "text" DEFAULT 'trial'::"text", "p_full_name" "text" DEFAULT NULL::"text", "p_email" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_org_id uuid;
    v_user_id uuid;
    v_plan_id uuid;
    v_type public.business_type_enum;
    v_now timestamptz := now();
    v_trial_ends_at timestamptz := null;
    v_trial_consumed_at timestamptz := null;
begin
    v_user_id := auth.uid();
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;

    if p_activation_mode not in ('trial', 'paid') then
        raise exception 'INVALID_ACTIVATION_MODE';
    end if;

    select trial_consumed_at
      into v_trial_consumed_at
    from public.profiles
    where id = v_user_id
    limit 1;

    if p_activation_mode = 'trial' and v_trial_consumed_at is not null then
        raise exception 'TRIAL_ALREADY_USED';
    end if;

    select id
      into v_plan_id
    from public.subscription_plans
    where slug = coalesce(nullif(trim(p_plan_slug), ''), 'emprende')
    limit 1;

    if v_plan_id is null then
      select id
        into v_plan_id
      from public.subscription_plans
      where slug = 'emprende'
      limit 1;
    end if;

    if v_plan_id is null then
      raise exception 'No se encontro un plan valido para onboarding';
    end if;

    if p_activation_mode = 'trial' then
      v_trial_ends_at := v_now + interval '31 days';
    end if;

    insert into public.organizations (
      name,
      currency_code,
      timezone,
      country,
      status
    )
    values (
      p_name,
      p_currency,
      p_timezone,
      p_country,
      case when p_activation_mode = 'trial' then 'active' else 'pending' end
    )
    returning id into v_org_id;

    insert into public.organization_subscriptions (
      organization_id,
      plan_id,
      status,
      current_period_end,
      billing_mode,
      current_period_start,
      is_trial,
      trial_ends_at
    )
    values (
      v_org_id,
      v_plan_id,
      case when p_activation_mode = 'trial' then 'trial'::public.sub_status else 'past_due'::public.sub_status end,
      coalesce(v_trial_ends_at, v_now),
      p_billing_mode,
      v_now,
      p_activation_mode = 'trial',
      v_trial_ends_at
    )
    on conflict (organization_id) do update
    set
      plan_id = excluded.plan_id,
      status = excluded.status,
      current_period_end = excluded.current_period_end,
      billing_mode = excluded.billing_mode,
      current_period_start = excluded.current_period_start,
      is_trial = excluded.is_trial,
      trial_ends_at = excluded.trial_ends_at;

    foreach v_type in array p_business_types loop
      insert into public.organization_business_types (organization_id, business_type)
      values (v_org_id, v_type)
      on conflict do nothing;
    end loop;

    insert into public.profiles (
      id,
      organization_id,
      role,
      full_name,
      email,
      phone,
      is_active,
      trial_consumed_at,
      updated_at
    )
    values (
      v_user_id,
      v_org_id,
      'admin',
      coalesce(nullif(trim(p_full_name), ''), 'Administrador NexusPOS'),
      coalesce(nullif(lower(trim(p_email)), ''), concat(v_user_id::text, '@nexuspos.local')),
      nullif(trim(p_phone), ''),
      true,
      case when p_activation_mode = 'trial' then v_now else null end,
      v_now
    )
    on conflict (id) do update
    set
      organization_id = excluded.organization_id,
      role = 'admin',
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      email = coalesce(excluded.email, public.profiles.email),
      phone = coalesce(excluded.phone, public.profiles.phone),
      is_active = true,
      trial_consumed_at = coalesce(public.profiles.trial_consumed_at, excluded.trial_consumed_at),
      updated_at = v_now;

    insert into public.branches (organization_id, name, code)
    values (v_org_id, 'Principal', 'MAIN');

    insert into public.employee_branch_assignments (user_id, branch_id, is_primary)
    select v_user_id, b.id, true
    from public.branches b
    where b.organization_id = v_org_id
    limit 1
    on conflict (user_id, branch_id) do update
    set is_primary = excluded.is_primary;

    return v_org_id;
end;
$$;


ALTER FUNCTION "public"."create_onboarding_organization"("p_name" "text", "p_business_types" "public"."business_type_enum"[], "p_country" "text", "p_currency" "text", "p_timezone" "text", "p_billing_mode" "text", "p_plan_slug" "text", "p_activation_mode" "text", "p_full_name" "text", "p_email" "text", "p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_branch_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
    if not exists (
      select 1
      from public.branches
      where organization_id = new.organization_id
    ) then
      return new;
    end if;

    if not check_subscription_limit(new.organization_id, 'branch') then
        raise exception 'Subscription limit exceeded: Cannot create more branches. Please upgrade your plan.';
    end if;
    return new;
end;
$$;


ALTER FUNCTION "public"."enforce_branch_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_org_anonymous_customer_template"("p_organization_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  existing_template_client_id uuid;
  anonymous_client_id uuid;
begin
  select co.client_id
  into existing_template_client_id
  from public.client_org co
  where co.organization_id = p_organization_id
    and co.status = 'active'
    and co.is_anonymous_template = true
  limit 1;

  if existing_template_client_id is not null then
    return;
  end if;

  insert into public.clients (
    user_id,
    first_name,
    last_name,
    phone,
    email,
    billing_data,
    preferences
  ) values (
    null,
    'Cliente',
    'Anonimo',
    null,
    null,
    '{}'::jsonb,
    jsonb_build_object('system', true, 'anonymous_template', true)
  )
  returning id into anonymous_client_id;

  insert into public.client_org (
    client_id,
    organization_id,
    status,
    billing_data,
    billing_name,
    billing_email,
    billing_phone,
    document_type,
    document_number,
    is_anonymous_template
  ) values (
    anonymous_client_id,
    p_organization_id,
    'active',
    '{}'::jsonb,
    'Cliente Anonimo',
    null,
    null,
    'SIN_DOC',
    null,
    true
  )
  on conflict (client_id, organization_id) do update
  set
    status = excluded.status,
    is_anonymous_template = true,
    billing_data = coalesce(public.client_org.billing_data, '{}'::jsonb),
    updated_at = now();
end;
$$;


ALTER FUNCTION "public"."ensure_org_anonymous_customer_template"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_account_status_snapshot"("p_organization_id" "uuid") RETURNS TABLE("organization_status" "text", "subscription_status" "public"."sub_status", "is_trial" boolean, "trial_ends_at" timestamp with time zone, "latest_validation_status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_profile_org_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED'
      using errcode = '42501';
  end if;

  select p.organization_id
  into v_profile_org_id
  from public.profiles p
  where p.id = v_user_id;

  if v_profile_org_id is null or v_profile_org_id <> p_organization_id then
    raise exception 'ACCOUNT_STATUS_ACCESS_DENIED'
      using errcode = '42501';
  end if;

  return query
  select
    o.status as organization_status,
    s.status as subscription_status,
    coalesce(s.is_trial, false) as is_trial,
    s.trial_ends_at,
    pv.status as latest_validation_status
  from public.organizations o
  left join lateral (
    select
      os.status,
      os.is_trial,
      os.trial_ends_at
    from public.organization_subscriptions os
    where os.organization_id = o.id
    order by os.updated_at desc nulls last, os.created_at desc nulls last
    limit 1
  ) s on true
  left join lateral (
    select v.status
    from public.payment_validations v
    where v.organization_id = o.id
    order by v.created_at desc nulls last
    limit 1
  ) pv on true
  where o.id = p_organization_id;
end;
$$;


ALTER FUNCTION "public"."get_account_status_snapshot"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_organization_capabilities"("input_org_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_caps jsonb;
begin
  select jsonb_build_object(
    'planName', sp.name,
    'planSlug', sp.slug,
    'maxBranches', sp.max_branches,
    'maxUsers', sp.max_users,
    'canCreateBranch', (sp.max_branches > (select count(*) from public.branches where organization_id = input_org_id)),
    'canCreateManager', sp.feature_manager_role,
    'canTransferStock', sp.feature_inventory_transfer,
    'hasAdvancedReports', sp.feature_advanced_reports,
    'hasApiAccess', sp.feature_api_access,
    'hasForensicExport', sp.feature_forensic_export,
    'hasHotelModule', coalesce(sp.feature_hotel_module, false),
    'currentBranchesCount', (select count(*) from public.branches where organization_id = input_org_id),
    'currentUsersCount', (select count(*) from public.profiles where organization_id = input_org_id and role <> 'client'),
    'subscriptionStatus', os.status,
    'periodEnd', os.current_period_end,
    'businessTypes', (
      select coalesce(jsonb_agg(obt.business_type order by obt.business_type), '[]'::jsonb)
      from public.organization_business_types obt
      where obt.organization_id = input_org_id
    ),
    'allowedBusinessTypes', to_jsonb(sp.allowed_business_types),
    'maxBusinessTypes', sp.max_business_types,
    'permissions', coalesce(sp.permissions, '{}'::jsonb),
    'limits', coalesce(sp.limits, '{}'::jsonb),
    'features', coalesce(sp.features, '[]'::jsonb)
  )
  into v_caps
  from public.organization_subscriptions os
  join public.subscription_plans sp on sp.id = os.plan_id
  where os.organization_id = input_org_id
    and os.status in ('active', 'trial')
    and os.current_period_end > now()
  order by os.current_period_end desc
  limit 1;

  return coalesce(v_caps, '{}'::jsonb);
end;
$$;


ALTER FUNCTION "public"."get_organization_capabilities"("input_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_branch_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_branch_id uuid;
begin
  select eba.branch_id
    into v_branch_id
  from public.employee_branch_assignments eba
  where eba.user_id = auth.uid()
  order by eba.is_primary desc, eba.id asc
  limit 1;

  return v_branch_id;
end;
$$;


ALTER FUNCTION "public"."get_user_branch_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_organization_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_org_id uuid;
begin
  select organization_id into v_org_id from public.profiles where id = auth.uid();
  return v_org_id;
end;
$$;


ALTER FUNCTION "public"."get_user_organization_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"() RETURNS "public"."user_role"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  u_role public.user_role;
begin
  select role into u_role from public.profiles where id = auth.uid();
  return u_role;
end;
$$;


ALTER FUNCTION "public"."get_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."inventory_adjust_batch_execute"("p_organization_id" "uuid", "p_user_id" "uuid", "p_idempotency_key" "text", "p_branch_id" "uuid", "p_mode" "text", "p_reason" "text", "p_reference_code" "text", "p_note" "text", "p_lines" "jsonb") RETURNS TABLE("batch_id" "uuid", "processed_count" integer, "idempotent" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."inventory_adjust_batch_execute"("p_organization_id" "uuid", "p_user_id" "uuid", "p_idempotency_key" "text", "p_branch_id" "uuid", "p_mode" "text", "p_reason" "text", "p_reference_code" "text", "p_note" "text", "p_lines" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."inventory_adjust_batch_precheck"("p_organization_id" "uuid", "p_branch_id" "uuid", "p_mode" "text", "p_lines" "jsonb") RETURNS TABLE("line_index" integer, "product_id" "uuid", "quantity" integer, "is_valid" boolean, "error_code" "text", "error_message" "text", "current_quantity" integer, "next_quantity" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."inventory_adjust_batch_precheck"("p_organization_id" "uuid", "p_branch_id" "uuid", "p_mode" "text", "p_lines" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."inventory_transfer_batch_create"("p_organization_id" "uuid", "p_user_id" "uuid", "p_idempotency_key" "text", "p_source_branch_id" "uuid", "p_destination_branch_id" "uuid", "p_observations" "text", "p_reference_code" "text", "p_lines" "jsonb") RETURNS TABLE("batch_id" "uuid", "processed_count" integer, "idempotent" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."inventory_transfer_batch_create"("p_organization_id" "uuid", "p_user_id" "uuid", "p_idempotency_key" "text", "p_source_branch_id" "uuid", "p_destination_branch_id" "uuid", "p_observations" "text", "p_reference_code" "text", "p_lines" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."inventory_transfer_batch_precheck"("p_organization_id" "uuid", "p_source_branch_id" "uuid", "p_destination_branch_id" "uuid", "p_lines" "jsonb") RETURNS TABLE("line_index" integer, "product_id" "uuid", "quantity" integer, "is_valid" boolean, "error_code" "text", "error_message" "text", "current_quantity" integer, "next_quantity" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."inventory_transfer_batch_precheck"("p_organization_id" "uuid", "p_source_branch_id" "uuid", "p_destination_branch_id" "uuid", "p_lines" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."inventory_transfer_batch_receive"("p_organization_id" "uuid", "p_user_id" "uuid", "p_batch_id" "uuid") RETURNS TABLE("batch_id" "uuid", "processed_count" integer, "idempotent" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."inventory_transfer_batch_receive"("p_organization_id" "uuid", "p_user_id" "uuid", "p_batch_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_branch_in_user_organization"("target_branch_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  return exists (
    select 1
    from public.branches
    where id = target_branch_id
      and organization_id = public.get_user_organization_id()
  );
end;
$$;


ALTER FUNCTION "public"."is_branch_in_user_organization"("target_branch_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_system_user"("input_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.system_users su
    where su.user_id = coalesce(input_user_id, auth.uid())
      and su.role = 'system'
      and su.is_active = true
  );
$$;


ALTER FUNCTION "public"."is_system_user"("input_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_user_assigned_to_branch"("target_branch_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  return exists (
    select 1
    from public.employee_branch_assignments
    where user_id = auth.uid()
      and branch_id = target_branch_id
  );
end;
$$;


ALTER FUNCTION "public"."is_user_assigned_to_branch"("target_branch_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."next_inventory_document_code"("p_organization_id" "uuid", "p_doc_type" "text", "p_prefix" "text" DEFAULT 'INV'::"text", "p_year" integer DEFAULT (EXTRACT(year FROM "now"()))::integer) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_next integer;
  v_doc_type text;
  v_prefix text;
begin
  v_doc_type := upper(trim(coalesce(p_doc_type, '')));
  if v_doc_type not in ('ING', 'SAL', 'AJU', 'TRA') then
    raise exception 'INVALID_DOC_TYPE';
  end if;

  v_prefix := upper(regexp_replace(trim(coalesce(p_prefix, 'INV')), '[^A-Z0-9]', '', 'g'));
  if char_length(v_prefix) = 0 then
    v_prefix := 'INV';
  end if;

  if p_year is null or p_year < 2000 then
    raise exception 'INVALID_DOC_YEAR';
  end if;

  insert into public.inventory_document_sequences (
    organization_id,
    doc_type,
    seq_year,
    last_value
  )
  values (
    p_organization_id,
    v_doc_type,
    p_year,
    1
  )
  on conflict (organization_id, doc_type, seq_year)
  do update set
    last_value = public.inventory_document_sequences.last_value + 1,
    updated_at = now()
  returning last_value into v_next;

  return format('%s-%s-%s/%s', v_prefix, v_doc_type, lpad(v_next::text, 4, '0'), p_year::text);
end;
$$;


ALTER FUNCTION "public"."next_inventory_document_code"("p_organization_id" "uuid", "p_doc_type" "text", "p_prefix" "text", "p_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."next_proforma_number"("p_organization_id" "uuid") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."next_proforma_number"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."next_sales_order_number"("p_organization_id" "uuid") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."next_sales_order_number"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_admin_new_receipt"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.audit_logs (user_id, action, table_name, record_id, context)
  values (
    new.user_id,
    'INSERT',
    'payment_validations',
    new.id,
    jsonb_build_object('organization_id', new.organization_id, 'amount', new.amount, 'status', new.status)
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."notify_admin_new_receipt"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."plan_billing_mode_enabled"("p_available_billing_modes" "jsonb", "p_billing_mode" "text") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_direct jsonb;
  v_item jsonb;
begin
  if p_available_billing_modes is null or jsonb_typeof(p_available_billing_modes) <> 'object' then
    return false;
  end if;

  v_direct := p_available_billing_modes -> p_billing_mode;
  if v_direct is not null and jsonb_typeof(v_direct) = 'object' then
    return coalesce((v_direct ->> 'enabled')::boolean, false);
  end if;

  for v_item in
    select value from jsonb_each(p_available_billing_modes)
  loop
    if jsonb_typeof(v_item) = 'object'
      and lower(coalesce(v_item ->> 'label', '')) = lower(p_billing_mode) then
      return coalesce((v_item ->> 'enabled')::boolean, false);
    end if;
  end loop;

  return false;
end;
$$;


ALTER FUNCTION "public"."plan_billing_mode_enabled"("p_available_billing_modes" "jsonb", "p_billing_mode" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_client_org_billing_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    insert into public.client_org_billing_history (
      client_id,
      organization_id,
      document_type,
      document_number,
      billing_name,
      billing_email,
      billing_phone,
      is_active_version,
      change_reason,
      changed_by,
      changed_at
    )
    values (
      new.client_id,
      new.organization_id,
      coalesce(new.document_type, 'SIN_DOC'),
      new.document_number,
      new.billing_name,
      new.billing_email,
      new.billing_phone,
      true,
      'INITIAL',
      null,
      now()
    )
    on conflict do nothing;

    return new;
  end if;

  if (
    coalesce(new.document_type, '') is distinct from coalesce(old.document_type, '')
    or coalesce(new.document_number, '') is distinct from coalesce(old.document_number, '')
    or coalesce(new.billing_name, '') is distinct from coalesce(old.billing_name, '')
    or coalesce(new.billing_email, '') is distinct from coalesce(old.billing_email, '')
    or coalesce(new.billing_phone, '') is distinct from coalesce(old.billing_phone, '')
  ) then
    update public.client_org_billing_history
    set is_active_version = false
    where client_id = old.client_id
      and organization_id = old.organization_id
      and is_active_version = true;

    insert into public.client_org_billing_history (
      client_id,
      organization_id,
      document_type,
      document_number,
      billing_name,
      billing_email,
      billing_phone,
      is_active_version,
      change_reason,
      changed_by,
      changed_at
    )
    values (
      new.client_id,
      new.organization_id,
      coalesce(new.document_type, 'SIN_DOC'),
      new.document_number,
      new.billing_name,
      new.billing_email,
      new.billing_phone,
      true,
      'PROFILE_UPDATE',
      null,
      now()
    );
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_client_org_billing_history"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_profile_role_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_role_id uuid;
  v_role_code public.user_role;
begin
  if new.role_id is null and new.role is not null then
    select id into v_role_id
    from public.user_roles
    where code = new.role
    limit 1;

    if v_role_id is null then
      raise exception 'No role catalog entry for role %', new.role;
    end if;

    new.role_id := v_role_id;
  elsif new.role_id is not null then
    select code into v_role_code
    from public.user_roles
    where id = new.role_id
    limit 1;

    if v_role_code is null then
      raise exception 'Invalid role_id %', new.role_id;
    end if;

    new.role := v_role_code;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_profile_role_columns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_ensure_org_anonymous_customer_template"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.ensure_org_anonymous_customer_template(new.id);
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_ensure_org_anonymous_customer_template"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."payment_validations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "payment_method" "text" DEFAULT 'bank_transfer'::"text",
    "transaction_ref" "text",
    "receipt_storage_path" "text" NOT NULL,
    "receipt_filename" "text" NOT NULL,
    "receipt_mime_type" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "rejection_reason" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "reviewed_by_system_user" "uuid",
    CONSTRAINT "payment_validations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."payment_validations" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."admin_payment_stats" WITH ("security_invoker"='true') AS
 SELECT "count"(*) FILTER (WHERE ("status" = 'pending'::"text")) AS "pending_count",
    "count"(*) FILTER (WHERE (("status" = 'approved'::"text") AND ("reviewed_at" >= "date_trunc"('day'::"text", "now"())))) AS "approved_today",
    "count"(*) FILTER (WHERE (("status" = 'rejected'::"text") AND ("reviewed_at" >= "date_trunc"('day'::"text", "now"())))) AS "rejected_today",
    "avg"((EXTRACT(epoch FROM ("reviewed_at" - "created_at")) / (60)::numeric)) FILTER (WHERE ("reviewed_at" IS NOT NULL)) AS "avg_review_minutes"
   FROM "public"."payment_validations";


ALTER VIEW "public"."admin_payment_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "customer_name" "text",
    "customer_phone" "text",
    "employee_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL,
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "status" "public"."appointment_status" DEFAULT 'pending'::"public"."appointment_status",
    "notes" "text",
    "cancelled_by" "uuid",
    "cancellation_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "transaction_id" "uuid",
    "source" "public"."appointment_source" DEFAULT 'manual'::"public"."appointment_source" NOT NULL,
    CONSTRAINT "valid_status_flow" CHECK (((("status" = 'cancelled'::"public"."appointment_status") AND ("cancelled_by" IS NOT NULL)) OR ("status" <> 'cancelled'::"public"."appointment_status"))),
    CONSTRAINT "valid_time_range" CHECK (("end_time" > "start_time"))
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."appointments"."transaction_id" IS 'ID of the POS transaction that paid for this appointment. NULL if not yet paid or paid outside POS.';



COMMENT ON COLUMN "public"."appointments"."source" IS 'Origin of the appointment: manual (created in agenda module), pos_checkout (auto-created during POS sale), client_booking (created by client via portal).';



CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" bigint NOT NULL,
    "logged_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "action" "public"."audit_action" NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "uuid",
    "old_data" "jsonb",
    "new_data" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "context" "jsonb",
    "checksum" "text"
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


ALTER TABLE "public"."audit_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."audit_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."billing_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "amount" numeric(10,2),
    "currency" "text" DEFAULT 'USD'::"text",
    "billing_mode" "text",
    "description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "billing_ledger_billing_mode_check" CHECK (("billing_mode" = ANY (ARRAY['monthly'::"text", 'quarterly'::"text", 'annual'::"text"]))),
    CONSTRAINT "billing_ledger_event_type_check" CHECK (("event_type" = ANY (ARRAY['plan_change'::"text", 'payment'::"text", 'cancellation'::"text", 'reactivation'::"text", 'trial_start'::"text", 'trial_end'::"text", 'proration_credit'::"text", 'proration_charge'::"text"])))
);


ALTER TABLE "public"."billing_ledger" OWNER TO "postgres";


COMMENT ON TABLE "public"."billing_ledger" IS 'Historial de transacciones de suscripcion por organizacion';



CREATE TABLE IF NOT EXISTS "public"."branches" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "address" "text",
    "phone" "text",
    "is_active" boolean DEFAULT true,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."branches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "parent_id" "uuid",
    "is_active" boolean DEFAULT true,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "categories_type_check" CHECK (("type" = ANY (ARRAY['product'::"text", 'service'::"text", 'lodging'::"text"])))
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_org" (
    "client_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "billing_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "document_type" "text" DEFAULT 'SIN_DOC'::"text",
    "document_number" "text",
    "billing_name" "text",
    "billing_email" "text",
    "billing_phone" "text",
    "is_anonymous_template" boolean DEFAULT false NOT NULL,
    CONSTRAINT "client_org_document_number_required_check" CHECK (((("document_type" = ANY (ARRAY['NIT'::"text", 'CI'::"text"])) AND (NULLIF(TRIM(BOTH FROM "document_number"), ''::"text") IS NOT NULL)) OR ("document_type" = 'SIN_DOC'::"text"))),
    CONSTRAINT "client_org_document_type_check" CHECK (("document_type" = ANY (ARRAY['NIT'::"text", 'CI'::"text", 'SIN_DOC'::"text"]))),
    CONSTRAINT "client_org_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."client_org" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_org_billing_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "document_number" "text",
    "billing_name" "text",
    "billing_email" "text",
    "billing_phone" "text",
    "is_active_version" boolean DEFAULT true NOT NULL,
    "change_reason" "text",
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "client_org_billing_history_document_type_check" CHECK (("document_type" = ANY (ARRAY['NIT'::"text", 'CI'::"text", 'SIN_DOC'::"text"])))
);


ALTER TABLE "public"."client_org_billing_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "first_name" "text" NOT NULL,
    "last_name" "text",
    "phone" "text",
    "email" "text",
    "billing_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "preferences" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notification_preferences" "jsonb" DEFAULT '{"email": true, "whatsapp": true}'::"jsonb"
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


COMMENT ON COLUMN "public"."clients"."notification_preferences" IS 'Preferencias de notificacion por canal: {whatsapp: boolean, email: boolean}';



CREATE TABLE IF NOT EXISTS "public"."employee_branch_assignments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "can_manage_inventory" boolean DEFAULT false,
    "can_override_prices" boolean DEFAULT false,
    "skills" "jsonb" DEFAULT '[]'::"jsonb",
    "is_primary" boolean DEFAULT false
);


ALTER TABLE "public"."employee_branch_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guest_customers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "branch_id" "uuid",
    "full_name" "text" NOT NULL,
    "phone" "text",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "notification_preferences" "jsonb" DEFAULT '{"whatsapp": true}'::"jsonb"
);


ALTER TABLE "public"."guest_customers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."guest_customers"."notification_preferences" IS 'Preferencias de notificacion por canal: {whatsapp: boolean}';



CREATE TABLE IF NOT EXISTS "public"."inventory_adjust_batches" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "mode" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "note" "text",
    "total_lines" integer NOT NULL,
    "processed_count" integer DEFAULT 0 NOT NULL,
    "processed_by" "uuid",
    "idempotency_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inventory_adjust_batches_mode_check" CHECK (("mode" = ANY (ARRAY['set'::"text", 'add'::"text", 'remove'::"text"]))),
    CONSTRAINT "inventory_adjust_batches_processed_count_check" CHECK (("processed_count" >= 0)),
    CONSTRAINT "inventory_adjust_batches_total_lines_check" CHECK (("total_lines" > 0))
);


ALTER TABLE "public"."inventory_adjust_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_document_sequences" (
    "organization_id" "uuid" NOT NULL,
    "doc_type" "text" NOT NULL,
    "seq_year" integer NOT NULL,
    "last_value" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inventory_document_sequences_doc_type_check" CHECK (("doc_type" = ANY (ARRAY['ING'::"text", 'SAL'::"text", 'AJU'::"text", 'TRA'::"text"]))),
    CONSTRAINT "inventory_document_sequences_last_value_check" CHECK (("last_value" >= 0)),
    CONSTRAINT "inventory_document_sequences_seq_year_check" CHECK (("seq_year" >= 2000))
);


ALTER TABLE "public"."inventory_document_sequences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_movements" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "movement_type" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "previous_quantity" integer NOT NULL,
    "new_quantity" integer NOT NULL,
    "reason" "text",
    "note" "text",
    "reference_type" "text",
    "reference_id" "uuid",
    "source_branch_id" "uuid",
    "destination_branch_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "reference_code" "text",
    CONSTRAINT "inventory_movements_movement_type_check" CHECK (("movement_type" = ANY (ARRAY['entry'::"text", 'exit'::"text", 'adjustment'::"text", 'transfer_in'::"text", 'transfer_out'::"text"]))),
    CONSTRAINT "inventory_movements_new_quantity_check" CHECK (("new_quantity" >= 0)),
    CONSTRAINT "inventory_movements_previous_quantity_check" CHECK (("previous_quantity" >= 0)),
    CONSTRAINT "inventory_movements_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."inventory_movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_stock" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 0,
    "min_stock_level" integer DEFAULT 5,
    "reserved_quantity" integer DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "inventory_stock_min_stock_level_check" CHECK (("min_stock_level" >= 0)),
    CONSTRAINT "inventory_stock_quantity_check" CHECK (("quantity" >= 0)),
    CONSTRAINT "inventory_stock_reserved_quantity_check" CHECK (("reserved_quantity" >= 0))
);


ALTER TABLE "public"."inventory_stock" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_transfer_batch_lines" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "source_previous_quantity" integer,
    "source_new_quantity" integer,
    "destination_previous_quantity" integer,
    "destination_new_quantity" integer,
    "received_by" "uuid",
    "received_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inventory_transfer_batch_lines_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "inventory_transfer_batch_lines_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'received'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."inventory_transfer_batch_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_transfer_batches" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "source_branch_id" "uuid" NOT NULL,
    "destination_branch_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "observations" "text",
    "total_lines" integer NOT NULL,
    "total_quantity" integer NOT NULL,
    "requested_by" "uuid",
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "received_by" "uuid",
    "received_at" timestamp with time zone,
    "idempotency_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reference_code" "text",
    CONSTRAINT "inventory_transfer_batches_distinct_branches" CHECK (("source_branch_id" <> "destination_branch_id")),
    CONSTRAINT "inventory_transfer_batches_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'received'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "inventory_transfer_batches_total_lines_check" CHECK (("total_lines" > 0)),
    CONSTRAINT "inventory_transfer_batches_total_quantity_check" CHECK (("total_quantity" > 0))
);


ALTER TABLE "public"."inventory_transfer_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_transfers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "source_branch_id" "uuid" NOT NULL,
    "destination_branch_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "observations" "text",
    "requested_by" "uuid" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "received_by" "uuid",
    "received_at" timestamp with time zone,
    "cancelled_by" "uuid",
    "cancelled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reference_code" "text",
    CONSTRAINT "inventory_transfers_distinct_branches" CHECK (("source_branch_id" <> "destination_branch_id")),
    CONSTRAINT "inventory_transfers_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "inventory_transfers_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'received'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."inventory_transfers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "whatsapp_enabled" boolean DEFAULT false,
    "whatsapp_phone_id" "text",
    "whatsapp_access_token" "text",
    "whatsapp_business_account_id" "text",
    "send_sale_receipt" boolean DEFAULT true,
    "send_appointment_confirmation" boolean DEFAULT true,
    "send_appointment_reminder" boolean DEFAULT true,
    "send_appointment_status_change" boolean DEFAULT true,
    "reminder_minutes_before" integer DEFAULT 60,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "notification_type" "text" NOT NULL,
    "whatsapp_template_name" "text" NOT NULL,
    "template_body" "text" NOT NULL,
    "variables" "jsonb" DEFAULT '[]'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notification_templates_notification_type_check" CHECK (("notification_type" = ANY (ARRAY['sale_receipt'::"text", 'appointment_confirmation'::"text", 'appointment_reminder'::"text", 'appointment_status_change'::"text"])))
);


ALTER TABLE "public"."notification_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "notification_type" "text" NOT NULL,
    "channel" "text" DEFAULT 'whatsapp'::"text" NOT NULL,
    "recipient_phone" "text" NOT NULL,
    "recipient_name" "text",
    "template_id" "uuid",
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "whatsapp_message_id" "text",
    "error_message" "text",
    "retry_count" integer DEFAULT 0,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notifications_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text", 'delivered'::"text", 'read'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."onboarding_progress" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid",
    "current_step" "text",
    "progress_data" "jsonb" DEFAULT '{}'::"jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "onboarding_progress_current_step_check" CHECK (("current_step" = ANY (ARRAY['registration'::"text", 'verification'::"text", 'organization'::"text", 'payment'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."onboarding_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_business_types" (
    "organization_id" "uuid" NOT NULL,
    "business_type" "public"."business_type_enum" NOT NULL
);


ALTER TABLE "public"."organization_business_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_siat_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "razon_social" "text",
    "nit" "text",
    "regimen_tributario" "text",
    "actividad_economica" "text",
    "sucursal_siat" "text",
    "direccion_matriz" "text",
    "codigo_autorizacion" "text",
    "punto_venta" "text",
    "sistema_facturacion" "text",
    "codigo_sistema" "text",
    "resolucion_numero" "text",
    "is_active" boolean DEFAULT false,
    "last_sync_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "organization_siat_config_regimen_tributario_check" CHECK (("regimen_tributario" = ANY (ARRAY['general'::"text", 'simplificado'::"text", 'especial'::"text"]))),
    CONSTRAINT "organization_siat_config_sistema_facturacion_check" CHECK (("sistema_facturacion" = ANY (ARRAY['propio'::"text", 'terceros'::"text", 'siat_linea'::"text"])))
);


ALTER TABLE "public"."organization_siat_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."organization_siat_config" IS 'Configuracion SIAT para emision de facturas en linea Bolivia';



CREATE TABLE IF NOT EXISTS "public"."organization_storefront_entitlements" (
    "organization_id" "uuid" NOT NULL,
    "can_view" boolean DEFAULT false NOT NULL,
    "can_manage" boolean DEFAULT false NOT NULL,
    "can_publish" boolean DEFAULT false NOT NULL,
    "can_custom_colors" boolean DEFAULT false NOT NULL,
    "max_sites" integer DEFAULT 0 NOT NULL,
    "template_keys" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organization_storefront_entitlements_max_sites_check" CHECK (("max_sites" >= 0))
);


ALTER TABLE "public"."organization_storefront_entitlements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_storefront_settings" (
    "organization_id" "uuid" NOT NULL,
    "business_type" "public"."business_type_enum" DEFAULT 'product'::"public"."business_type_enum" NOT NULL,
    "template_key" "text" NOT NULL,
    "color_preset_key" "text" DEFAULT 'neutral'::"text" NOT NULL,
    "primary_color" "text" DEFAULT '#111827'::"text" NOT NULL,
    "secondary_color" "text" DEFAULT '#F3F4F6'::"text" NOT NULL,
    "accent_color" "text" DEFAULT '#2563EB'::"text" NOT NULL,
    "company_description" "text",
    "is_published" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hero_image_url" "text",
    CONSTRAINT "organization_storefront_settings_accent_color_check" CHECK (("accent_color" ~ '^#[0-9A-Fa-f]{6}$'::"text")),
    CONSTRAINT "organization_storefront_settings_primary_color_check" CHECK (("primary_color" ~ '^#[0-9A-Fa-f]{6}$'::"text")),
    CONSTRAINT "organization_storefront_settings_secondary_color_check" CHECK (("secondary_color" ~ '^#[0-9A-Fa-f]{6}$'::"text"))
);


ALTER TABLE "public"."organization_storefront_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_subscriptions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "status" "public"."sub_status" DEFAULT 'trial'::"public"."sub_status",
    "current_period_start" timestamp with time zone DEFAULT "now"(),
    "current_period_end" timestamp with time zone NOT NULL,
    "provider_subscription_id" "text",
    "cancel_at_period_end" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "billing_mode" "text" DEFAULT 'monthly'::"text",
    "payment_method" "text",
    "trial_ends_at" timestamp with time zone,
    "is_trial" boolean DEFAULT false NOT NULL,
    "invoice_name" "text",
    "doc_type" "text",
    "doc_number" "text",
    CONSTRAINT "organization_subscriptions_billing_mode_check" CHECK (("billing_mode" = ANY (ARRAY['monthly'::"text", 'quarterly'::"text", 'annual'::"text"]))),
    CONSTRAINT "organization_subscriptions_doc_type_check" CHECK (("doc_type" = ANY (ARRAY['nit'::"text", 'ci'::"text", 'pasaporte'::"text", 'cedula'::"text"]))),
    CONSTRAINT "organization_subscriptions_payment_method_check" CHECK ((("payment_method" IS NULL) OR ("payment_method" = ANY (ARRAY['tarjeta'::"text", 'efectivo'::"text", 'transferencia'::"text", 'qr'::"text"]))))
);


ALTER TABLE "public"."organization_subscriptions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."organization_subscriptions"."invoice_name" IS 'Nombre que aparece en la factura';



COMMENT ON COLUMN "public"."organization_subscriptions"."doc_type" IS 'Tipo de documento para facturacion';



COMMENT ON COLUMN "public"."organization_subscriptions"."doc_number" IS 'Numero de documento para facturacion';



CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "currency_code" character(3) DEFAULT 'USD'::"bpchar",
    "timezone" "text" DEFAULT 'UTC'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "logo_url" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "country" character varying(2),
    "slug" "text",
    "address" "text",
    "billing_data" "jsonb",
    "default_receipt_format" "text",
    "lodging_checkout_deadline" time without time zone DEFAULT '12:00:00'::time without time zone,
    "lodging_stay_cutoff_time" time without time zone DEFAULT '12:00:00'::time without time zone,
    "lodging_late_checkout_penalty" numeric(12,2) DEFAULT 0,
    CONSTRAINT "organizations_currency_code_check" CHECK (("length"("currency_code") = 3)),
    CONSTRAINT "organizations_default_receipt_format_check" CHECK (("default_receipt_format" = ANY (ARRAY['thermal'::"text", 'half_letter'::"text"]))),
    CONSTRAINT "organizations_lodging_late_checkout_penalty_check" CHECK (("lodging_late_checkout_penalty" >= (0)::numeric)),
    CONSTRAINT "organizations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'suspended'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pos_number_sequences" (
    "organization_id" "uuid" NOT NULL,
    "sales_order_last" bigint DEFAULT 0 NOT NULL,
    "proforma_last" bigint DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pos_number_sequences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "sku" "text",
    "name" "text" NOT NULL,
    "description" "text",
    "cost_price" numeric(12,2) DEFAULT 0,
    "sale_price" numeric(12,2) NOT NULL,
    "category_id" "uuid",
    "track_inventory" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "image_url" "text",
    CONSTRAINT "products_cost_price_check" CHECK (("cost_price" >= (0)::numeric)),
    CONSTRAINT "products_sale_price_check" CHECK (("sale_price" >= (0)::numeric))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_client_map" (
    "profile_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profile_client_map" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "organization_id" "uuid",
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "role" "public"."user_role" DEFAULT 'client'::"public"."user_role",
    "avatar_url" "text",
    "phone" "text",
    "is_active" boolean DEFAULT true,
    "last_login_at" timestamp with time zone,
    "trial_consumed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "role_id" "uuid",
    CONSTRAINT "valid_role_org" CHECK (((("role" = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role", 'employee'::"public"."user_role"])) AND ("organization_id" IS NOT NULL)) OR ("role" = 'client'::"public"."user_role")))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reservation_guests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "reservation_room_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "document_type" "text",
    "document_number" "text",
    "address" "text",
    "phone" "text",
    "email" "text",
    "nationality" "text",
    "is_main_guest" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "birth_date" "date",
    "sex" "text",
    "marital_status" "text",
    CONSTRAINT "reservation_guests_sex_check" CHECK ((("sex" IS NULL) OR ("sex" = ANY (ARRAY['male'::"text", 'female'::"text", 'other'::"text"]))))
);


ALTER TABLE "public"."reservation_guests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reservation_payments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "reservation_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "payment_method" "text" NOT NULL,
    "payment_type" "text" NOT NULL,
    "reference" "text",
    "notes" "text",
    "paid_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reservation_payments_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "reservation_payments_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['cash'::"text", 'card'::"text", 'transfer'::"text", 'qr'::"text", 'digital_wallet'::"text"]))),
    CONSTRAINT "reservation_payments_payment_type_check" CHECK (("payment_type" = ANY (ARRAY['deposit'::"text", 'balance'::"text", 'full'::"text"])))
);


ALTER TABLE "public"."reservation_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reservation_rooms" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "reservation_id" "uuid" NOT NULL,
    "room_id" "uuid" NOT NULL,
    "room_price" numeric(12,2) NOT NULL,
    "subtotal" numeric(12,2) NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reservation_rooms_room_price_check" CHECK (("room_price" >= (0)::numeric)),
    CONSTRAINT "reservation_rooms_subtotal_check" CHECK (("subtotal" >= (0)::numeric))
);


ALTER TABLE "public"."reservation_rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reservations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "check_in" "date" NOT NULL,
    "check_out" "date" NOT NULL,
    "nights" integer GENERATED ALWAYS AS (("check_out" - "check_in")) STORED,
    "status" "public"."reservation_status" DEFAULT 'pending'::"public"."reservation_status",
    "total_amount" numeric(12,2) NOT NULL,
    "paid_amount" numeric(12,2) DEFAULT 0,
    "source" "text" DEFAULT 'staff'::"text",
    "notes" "text",
    "cancellation_reason" "text",
    "cancelled_at" timestamp with time zone,
    "cancelled_by" "uuid",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "actual_check_in_at" timestamp with time zone,
    "actual_check_out_at" timestamp with time zone,
    "is_open_ended" boolean DEFAULT false NOT NULL,
    "extended_from_check_out" "date",
    "extension_notes" "text",
    CONSTRAINT "reservations_paid_amount_check" CHECK (("paid_amount" >= (0)::numeric)),
    CONSTRAINT "reservations_source_check" CHECK (("source" = 'staff'::"text")),
    CONSTRAINT "reservations_total_amount_check" CHECK (("total_amount" >= (0)::numeric)),
    CONSTRAINT "valid_actual_stay" CHECK ((("actual_check_out_at" IS NULL) OR ("actual_check_in_at" IS NULL) OR ("actual_check_out_at" >= "actual_check_in_at"))),
    CONSTRAINT "valid_cancellation" CHECK (((("status" = ANY (ARRAY['cancelled'::"public"."reservation_status", 'no_show'::"public"."reservation_status"])) AND ("cancelled_by" IS NOT NULL)) OR ("status" <> ALL (ARRAY['cancelled'::"public"."reservation_status", 'no_show'::"public"."reservation_status"])))),
    CONSTRAINT "valid_dates" CHECK (("check_out" > "check_in")),
    CONSTRAINT "valid_paid" CHECK (("paid_amount" <= "total_amount"))
);


ALTER TABLE "public"."reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_module_permissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "role_id" "uuid" NOT NULL,
    "module_key" "text" NOT NULL,
    "can_view" boolean DEFAULT false NOT NULL,
    "can_create" boolean DEFAULT false NOT NULL,
    "can_edit" boolean DEFAULT false NOT NULL,
    "can_delete" boolean DEFAULT false NOT NULL,
    "can_export" boolean DEFAULT false NOT NULL,
    "can_manage" boolean DEFAULT false NOT NULL,
    "can_approve" boolean DEFAULT false NOT NULL,
    "can_assign" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."role_module_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."room_types" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "base_price" numeric(12,2) NOT NULL,
    "max_guests" integer NOT NULL,
    "amenities" "jsonb" DEFAULT '[]'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "room_types_base_price_check" CHECK (("base_price" >= (0)::numeric)),
    CONSTRAINT "room_types_max_guests_check" CHECK (("max_guests" > 0))
);


ALTER TABLE "public"."room_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rooms" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "room_number" "text" NOT NULL,
    "floor" integer,
    "status" "public"."room_status" DEFAULT 'available'::"public"."room_status",
    "notes" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "category_id" "uuid" NOT NULL,
    "base_price" numeric(12,2) DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sales_order_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "item_type" "text" NOT NULL,
    "product_id" "uuid",
    "service_id" "uuid",
    "employee_id" "uuid",
    "scheduled_date" "text",
    "scheduled_time" "text",
    "quantity" integer NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "subtotal" numeric(12,2) NOT NULL,
    "snapshot_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sales_order_items_check" CHECK (((("item_type" = 'product'::"text") AND ("product_id" IS NOT NULL) AND ("service_id" IS NULL)) OR (("item_type" = 'service'::"text") AND ("service_id" IS NOT NULL) AND ("product_id" IS NULL)))),
    CONSTRAINT "sales_order_items_item_type_check" CHECK (("item_type" = ANY (ARRAY['product'::"text", 'service'::"text"]))),
    CONSTRAINT "sales_order_items_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "sales_order_items_subtotal_check" CHECK (("subtotal" >= (0)::numeric)),
    CONSTRAINT "sales_order_items_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."sales_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "sales_order_number" bigint NOT NULL,
    "created_by" "uuid" NOT NULL,
    "customer_mode" "text" NOT NULL,
    "customer_id" "uuid",
    "customer_full_name" "text" NOT NULL,
    "customer_phone" "text",
    "customer_email" "text",
    "discount_type" "text" DEFAULT 'none'::"text" NOT NULL,
    "discount_value" numeric(12,2) DEFAULT 0 NOT NULL,
    "subtotal" numeric(12,2) DEFAULT 0 NOT NULL,
    "discount_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "tax_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "final_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "note" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "charged_transaction_id" "uuid",
    "charged_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sales_orders_customer_mode_check" CHECK (("customer_mode" = ANY (ARRAY['existing'::"text", 'walk_in'::"text"]))),
    CONSTRAINT "sales_orders_discount_amount_check" CHECK (("discount_amount" >= (0)::numeric)),
    CONSTRAINT "sales_orders_discount_type_check" CHECK (("discount_type" = ANY (ARRAY['none'::"text", 'percentage'::"text", 'fixed'::"text"]))),
    CONSTRAINT "sales_orders_discount_value_check" CHECK (("discount_value" >= (0)::numeric)),
    CONSTRAINT "sales_orders_final_amount_check" CHECK (("final_amount" >= (0)::numeric)),
    CONSTRAINT "sales_orders_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'ready_to_charge'::"text", 'charged'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "sales_orders_subtotal_check" CHECK (("subtotal" >= (0)::numeric)),
    CONSTRAINT "sales_orders_tax_amount_check" CHECK (("tax_amount" >= (0)::numeric))
);


ALTER TABLE "public"."sales_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_proformas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "sales_order_id" "uuid" NOT NULL,
    "proforma_number" bigint NOT NULL,
    "status" "text" DEFAULT 'issued'::"text" NOT NULL,
    "snapshot" "jsonb" NOT NULL,
    "issued_by" "uuid" NOT NULL,
    "issued_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "consumed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sales_proformas_status_check" CHECK (("status" = ANY (ARRAY['issued'::"text", 'cancelled'::"text", 'consumed'::"text"])))
);


ALTER TABLE "public"."sales_proformas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "duration_minutes" integer NOT NULL,
    "price" numeric(12,2) NOT NULL,
    "category_id" "uuid",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "image_url" "text",
    CONSTRAINT "services_duration_minutes_check" CHECK (("duration_minutes" > 0)),
    CONSTRAINT "services_price_check" CHECK (("price" >= (0)::numeric))
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_plans" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "price_monthly" numeric(10,2) NOT NULL,
    "price_yearly" numeric(10,2) NOT NULL,
    "max_branches" integer DEFAULT 1 NOT NULL,
    "max_users" integer DEFAULT 5 NOT NULL,
    "max_storage_mb" integer DEFAULT 1000,
    "feature_multi_branch" boolean DEFAULT false,
    "feature_manager_role" boolean DEFAULT false,
    "feature_inventory_transfer" boolean DEFAULT false,
    "feature_api_access" boolean DEFAULT false,
    "feature_white_label" boolean DEFAULT false,
    "feature_advanced_reports" boolean DEFAULT false,
    "feature_forensic_export" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "business_only" boolean DEFAULT false NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "resume" "text" DEFAULT ''::"text" NOT NULL,
    "features" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "permissions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "limits" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "available_billing_modes" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "trial" boolean DEFAULT false NOT NULL,
    "trial_duration" integer,
    "feature_hotel_module" boolean DEFAULT false,
    "allowed_business_types" "public"."business_type_enum"[] DEFAULT '{product,service,lodging}'::"public"."business_type_enum"[],
    "max_business_types" integer DEFAULT 1,
    CONSTRAINT "subscription_plans_trial_duration_check" CHECK (((("trial" = true) AND ("trial_duration" IS NOT NULL) AND ("trial_duration" > 0)) OR (("trial" = false) AND ("trial_duration" IS NULL))))
);


ALTER TABLE "public"."subscription_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_role_module_permissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "system_role" "text" NOT NULL,
    "module_key" "text" NOT NULL,
    "can_view" boolean DEFAULT false NOT NULL,
    "can_create" boolean DEFAULT false NOT NULL,
    "can_edit" boolean DEFAULT false NOT NULL,
    "can_delete" boolean DEFAULT false NOT NULL,
    "can_export" boolean DEFAULT false NOT NULL,
    "can_manage" boolean DEFAULT false NOT NULL,
    "can_approve" boolean DEFAULT false NOT NULL,
    "can_assign" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "system_role_module_permissions_system_role_check" CHECK (("system_role" = ANY (ARRAY['system'::"text", 'support'::"text"])))
);


ALTER TABLE "public"."system_role_module_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_users" (
    "user_id" "uuid" NOT NULL,
    "full_name" "text",
    "email" "text",
    "role" "text" DEFAULT 'system'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "permissions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "system_users_role_check" CHECK (("role" = 'system'::"text"))
);


ALTER TABLE "public"."system_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transaction_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "service_id" "uuid",
    "quantity" integer NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "subtotal" numeric(12,2) NOT NULL,
    "item_type" "text" NOT NULL,
    "snapshot_data" "jsonb",
    "appointment_id" "uuid",
    CONSTRAINT "transaction_items_item_type_check" CHECK (("item_type" = ANY (ARRAY['product'::"text", 'service'::"text"]))),
    CONSTRAINT "transaction_items_quantity_check" CHECK (("quantity" <> 0)),
    CONSTRAINT "transaction_items_subtotal_check" CHECK (("subtotal" >= (0)::numeric)),
    CONSTRAINT "transaction_items_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."transaction_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."transaction_items"."appointment_id" IS 'ID of the appointment linked to this line item. NULL for products or services sold without scheduling.';



CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "invoice_number" integer NOT NULL,
    "customer_id" "uuid",
    "employee_id" "uuid" NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "discount_amount" numeric(12,2) DEFAULT 0,
    "tax_amount" numeric(12,2) DEFAULT 0,
    "final_amount" numeric(12,2) NOT NULL,
    "payment_method" "public"."payment_method" DEFAULT 'cash'::"public"."payment_method",
    "type" "public"."transaction_type" DEFAULT 'sale'::"public"."transaction_type",
    "status" "text" DEFAULT 'completed'::"text",
    "refund_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "transactions_discount_amount_check" CHECK (("discount_amount" >= (0)::numeric)),
    CONSTRAINT "transactions_final_amount_check" CHECK (("final_amount" >= (0)::numeric)),
    CONSTRAINT "transactions_status_check" CHECK (("status" = ANY (ARRAY['completed'::"text", 'refunded'::"text", 'voided'::"text"]))),
    CONSTRAINT "transactions_tax_amount_check" CHECK (("tax_amount" >= (0)::numeric)),
    CONSTRAINT "transactions_total_amount_check" CHECK (("total_amount" >= (0)::numeric)),
    CONSTRAINT "valid_math" CHECK (("final_amount" = (("total_amount" - "discount_amount") + "tax_amount")))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."transactions_invoice_number_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."transactions_invoice_number_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."transactions_invoice_number_seq" OWNED BY "public"."transactions"."invoice_number";



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "code" "public"."user_role" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "is_system" boolean DEFAULT true NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."transactions" ALTER COLUMN "invoice_number" SET DEFAULT "nextval"('"public"."transactions_invoice_number_seq"'::"regclass");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_ledger"
    ADD CONSTRAINT "billing_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_organization_id_code_key" UNIQUE ("organization_id", "code");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_organization_id_name_type_key" UNIQUE ("organization_id", "name", "type");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_org_billing_history"
    ADD CONSTRAINT "client_org_billing_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_org"
    ADD CONSTRAINT "client_org_pkey" PRIMARY KEY ("client_id", "organization_id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_branch_assignments"
    ADD CONSTRAINT "employee_branch_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_branch_assignments"
    ADD CONSTRAINT "employee_branch_assignments_user_id_branch_id_key" UNIQUE ("user_id", "branch_id");



ALTER TABLE ONLY "public"."guest_customers"
    ADD CONSTRAINT "guest_customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_adjust_batches"
    ADD CONSTRAINT "inventory_adjust_batches_organization_id_idempotency_key_key" UNIQUE ("organization_id", "idempotency_key");



ALTER TABLE ONLY "public"."inventory_adjust_batches"
    ADD CONSTRAINT "inventory_adjust_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_document_sequences"
    ADD CONSTRAINT "inventory_document_sequences_pkey" PRIMARY KEY ("organization_id", "doc_type", "seq_year");



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_stock"
    ADD CONSTRAINT "inventory_stock_branch_id_product_id_key" UNIQUE ("branch_id", "product_id");



ALTER TABLE ONLY "public"."inventory_stock"
    ADD CONSTRAINT "inventory_stock_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_transfer_batch_lines"
    ADD CONSTRAINT "inventory_transfer_batch_lines_batch_id_product_id_key" UNIQUE ("batch_id", "product_id");



ALTER TABLE ONLY "public"."inventory_transfer_batch_lines"
    ADD CONSTRAINT "inventory_transfer_batch_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_transfer_batches"
    ADD CONSTRAINT "inventory_transfer_batches_organization_id_idempotency_key_key" UNIQUE ("organization_id", "idempotency_key");



ALTER TABLE ONLY "public"."inventory_transfer_batches"
    ADD CONSTRAINT "inventory_transfer_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_transfers"
    ADD CONSTRAINT "inventory_transfers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_organization_id_key" UNIQUE ("organization_id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_templates"
    ADD CONSTRAINT "notification_templates_organization_id_notification_type_key" UNIQUE ("organization_id", "notification_type");



ALTER TABLE ONLY "public"."notification_templates"
    ADD CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onboarding_progress"
    ADD CONSTRAINT "onboarding_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onboarding_progress"
    ADD CONSTRAINT "onboarding_progress_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."organization_business_types"
    ADD CONSTRAINT "organization_business_types_pkey" PRIMARY KEY ("organization_id", "business_type");



ALTER TABLE ONLY "public"."organization_siat_config"
    ADD CONSTRAINT "organization_siat_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_storefront_entitlements"
    ADD CONSTRAINT "organization_storefront_entitlements_pkey" PRIMARY KEY ("organization_id");



ALTER TABLE ONLY "public"."organization_storefront_settings"
    ADD CONSTRAINT "organization_storefront_settings_pkey" PRIMARY KEY ("organization_id");



ALTER TABLE ONLY "public"."organization_subscriptions"
    ADD CONSTRAINT "organization_subscriptions_organization_id_key" UNIQUE ("organization_id");



ALTER TABLE ONLY "public"."organization_subscriptions"
    ADD CONSTRAINT "organization_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_validations"
    ADD CONSTRAINT "payment_validations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pos_number_sequences"
    ADD CONSTRAINT "pos_number_sequences_pkey" PRIMARY KEY ("organization_id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_client_map"
    ADD CONSTRAINT "profile_client_map_pkey" PRIMARY KEY ("profile_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reservation_guests"
    ADD CONSTRAINT "reservation_guests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reservation_payments"
    ADD CONSTRAINT "reservation_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reservation_rooms"
    ADD CONSTRAINT "reservation_rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reservation_rooms"
    ADD CONSTRAINT "reservation_rooms_reservation_id_room_id_key" UNIQUE ("reservation_id", "room_id");



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_module_permissions"
    ADD CONSTRAINT "role_module_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_module_permissions"
    ADD CONSTRAINT "role_module_permissions_role_id_module_key_key" UNIQUE ("role_id", "module_key");



ALTER TABLE ONLY "public"."room_types"
    ADD CONSTRAINT "room_types_organization_id_name_key" UNIQUE ("organization_id", "name");



ALTER TABLE ONLY "public"."room_types"
    ADD CONSTRAINT "room_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_organization_id_branch_id_room_number_key" UNIQUE ("organization_id", "branch_id", "room_number");



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_organization_id_sales_order_number_key" UNIQUE ("organization_id", "sales_order_number");



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_proformas"
    ADD CONSTRAINT "sales_proformas_organization_id_proforma_number_key" UNIQUE ("organization_id", "proforma_number");



ALTER TABLE ONLY "public"."sales_proformas"
    ADD CONSTRAINT "sales_proformas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."system_role_module_permissions"
    ADD CONSTRAINT "system_role_module_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_role_module_permissions"
    ADD CONSTRAINT "system_role_module_permissions_system_role_module_key_key" UNIQUE ("system_role", "module_key");



ALTER TABLE ONLY "public"."system_users"
    ADD CONSTRAINT "system_users_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."transaction_items"
    ADD CONSTRAINT "transaction_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_siat_config"
    ADD CONSTRAINT "unique_org_siat" UNIQUE ("organization_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_appointments_branch" ON "public"."appointments" USING "btree" ("branch_id");



CREATE INDEX "idx_appointments_branch_employee_time" ON "public"."appointments" USING "btree" ("branch_id", "employee_id", "start_time");



CREATE INDEX "idx_appointments_employee" ON "public"."appointments" USING "btree" ("employee_id");



CREATE INDEX "idx_appointments_org_branch_start_time" ON "public"."appointments" USING "btree" ("organization_id", "branch_id", "start_time" DESC);



CREATE INDEX "idx_appointments_org_employee_start_time" ON "public"."appointments" USING "btree" ("organization_id", "employee_id", "start_time" DESC);



CREATE INDEX "idx_appointments_org_start_time" ON "public"."appointments" USING "btree" ("organization_id", "start_time" DESC);



CREATE INDEX "idx_appointments_source" ON "public"."appointments" USING "btree" ("source");



CREATE INDEX "idx_appointments_status" ON "public"."appointments" USING "btree" ("status");



CREATE INDEX "idx_appointments_time_range" ON "public"."appointments" USING "gist" ("tstzrange"("start_time", "end_time"));



CREATE INDEX "idx_appointments_transaction_id" ON "public"."appointments" USING "btree" ("transaction_id");



CREATE INDEX "idx_audit_logs_table" ON "public"."audit_logs" USING "btree" ("table_name", "record_id");



CREATE INDEX "idx_audit_logs_time" ON "public"."audit_logs" USING "btree" ("logged_at" DESC);



CREATE INDEX "idx_audit_logs_user" ON "public"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "idx_billing_ledger_created" ON "public"."billing_ledger" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_billing_ledger_org" ON "public"."billing_ledger" USING "btree" ("organization_id");



CREATE INDEX "idx_client_org_billing_history_org_client" ON "public"."client_org_billing_history" USING "btree" ("organization_id", "client_id", "changed_at" DESC);



CREATE INDEX "idx_client_org_client_id" ON "public"."client_org" USING "btree" ("client_id");



CREATE INDEX "idx_client_org_organization_id" ON "public"."client_org" USING "btree" ("organization_id");



CREATE INDEX "idx_clients_user_id" ON "public"."clients" USING "btree" ("user_id");



CREATE INDEX "idx_employee_assignments_branch" ON "public"."employee_branch_assignments" USING "btree" ("branch_id");



CREATE INDEX "idx_employee_assignments_user" ON "public"."employee_branch_assignments" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_employee_branch_assignments_one_primary_per_user" ON "public"."employee_branch_assignments" USING "btree" ("user_id") WHERE ("is_primary" = true);



CREATE INDEX "idx_guest_customers_branch" ON "public"."guest_customers" USING "btree" ("branch_id");



CREATE INDEX "idx_guest_customers_org" ON "public"."guest_customers" USING "btree" ("organization_id");



CREATE INDEX "idx_guest_customers_phone" ON "public"."guest_customers" USING "btree" ("phone");



CREATE INDEX "idx_inventory_adjust_batches_org_created_at" ON "public"."inventory_adjust_batches" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_inventory_movements_branch_time" ON "public"."inventory_movements" USING "btree" ("branch_id", "created_at" DESC);



CREATE INDEX "idx_inventory_movements_org_time" ON "public"."inventory_movements" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_inventory_movements_product_time" ON "public"."inventory_movements" USING "btree" ("product_id", "created_at" DESC);



CREATE INDEX "idx_inventory_stock_branch_product" ON "public"."inventory_stock" USING "btree" ("branch_id", "product_id");



CREATE INDEX "idx_inventory_transfer_batch_lines_batch" ON "public"."inventory_transfer_batch_lines" USING "btree" ("batch_id", "status");



CREATE INDEX "idx_inventory_transfer_batches_org_status" ON "public"."inventory_transfer_batches" USING "btree" ("organization_id", "status", "requested_at" DESC);



CREATE INDEX "idx_inventory_transfers_destination_status" ON "public"."inventory_transfers" USING "btree" ("destination_branch_id", "status");



CREATE INDEX "idx_inventory_transfers_org_requested_at" ON "public"."inventory_transfers" USING "btree" ("organization_id", "requested_at" DESC);



CREATE INDEX "idx_inventory_transfers_status" ON "public"."inventory_transfers" USING "btree" ("status");



CREATE INDEX "idx_notification_preferences_org" ON "public"."notification_preferences" USING "btree" ("organization_id");



CREATE INDEX "idx_notification_templates_org" ON "public"."notification_templates" USING "btree" ("organization_id");



CREATE INDEX "idx_notifications_org_created" ON "public"."notifications" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_notifications_status" ON "public"."notifications" USING "btree" ("status");



CREATE INDEX "idx_notifications_type" ON "public"."notifications" USING "btree" ("notification_type");



CREATE INDEX "idx_onboarding_progress_user" ON "public"."onboarding_progress" USING "btree" ("user_id");



CREATE INDEX "idx_org_branches" ON "public"."branches" USING "btree" ("organization_id");



CREATE INDEX "idx_org_sub_active" ON "public"."organization_subscriptions" USING "btree" ("organization_id", "status");



CREATE INDEX "idx_organization_storefront_settings_published" ON "public"."organization_storefront_settings" USING "btree" ("is_published");



CREATE INDEX "idx_organizations_country" ON "public"."organizations" USING "btree" ("country");



CREATE INDEX "idx_payment_validations_method" ON "public"."payment_validations" USING "btree" ("payment_method");



CREATE INDEX "idx_payment_validations_org" ON "public"."payment_validations" USING "btree" ("organization_id", "status");



CREATE INDEX "idx_payment_validations_org_status" ON "public"."payment_validations" USING "btree" ("organization_id", "status", "created_at" DESC);



CREATE INDEX "idx_payment_validations_reviewed_system" ON "public"."payment_validations" USING "btree" ("reviewed_by_system_user", "reviewed_at" DESC);



CREATE INDEX "idx_payment_validations_status" ON "public"."payment_validations" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_products_org" ON "public"."products" USING "btree" ("organization_id");



CREATE UNIQUE INDEX "idx_products_unique_sku" ON "public"."products" USING "btree" ("organization_id", "sku") WHERE ("sku" IS NOT NULL);



CREATE INDEX "idx_profiles_org" ON "public"."profiles" USING "btree" ("organization_id");



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_profiles_role_id" ON "public"."profiles" USING "btree" ("role_id");



CREATE INDEX "idx_reservation_guests_room" ON "public"."reservation_guests" USING "btree" ("reservation_room_id");



CREATE INDEX "idx_reservation_payments_org" ON "public"."reservation_payments" USING "btree" ("organization_id");



CREATE INDEX "idx_reservation_payments_reservation" ON "public"."reservation_payments" USING "btree" ("reservation_id");



CREATE INDEX "idx_reservation_rooms_reservation" ON "public"."reservation_rooms" USING "btree" ("reservation_id");



CREATE INDEX "idx_reservation_rooms_room" ON "public"."reservation_rooms" USING "btree" ("room_id");



CREATE INDEX "idx_reservations_date_range" ON "public"."reservations" USING "btree" ("branch_id", "check_in", "check_out");



CREATE INDEX "idx_reservations_org_branch" ON "public"."reservations" USING "btree" ("organization_id", "branch_id");



CREATE INDEX "idx_reservations_status" ON "public"."reservations" USING "btree" ("status");



CREATE INDEX "idx_role_module_permissions_module" ON "public"."role_module_permissions" USING "btree" ("module_key");



CREATE INDEX "idx_role_module_permissions_role" ON "public"."role_module_permissions" USING "btree" ("role_id");



CREATE INDEX "idx_room_types_org" ON "public"."room_types" USING "btree" ("organization_id");



CREATE INDEX "idx_rooms_branch_status" ON "public"."rooms" USING "btree" ("branch_id", "status");



CREATE INDEX "idx_rooms_category" ON "public"."rooms" USING "btree" ("category_id");



CREATE INDEX "idx_rooms_org_branch" ON "public"."rooms" USING "btree" ("organization_id", "branch_id");



CREATE INDEX "idx_sales_order_items_order" ON "public"."sales_order_items" USING "btree" ("sales_order_id");



CREATE INDEX "idx_sales_orders_branch_status" ON "public"."sales_orders" USING "btree" ("branch_id", "status");



CREATE INDEX "idx_sales_orders_org_status" ON "public"."sales_orders" USING "btree" ("organization_id", "status");



CREATE INDEX "idx_sales_proformas_org_status" ON "public"."sales_proformas" USING "btree" ("organization_id", "status");



CREATE INDEX "idx_services_org" ON "public"."services" USING "btree" ("organization_id");



CREATE INDEX "idx_siat_config_org" ON "public"."organization_siat_config" USING "btree" ("organization_id");



CREATE INDEX "idx_stock_branch" ON "public"."inventory_stock" USING "btree" ("branch_id");



CREATE INDEX "idx_stock_product" ON "public"."inventory_stock" USING "btree" ("product_id");



CREATE INDEX "idx_system_role_module_permissions_module" ON "public"."system_role_module_permissions" USING "btree" ("module_key");



CREATE INDEX "idx_system_role_module_permissions_role" ON "public"."system_role_module_permissions" USING "btree" ("system_role");



CREATE INDEX "idx_transaction_items_appointment_id" ON "public"."transaction_items" USING "btree" ("appointment_id");



CREATE INDEX "idx_transaction_items_product_id" ON "public"."transaction_items" USING "btree" ("product_id") WHERE ("product_id" IS NOT NULL);



CREATE INDEX "idx_transaction_items_service_id" ON "public"."transaction_items" USING "btree" ("service_id") WHERE ("service_id" IS NOT NULL);



CREATE INDEX "idx_transaction_items_transaction" ON "public"."transaction_items" USING "btree" ("transaction_id");



CREATE INDEX "idx_transaction_items_transaction_type" ON "public"."transaction_items" USING "btree" ("transaction_id", "item_type");



CREATE INDEX "idx_transactions_branch_date" ON "public"."transactions" USING "btree" ("branch_id", "created_at");



CREATE INDEX "idx_transactions_org" ON "public"."transactions" USING "btree" ("organization_id");



CREATE INDEX "idx_transactions_org_branch_created_at" ON "public"."transactions" USING "btree" ("organization_id", "branch_id", "created_at" DESC);



CREATE INDEX "idx_transactions_org_created_at" ON "public"."transactions" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_transactions_org_employee_created_at" ON "public"."transactions" USING "btree" ("organization_id", "employee_id", "created_at" DESC);



CREATE INDEX "idx_user_roles_active" ON "public"."user_roles" USING "btree" ("is_active");



CREATE INDEX "idx_user_roles_code" ON "public"."user_roles" USING "btree" ("code");



CREATE UNIQUE INDEX "ux_client_org_billing_history_active" ON "public"."client_org_billing_history" USING "btree" ("organization_id", "client_id") WHERE ("is_active_version" = true);



CREATE UNIQUE INDEX "ux_client_org_one_anonymous_template" ON "public"."client_org" USING "btree" ("organization_id") WHERE (("is_anonymous_template" = true) AND ("status" = 'active'::"text"));



CREATE UNIQUE INDEX "ux_client_org_org_doc_unique" ON "public"."client_org" USING "btree" ("organization_id", "document_type", "document_number") WHERE (("document_type" = ANY (ARRAY['NIT'::"text", 'CI'::"text"])) AND ("document_number" IS NOT NULL));



CREATE UNIQUE INDEX "ux_clients_email_not_null" ON "public"."clients" USING "btree" ("email") WHERE ("email" IS NOT NULL);



CREATE UNIQUE INDEX "ux_clients_phone_not_null" ON "public"."clients" USING "btree" ("phone") WHERE ("phone" IS NOT NULL);



CREATE OR REPLACE TRIGGER "audit_appointments" AFTER INSERT OR DELETE OR UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger_func"();



CREATE OR REPLACE TRIGGER "audit_branches" AFTER INSERT OR DELETE OR UPDATE ON "public"."branches" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger_func"();



CREATE OR REPLACE TRIGGER "audit_inventory" AFTER INSERT OR DELETE OR UPDATE ON "public"."inventory_stock" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger_func"();



CREATE OR REPLACE TRIGGER "audit_profiles" AFTER INSERT OR DELETE OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger_func"();



CREATE OR REPLACE TRIGGER "audit_reservations" AFTER INSERT OR DELETE OR UPDATE ON "public"."reservations" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger_func"();



CREATE OR REPLACE TRIGGER "audit_room_types" AFTER INSERT OR DELETE OR UPDATE ON "public"."room_types" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger_func"();



CREATE OR REPLACE TRIGGER "audit_rooms" AFTER INSERT OR DELETE OR UPDATE ON "public"."rooms" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger_func"();



CREATE OR REPLACE TRIGGER "audit_transactions" AFTER INSERT OR DELETE OR UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger_func"();



CREATE OR REPLACE TRIGGER "organization_audit_trigger" AFTER INSERT ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."audit_organization_creation"();



CREATE OR REPLACE TRIGGER "organization_storefront_entitlements_set_updated_at" BEFORE UPDATE ON "public"."organization_storefront_entitlements" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "organization_storefront_settings_set_updated_at" BEFORE UPDATE ON "public"."organization_storefront_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_client_org_billing_history" AFTER INSERT OR UPDATE ON "public"."client_org" FOR EACH ROW EXECUTE FUNCTION "public"."sync_client_org_billing_history"();



CREATE OR REPLACE TRIGGER "trg_enforce_branch_limit" BEFORE INSERT ON "public"."branches" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_limit"();



CREATE OR REPLACE TRIGGER "trg_notify_admin_receipt" AFTER INSERT ON "public"."payment_validations" FOR EACH ROW EXECUTE FUNCTION "public"."notify_admin_new_receipt"();



CREATE OR REPLACE TRIGGER "trg_organizations_ensure_anonymous_customer_template" AFTER INSERT ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."trg_ensure_org_anonymous_customer_template"();



CREATE OR REPLACE TRIGGER "trg_sync_profile_role_columns" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_profile_role_columns"();



CREATE OR REPLACE TRIGGER "update_appt_updated_at" BEFORE UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_branch_updated_at" BEFORE UPDATE ON "public"."branches" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_category_updated_at" BEFORE UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_client_org_updated_at" BEFORE UPDATE ON "public"."client_org" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_clients_updated_at" BEFORE UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_inventory_transfer_updated_at" BEFORE UPDATE ON "public"."inventory_transfers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_org_updated_at" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_payment_validations_updated_at" BEFORE UPDATE ON "public"."payment_validations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_product_updated_at" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profile_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_reservation_updated_at" BEFORE UPDATE ON "public"."reservations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_room_type_updated_at" BEFORE UPDATE ON "public"."room_types" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_room_updated_at" BEFORE UPDATE ON "public"."rooms" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_service_updated_at" BEFORE UPDATE ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_stock_updated_at" BEFORE UPDATE ON "public"."inventory_stock" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_sub_updated_at" BEFORE UPDATE ON "public"."organization_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."billing_ledger"
    ADD CONSTRAINT "billing_ledger_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."billing_ledger"
    ADD CONSTRAINT "billing_ledger_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_ledger"
    ADD CONSTRAINT "billing_ledger_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_org_billing_history"
    ADD CONSTRAINT "client_org_billing_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_org_billing_history"
    ADD CONSTRAINT "client_org_billing_history_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_org_billing_history"
    ADD CONSTRAINT "client_org_billing_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_org"
    ADD CONSTRAINT "client_org_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_org"
    ADD CONSTRAINT "client_org_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."employee_branch_assignments"
    ADD CONSTRAINT "employee_branch_assignments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_branch_assignments"
    ADD CONSTRAINT "employee_branch_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guest_customers"
    ADD CONSTRAINT "guest_customers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."guest_customers"
    ADD CONSTRAINT "guest_customers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."guest_customers"
    ADD CONSTRAINT "guest_customers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_adjust_batches"
    ADD CONSTRAINT "inventory_adjust_batches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_adjust_batches"
    ADD CONSTRAINT "inventory_adjust_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_adjust_batches"
    ADD CONSTRAINT "inventory_adjust_batches_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_document_sequences"
    ADD CONSTRAINT "inventory_document_sequences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_destination_branch_id_fkey" FOREIGN KEY ("destination_branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_source_branch_id_fkey" FOREIGN KEY ("source_branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_stock"
    ADD CONSTRAINT "inventory_stock_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_stock"
    ADD CONSTRAINT "inventory_stock_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_transfer_batch_lines"
    ADD CONSTRAINT "inventory_transfer_batch_lines_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."inventory_transfer_batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_transfer_batch_lines"
    ADD CONSTRAINT "inventory_transfer_batch_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_transfer_batch_lines"
    ADD CONSTRAINT "inventory_transfer_batch_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_transfer_batch_lines"
    ADD CONSTRAINT "inventory_transfer_batch_lines_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_transfer_batches"
    ADD CONSTRAINT "inventory_transfer_batches_destination_branch_id_fkey" FOREIGN KEY ("destination_branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_transfer_batches"
    ADD CONSTRAINT "inventory_transfer_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_transfer_batches"
    ADD CONSTRAINT "inventory_transfer_batches_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_transfer_batches"
    ADD CONSTRAINT "inventory_transfer_batches_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_transfer_batches"
    ADD CONSTRAINT "inventory_transfer_batches_source_branch_id_fkey" FOREIGN KEY ("source_branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_transfers"
    ADD CONSTRAINT "inventory_transfers_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_transfers"
    ADD CONSTRAINT "inventory_transfers_destination_branch_id_fkey" FOREIGN KEY ("destination_branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_transfers"
    ADD CONSTRAINT "inventory_transfers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_transfers"
    ADD CONSTRAINT "inventory_transfers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_transfers"
    ADD CONSTRAINT "inventory_transfers_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_transfers"
    ADD CONSTRAINT "inventory_transfers_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_transfers"
    ADD CONSTRAINT "inventory_transfers_source_branch_id_fkey" FOREIGN KEY ("source_branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_templates"
    ADD CONSTRAINT "notification_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("id");



ALTER TABLE ONLY "public"."onboarding_progress"
    ADD CONSTRAINT "onboarding_progress_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."onboarding_progress"
    ADD CONSTRAINT "onboarding_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_business_types"
    ADD CONSTRAINT "organization_business_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_siat_config"
    ADD CONSTRAINT "organization_siat_config_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_storefront_entitlements"
    ADD CONSTRAINT "organization_storefront_entitlements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_storefront_settings"
    ADD CONSTRAINT "organization_storefront_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_subscriptions"
    ADD CONSTRAINT "organization_subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_subscriptions"
    ADD CONSTRAINT "organization_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id");



ALTER TABLE ONLY "public"."payment_validations"
    ADD CONSTRAINT "payment_validations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_validations"
    ADD CONSTRAINT "payment_validations_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."payment_validations"
    ADD CONSTRAINT "payment_validations_reviewed_by_system_user_fkey" FOREIGN KEY ("reviewed_by_system_user") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."payment_validations"
    ADD CONSTRAINT "payment_validations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pos_number_sequences"
    ADD CONSTRAINT "pos_number_sequences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_client_map"
    ADD CONSTRAINT "profile_client_map_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_client_map"
    ADD CONSTRAINT "profile_client_map_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."user_roles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reservation_guests"
    ADD CONSTRAINT "reservation_guests_reservation_room_id_fkey" FOREIGN KEY ("reservation_room_id") REFERENCES "public"."reservation_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reservation_payments"
    ADD CONSTRAINT "reservation_payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reservation_payments"
    ADD CONSTRAINT "reservation_payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reservation_payments"
    ADD CONSTRAINT "reservation_payments_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reservation_rooms"
    ADD CONSTRAINT "reservation_rooms_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reservation_rooms"
    ADD CONSTRAINT "reservation_rooms_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_module_permissions"
    ADD CONSTRAINT "role_module_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."user_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."room_types"
    ADD CONSTRAINT "room_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_category_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_charged_transaction_id_fkey" FOREIGN KEY ("charged_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_proformas"
    ADD CONSTRAINT "sales_proformas_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."sales_proformas"
    ADD CONSTRAINT "sales_proformas_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."sales_proformas"
    ADD CONSTRAINT "sales_proformas_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_proformas"
    ADD CONSTRAINT "sales_proformas_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."system_users"
    ADD CONSTRAINT "system_users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."system_users"
    ADD CONSTRAINT "system_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_items"
    ADD CONSTRAINT "transaction_items_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transaction_items"
    ADD CONSTRAINT "transaction_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."transaction_items"
    ADD CONSTRAINT "transaction_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."transaction_items"
    ADD CONSTRAINT "transaction_items_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can view audit logs" ON "public"."audit_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."profiles" "p"
     JOIN "public"."organization_subscriptions" "os" ON (("p"."organization_id" = "os"."organization_id")))
     JOIN "public"."subscription_plans" "sp" ON (("os"."plan_id" = "sp"."id")))
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role") AND ("sp"."feature_forensic_export" = true)))));



CREATE POLICY "Appointments select" ON "public"."appointments" FOR SELECT USING ((("organization_id" = "public"."get_user_organization_id"()) AND (("public"."get_user_role"() = 'admin'::"public"."user_role") OR ("branch_id" = "public"."get_user_branch_id"()) OR "public"."is_user_assigned_to_branch"("branch_id") OR ("employee_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("customer_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Authenticated users can create pending organizations" ON "public"."organizations" FOR INSERT WITH CHECK (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("status" = 'pending'::"text") AND (NOT (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."organization_id" IS NOT NULL)))))));



CREATE POLICY "Authenticated users can insert onboarding and dashboard audit l" ON "public"."audit_logs" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("table_name" = ANY (ARRAY['auth_sessions'::"text", 'payment_validations'::"text", 'onboarding_success'::"text", 'dashboard_blocked_features'::"text", 'pending_route_guard'::"text"])) AND ("action" = 'INSERT'::"public"."audit_action")));



CREATE POLICY "Branch access control" ON "public"."branches" USING ((("organization_id" = "public"."get_user_organization_id"()) AND (("public"."get_user_role"() = 'admin'::"public"."user_role") OR ("id" = "public"."get_user_branch_id"()) OR "public"."is_user_assigned_to_branch"("id"))));



CREATE POLICY "Categories select" ON "public"."categories" FOR SELECT USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Client org history insert" ON "public"."client_org_billing_history" FOR INSERT WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Client org history select" ON "public"."client_org_billing_history" FOR SELECT USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Client org select by linked client user" ON "public"."client_org" FOR SELECT USING ((("organization_id" = "public"."get_user_organization_id"()) OR ("client_id" IN ( SELECT "c"."id"
   FROM "public"."clients" "c"
  WHERE ("c"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Clients select own user profile" ON "public"."clients" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Clients update own user profile" ON "public"."clients" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Employee assignments select" ON "public"."employee_branch_assignments" FOR SELECT USING ((("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role"])) AND "public"."is_branch_in_user_organization"("branch_id")));



CREATE POLICY "Guest customers org delete" ON "public"."guest_customers" FOR DELETE TO "authenticated" USING ((("organization_id" = ( SELECT "public"."get_user_organization_id"() AS "get_user_organization_id")) AND (( SELECT "public"."get_user_role"() AS "get_user_role") = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role", 'employee'::"public"."user_role"]))));



CREATE POLICY "Guest customers org insert" ON "public"."guest_customers" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" = ( SELECT "public"."get_user_organization_id"() AS "get_user_organization_id")) AND (( SELECT "public"."get_user_role"() AS "get_user_role") = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role", 'employee'::"public"."user_role"]))));



CREATE POLICY "Guest customers org select" ON "public"."guest_customers" FOR SELECT TO "authenticated" USING ((("organization_id" = ( SELECT "public"."get_user_organization_id"() AS "get_user_organization_id")) AND ((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"public"."user_role") OR ("branch_id" = ( SELECT "public"."get_user_branch_id"() AS "get_user_branch_id")) OR (("branch_id" IS NOT NULL) AND "public"."is_user_assigned_to_branch"("branch_id")))));



CREATE POLICY "Guest customers org update" ON "public"."guest_customers" FOR UPDATE TO "authenticated" USING ((("organization_id" = ( SELECT "public"."get_user_organization_id"() AS "get_user_organization_id")) AND (( SELECT "public"."get_user_role"() AS "get_user_role") = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role", 'employee'::"public"."user_role"])))) WITH CHECK ((("organization_id" = ( SELECT "public"."get_user_organization_id"() AS "get_user_organization_id")) AND (( SELECT "public"."get_user_role"() AS "get_user_role") = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role", 'employee'::"public"."user_role"]))));



CREATE POLICY "Inventory adjust batches select" ON "public"."inventory_adjust_batches" FOR SELECT USING (("organization_id" IN ( SELECT "profiles"."organization_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Inventory document sequences select" ON "public"."inventory_document_sequences" FOR SELECT USING (("organization_id" IN ( SELECT "profiles"."organization_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Inventory movements select" ON "public"."inventory_movements" FOR SELECT USING ((("organization_id" = "public"."get_user_organization_id"()) AND (("public"."get_user_role"() = 'admin'::"public"."user_role") OR ("branch_id" = "public"."get_user_branch_id"()) OR "public"."is_user_assigned_to_branch"("branch_id") OR (("source_branch_id" IS NOT NULL) AND "public"."is_user_assigned_to_branch"("source_branch_id")) OR (("destination_branch_id" IS NOT NULL) AND "public"."is_user_assigned_to_branch"("destination_branch_id")))));



CREATE POLICY "Inventory select" ON "public"."inventory_stock" FOR SELECT USING (("branch_id" IN ( SELECT "branches"."id"
   FROM "public"."branches"
  WHERE (("branches"."organization_id" = "public"."get_user_organization_id"()) AND (("public"."get_user_role"() = 'admin'::"public"."user_role") OR ("branches"."id" = "public"."get_user_branch_id"()) OR "public"."is_user_assigned_to_branch"("branches"."id"))))));



CREATE POLICY "Inventory transfer batch lines select" ON "public"."inventory_transfer_batch_lines" FOR SELECT USING (("organization_id" IN ( SELECT "profiles"."organization_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Inventory transfer batches select" ON "public"."inventory_transfer_batches" FOR SELECT USING (("organization_id" IN ( SELECT "profiles"."organization_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Inventory transfers select" ON "public"."inventory_transfers" FOR SELECT USING ((("organization_id" = "public"."get_user_organization_id"()) AND (("public"."get_user_role"() = 'admin'::"public"."user_role") OR ("source_branch_id" = "public"."get_user_branch_id"()) OR ("destination_branch_id" = "public"."get_user_branch_id"()) OR "public"."is_user_assigned_to_branch"("source_branch_id") OR "public"."is_user_assigned_to_branch"("destination_branch_id"))));



CREATE POLICY "Inventory update" ON "public"."inventory_stock" FOR UPDATE USING ((("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role"])) AND (("branch_id" = "public"."get_user_branch_id"()) OR "public"."is_user_assigned_to_branch"("branch_id"))));



CREATE POLICY "Notifications are insertable by service role" ON "public"."notifications" FOR INSERT TO "service_role" WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));



CREATE POLICY "Notifications are updatable by service role" ON "public"."notifications" FOR UPDATE TO "service_role" USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text")) WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));



CREATE POLICY "Notifications are viewable by organization members" ON "public"."notifications" FOR SELECT USING (("organization_id" IN ( SELECT "p"."organization_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Org admins can delete SIAT config" ON "public"."organization_siat_config" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."organization_id" = "organization_siat_config"."organization_id") AND ("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Org admins can insert SIAT config" ON "public"."organization_siat_config" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."organization_id" = "organization_siat_config"."organization_id") AND ("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Org admins can update SIAT config" ON "public"."organization_siat_config" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."organization_id" = "organization_siat_config"."organization_id") AND ("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."organization_id" = "organization_siat_config"."organization_id") AND ("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Org admins can view SIAT config" ON "public"."organization_siat_config" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."organization_id" = "organization_siat_config"."organization_id") AND ("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Org admins can view billing ledger" ON "public"."billing_ledger" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."organization_id" = "billing_ledger"."organization_id") AND ("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Org admins update payment validations" ON "public"."payment_validations" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."organization_id" = "payment_validations"."organization_id") AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Org admins view own payment validations" ON "public"."payment_validations" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."organization_id" = "payment_validations"."organization_id") AND ("p"."role" = 'admin'::"public"."user_role")))) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Org members update own org" ON "public"."organizations" FOR UPDATE TO "authenticated" USING (("id" = "public"."get_user_organization_id"())) WITH CHECK (("id" = "public"."get_user_organization_id"()));



CREATE POLICY "Org members view own org" ON "public"."organizations" FOR SELECT TO "authenticated" USING (("id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization business types delete" ON "public"."organization_business_types" FOR DELETE USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization business types insert" ON "public"."organization_business_types" FOR INSERT WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization business types select" ON "public"."organization_business_types" FOR SELECT USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "POS sequence staff select" ON "public"."pos_number_sequences" FOR SELECT USING ((("organization_id" = "public"."get_user_organization_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role", 'employee'::"public"."user_role"]))));



CREATE POLICY "Preferences are deletable by admins" ON "public"."notification_preferences" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "p"."organization_id"
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Preferences are insertable by admins" ON "public"."notification_preferences" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "p"."organization_id"
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Preferences are updatable by admins" ON "public"."notification_preferences" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "p"."organization_id"
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role"))))) WITH CHECK (("organization_id" IN ( SELECT "p"."organization_id"
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Preferences are viewable by organization members" ON "public"."notification_preferences" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "p"."organization_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Products select" ON "public"."products" FOR SELECT USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Profile client map own read" ON "public"."profile_client_map" FOR SELECT TO "authenticated" USING ((("profile_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."organization_id" = ( SELECT "pr"."organization_id"
           FROM "public"."profiles" "pr"
          WHERE ("pr"."id" = "profile_client_map"."profile_id"))) AND ("p"."role" = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role"])))))));



CREATE POLICY "Profile delete access" ON "public"."profiles" FOR DELETE TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR (("organization_id" = "public"."get_user_organization_id"()) AND (("public"."get_user_role"() = 'admin'::"public"."user_role") OR (("public"."get_user_role"() = 'manager'::"public"."user_role") AND (EXISTS ( SELECT 1
   FROM ("public"."employee_branch_assignments" "manager_assignment"
     JOIN "public"."employee_branch_assignments" "target_assignment" ON (("target_assignment"."branch_id" = "manager_assignment"."branch_id")))
  WHERE (("manager_assignment"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("target_assignment"."user_id" = "profiles"."id")))))))));



CREATE POLICY "Profile read access" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR (("organization_id" = "public"."get_user_organization_id"()) AND (("public"."get_user_role"() = 'admin'::"public"."user_role") OR (("public"."get_user_role"() = 'manager'::"public"."user_role") AND (EXISTS ( SELECT 1
   FROM ("public"."employee_branch_assignments" "manager_assignment"
     JOIN "public"."employee_branch_assignments" "target_assignment" ON (("target_assignment"."branch_id" = "manager_assignment"."branch_id")))
  WHERE (("manager_assignment"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("target_assignment"."user_id" = "profiles"."id")))))))));



CREATE POLICY "Profile update access" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR (("organization_id" = "public"."get_user_organization_id"()) AND (("public"."get_user_role"() = 'admin'::"public"."user_role") OR (("public"."get_user_role"() = 'manager'::"public"."user_role") AND (EXISTS ( SELECT 1
   FROM ("public"."employee_branch_assignments" "manager_assignment"
     JOIN "public"."employee_branch_assignments" "target_assignment" ON (("target_assignment"."branch_id" = "manager_assignment"."branch_id")))
  WHERE (("manager_assignment"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("target_assignment"."user_id" = "profiles"."id"))))))))) WITH CHECK ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR (("organization_id" = "public"."get_user_organization_id"()) AND (("public"."get_user_role"() = 'admin'::"public"."user_role") OR (("public"."get_user_role"() = 'manager'::"public"."user_role") AND (EXISTS ( SELECT 1
   FROM ("public"."employee_branch_assignments" "manager_assignment"
     JOIN "public"."employee_branch_assignments" "target_assignment" ON (("target_assignment"."branch_id" = "manager_assignment"."branch_id")))
  WHERE (("manager_assignment"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("target_assignment"."user_id" = "profiles"."id")))))))));



CREATE POLICY "Reservation guests insert" ON "public"."reservation_guests" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."reservation_rooms" "rr"
     JOIN "public"."reservations" "r" ON (("r"."id" = "rr"."reservation_id")))
  WHERE (("rr"."id" = "reservation_guests"."reservation_room_id") AND ("r"."organization_id" = "public"."get_user_organization_id"())))));



CREATE POLICY "Reservation guests select" ON "public"."reservation_guests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."reservation_rooms" "rr"
     JOIN "public"."reservations" "r" ON (("r"."id" = "rr"."reservation_id")))
  WHERE (("rr"."id" = "reservation_guests"."reservation_room_id") AND ("r"."organization_id" = "public"."get_user_organization_id"())))));



CREATE POLICY "Reservation guests update" ON "public"."reservation_guests" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."reservation_rooms" "rr"
     JOIN "public"."reservations" "r" ON (("r"."id" = "rr"."reservation_id")))
  WHERE (("rr"."id" = "reservation_guests"."reservation_room_id") AND ("r"."organization_id" = "public"."get_user_organization_id"())))));



CREATE POLICY "Reservation payments insert" ON "public"."reservation_payments" FOR INSERT WITH CHECK ((("organization_id" = "public"."get_user_organization_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role", 'employee'::"public"."user_role"]))));



CREATE POLICY "Reservation payments select" ON "public"."reservation_payments" FOR SELECT USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Reservation rooms insert" ON "public"."reservation_rooms" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."reservations"
  WHERE (("reservations"."id" = "reservation_rooms"."reservation_id") AND ("reservations"."organization_id" = "public"."get_user_organization_id"())))));



CREATE POLICY "Reservation rooms select" ON "public"."reservation_rooms" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."reservations"
  WHERE (("reservations"."id" = "reservation_rooms"."reservation_id") AND ("reservations"."organization_id" = "public"."get_user_organization_id"())))));



CREATE POLICY "Reservation rooms update" ON "public"."reservation_rooms" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."reservations"
  WHERE (("reservations"."id" = "reservation_rooms"."reservation_id") AND ("reservations"."organization_id" = "public"."get_user_organization_id"())))));



CREATE POLICY "Reservations delete" ON "public"."reservations" FOR DELETE USING ((("organization_id" = "public"."get_user_organization_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role"]))));



CREATE POLICY "Reservations insert" ON "public"."reservations" FOR INSERT WITH CHECK ((("organization_id" = "public"."get_user_organization_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role", 'employee'::"public"."user_role"]))));



CREATE POLICY "Reservations select" ON "public"."reservations" FOR SELECT USING ((("organization_id" = "public"."get_user_organization_id"()) AND (("public"."get_user_role"() = 'admin'::"public"."user_role") OR ("branch_id" = "public"."get_user_branch_id"()) OR "public"."is_user_assigned_to_branch"("branch_id"))));



CREATE POLICY "Reservations update" ON "public"."reservations" FOR UPDATE USING ((("organization_id" = "public"."get_user_organization_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role", 'employee'::"public"."user_role"]))));



CREATE POLICY "Role module permissions org read" ON "public"."role_module_permissions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role", 'employee'::"public"."user_role", 'client'::"public"."user_role"]))))));



CREATE POLICY "Room types delete" ON "public"."room_types" FOR DELETE USING ((("organization_id" = "public"."get_user_organization_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role"]))));



CREATE POLICY "Room types insert" ON "public"."room_types" FOR INSERT WITH CHECK ((("organization_id" = "public"."get_user_organization_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role"]))));



CREATE POLICY "Room types select" ON "public"."room_types" FOR SELECT USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Room types update" ON "public"."room_types" FOR UPDATE USING ((("organization_id" = "public"."get_user_organization_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role"]))));



CREATE POLICY "Rooms delete" ON "public"."rooms" FOR DELETE USING ((("organization_id" = "public"."get_user_organization_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role"]))));



CREATE POLICY "Rooms insert" ON "public"."rooms" FOR INSERT WITH CHECK ((("organization_id" = "public"."get_user_organization_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role"]))));



CREATE POLICY "Rooms select" ON "public"."rooms" FOR SELECT USING ((("organization_id" = "public"."get_user_organization_id"()) AND (("public"."get_user_role"() = 'admin'::"public"."user_role") OR ("branch_id" = "public"."get_user_branch_id"()) OR "public"."is_user_assigned_to_branch"("branch_id"))));



CREATE POLICY "Rooms update" ON "public"."rooms" FOR UPDATE USING ((("organization_id" = "public"."get_user_organization_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role"]))));



CREATE POLICY "Sales order items staff delete" ON "public"."sales_order_items" FOR DELETE TO "authenticated" USING ((("organization_id" = "public"."get_user_organization_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role", 'employee'::"public"."user_role"]))));



CREATE POLICY "Sales order items staff insert" ON "public"."sales_order_items" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" = "public"."get_user_organization_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role", 'employee'::"public"."user_role"]))));



CREATE POLICY "Sales order items staff select" ON "public"."sales_order_items" FOR SELECT TO "authenticated" USING ((("organization_id" = "public"."get_user_organization_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role", 'employee'::"public"."user_role"]))));



CREATE POLICY "Sales order items staff update" ON "public"."sales_order_items" FOR UPDATE TO "authenticated" USING ((("organization_id" = "public"."get_user_organization_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role", 'employee'::"public"."user_role"])))) WITH CHECK ((("organization_id" = "public"."get_user_organization_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role", 'employee'::"public"."user_role"]))));



CREATE POLICY "Sales orders staff delete" ON "public"."sales_orders" FOR DELETE TO "authenticated" USING ((("organization_id" = "public"."get_user_organization_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role", 'employee'::"public"."user_role"]))));



CREATE POLICY "Sales orders staff insert" ON "public"."sales_orders" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" = "public"."get_user_organization_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role", 'employee'::"public"."user_role"]))));



CREATE POLICY "Sales orders staff select" ON "public"."sales_orders" FOR SELECT TO "authenticated" USING ((("organization_id" = "public"."get_user_organization_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role", 'employee'::"public"."user_role"]))));



CREATE POLICY "Sales orders staff update" ON "public"."sales_orders" FOR UPDATE TO "authenticated" USING ((("organization_id" = "public"."get_user_organization_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role", 'employee'::"public"."user_role"])))) WITH CHECK ((("organization_id" = "public"."get_user_organization_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role", 'employee'::"public"."user_role"]))));



CREATE POLICY "Sales proformas staff delete" ON "public"."sales_proformas" FOR DELETE TO "authenticated" USING ((("organization_id" = "public"."get_user_organization_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role", 'employee'::"public"."user_role"]))));



CREATE POLICY "Sales proformas staff insert" ON "public"."sales_proformas" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" = "public"."get_user_organization_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role", 'employee'::"public"."user_role"]))));



CREATE POLICY "Sales proformas staff select" ON "public"."sales_proformas" FOR SELECT TO "authenticated" USING ((("organization_id" = "public"."get_user_organization_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role", 'employee'::"public"."user_role"]))));



CREATE POLICY "Sales proformas staff update" ON "public"."sales_proformas" FOR UPDATE TO "authenticated" USING ((("organization_id" = "public"."get_user_organization_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role", 'employee'::"public"."user_role"])))) WITH CHECK ((("organization_id" = "public"."get_user_organization_id"()) AND ("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role", 'employee'::"public"."user_role"]))));



CREATE POLICY "Service role can insert billing ledger" ON "public"."billing_ledger" FOR INSERT TO "service_role" WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));



CREATE POLICY "Services select" ON "public"."services" FOR SELECT USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Subscription plans authenticated read" ON "public"."subscription_plans" FOR SELECT TO "authenticated" USING (COALESCE("is_active", true));



CREATE POLICY "Subscriptions admin only" ON "public"."organization_subscriptions" USING ((("public"."get_user_role"() = 'admin'::"public"."user_role") AND ("public"."get_user_organization_id"() = "organization_id")));



CREATE POLICY "System role module permissions system read" ON "public"."system_role_module_permissions" FOR SELECT TO "authenticated" USING ("public"."is_system_user"(( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "System users can read their own membership" ON "public"."system_users" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND ("is_active" = true)));



CREATE POLICY "Templates are deletable by admins" ON "public"."notification_templates" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "p"."organization_id"
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Templates are insertable by admins" ON "public"."notification_templates" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "p"."organization_id"
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Templates are updatable by admins" ON "public"."notification_templates" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "p"."organization_id"
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role"))))) WITH CHECK (("organization_id" IN ( SELECT "p"."organization_id"
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Templates are viewable by organization members" ON "public"."notification_templates" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "p"."organization_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Transactions select" ON "public"."transactions" FOR SELECT USING ((("organization_id" = "public"."get_user_organization_id"()) AND (("public"."get_user_role"() = 'admin'::"public"."user_role") OR ("branch_id" = "public"."get_user_branch_id"()) OR "public"."is_user_assigned_to_branch"("branch_id") OR ("employee_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "User roles authenticated read" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Users can insert own profile during onboarding" ON "public"."profiles" FOR INSERT WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users insert own payment validations" ON "public"."payment_validations" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users manage own onboarding progress" ON "public"."onboarding_progress" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."billing_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."branches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_org" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_org_billing_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_branch_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."guest_customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_adjust_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_document_sequences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_movements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_stock" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_transfer_batch_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_transfer_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_transfers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."onboarding_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_business_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_siat_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_storefront_entitlements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_storefront_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_validations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pos_number_sequences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_client_map" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reservation_guests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reservation_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reservation_rooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reservations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."role_module_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."room_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sales_order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sales_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sales_proformas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_role_module_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transaction_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."admin_get_payment_validation_detail"("p_validation_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_get_payment_validation_detail"("p_validation_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_list_payment_validations"("p_search" "text", "p_status" "text", "p_date_from" "date", "p_date_to" "date", "p_page" integer, "p_page_size" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_payment_validations"("p_search" "text", "p_status" "text", "p_date_from" "date", "p_date_to" "date", "p_page" integer, "p_page_size" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_payment_validation_stats"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_payment_validation_stats"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_review_payment_validation"("p_validation_id" "uuid", "p_decision" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_review_payment_validation"("p_validation_id" "uuid", "p_decision" "text", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_inventory_stock_mutation"("p_branch_id" "uuid", "p_product_id" "uuid", "p_mode" "text", "p_quantity" integer, "p_min_stock_level" integer, "p_require_available" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_inventory_stock_mutation"("p_branch_id" "uuid", "p_product_id" "uuid", "p_mode" "text", "p_quantity" integer, "p_min_stock_level" integer, "p_require_available" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."audit_organization_creation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."audit_organization_creation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."audit_trigger_func"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."audit_trigger_func"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_subscription_limit"("org_id" "uuid", "resource_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_subscription_limit"("org_id" "uuid", "resource_type" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_onboarding_organization"("p_name" "text", "p_country" "text", "p_address" "text", "p_full_name" "text", "p_email" "text", "p_phone" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_onboarding_organization"("p_name" "text", "p_country" "text", "p_address" "text", "p_full_name" "text", "p_email" "text", "p_phone" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_onboarding_organization"("p_name" "text", "p_slug" "text", "p_timezone" "text", "p_currency" "text", "p_address" "text", "p_billing_data" "jsonb", "p_full_name" "text", "p_email" "text", "p_phone" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_onboarding_organization"("p_name" "text", "p_slug" "text", "p_timezone" "text", "p_currency" "text", "p_address" "text", "p_billing_data" "jsonb", "p_full_name" "text", "p_email" "text", "p_phone" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_onboarding_organization"("p_name" "text", "p_business_type" "text", "p_country" "text", "p_currency" "text", "p_timezone" "text", "p_billing_mode" "text", "p_full_name" "text", "p_email" "text", "p_phone" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_onboarding_organization"("p_name" "text", "p_business_type" "text", "p_country" "text", "p_currency" "text", "p_timezone" "text", "p_billing_mode" "text", "p_full_name" "text", "p_email" "text", "p_phone" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_onboarding_organization"("p_name" "text", "p_business_types" "public"."business_type_enum"[], "p_country" "text", "p_currency" "text", "p_timezone" "text", "p_billing_mode" "text", "p_full_name" "text", "p_email" "text", "p_phone" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_onboarding_organization"("p_name" "text", "p_business_types" "public"."business_type_enum"[], "p_country" "text", "p_currency" "text", "p_timezone" "text", "p_billing_mode" "text", "p_full_name" "text", "p_email" "text", "p_phone" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_onboarding_organization"("p_name" "text", "p_business_type" "text", "p_country" "text", "p_currency" "text", "p_timezone" "text", "p_billing_mode" "text", "p_slug" "text", "p_address" "text", "p_billing_data" "jsonb", "p_full_name" "text", "p_email" "text", "p_phone" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_onboarding_organization"("p_name" "text", "p_business_type" "text", "p_country" "text", "p_currency" "text", "p_timezone" "text", "p_billing_mode" "text", "p_slug" "text", "p_address" "text", "p_billing_data" "jsonb", "p_full_name" "text", "p_email" "text", "p_phone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_branch_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_branch_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_branch_limit"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."ensure_org_anonymous_customer_template"("p_organization_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ensure_org_anonymous_customer_template"("p_organization_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_account_status_snapshot"("p_organization_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_account_status_snapshot"("p_organization_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_organization_capabilities"("input_org_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_organization_capabilities"("input_org_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_branch_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_branch_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_branch_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_organization_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_organization_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_organization_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_role"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."inventory_adjust_batch_execute"("p_organization_id" "uuid", "p_user_id" "uuid", "p_idempotency_key" "text", "p_branch_id" "uuid", "p_mode" "text", "p_reason" "text", "p_reference_code" "text", "p_note" "text", "p_lines" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."inventory_adjust_batch_execute"("p_organization_id" "uuid", "p_user_id" "uuid", "p_idempotency_key" "text", "p_branch_id" "uuid", "p_mode" "text", "p_reason" "text", "p_reference_code" "text", "p_note" "text", "p_lines" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."inventory_adjust_batch_precheck"("p_organization_id" "uuid", "p_branch_id" "uuid", "p_mode" "text", "p_lines" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."inventory_adjust_batch_precheck"("p_organization_id" "uuid", "p_branch_id" "uuid", "p_mode" "text", "p_lines" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."inventory_transfer_batch_create"("p_organization_id" "uuid", "p_user_id" "uuid", "p_idempotency_key" "text", "p_source_branch_id" "uuid", "p_destination_branch_id" "uuid", "p_observations" "text", "p_reference_code" "text", "p_lines" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."inventory_transfer_batch_create"("p_organization_id" "uuid", "p_user_id" "uuid", "p_idempotency_key" "text", "p_source_branch_id" "uuid", "p_destination_branch_id" "uuid", "p_observations" "text", "p_reference_code" "text", "p_lines" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."inventory_transfer_batch_precheck"("p_organization_id" "uuid", "p_source_branch_id" "uuid", "p_destination_branch_id" "uuid", "p_lines" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."inventory_transfer_batch_precheck"("p_organization_id" "uuid", "p_source_branch_id" "uuid", "p_destination_branch_id" "uuid", "p_lines" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."inventory_transfer_batch_receive"("p_organization_id" "uuid", "p_user_id" "uuid", "p_batch_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."inventory_transfer_batch_receive"("p_organization_id" "uuid", "p_user_id" "uuid", "p_batch_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_branch_in_user_organization"("target_branch_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_branch_in_user_organization"("target_branch_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_branch_in_user_organization"("target_branch_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_system_user"("input_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_system_user"("input_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_user_assigned_to_branch"("target_branch_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_user_assigned_to_branch"("target_branch_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_user_assigned_to_branch"("target_branch_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."next_inventory_document_code"("p_organization_id" "uuid", "p_doc_type" "text", "p_prefix" "text", "p_year" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."next_inventory_document_code"("p_organization_id" "uuid", "p_doc_type" "text", "p_prefix" "text", "p_year" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."next_proforma_number"("p_organization_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."next_proforma_number"("p_organization_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."next_sales_order_number"("p_organization_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."next_sales_order_number"("p_organization_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_admin_new_receipt"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_admin_new_receipt"() TO "service_role";



GRANT ALL ON FUNCTION "public"."plan_billing_mode_enabled"("p_available_billing_modes" "jsonb", "p_billing_mode" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."plan_billing_mode_enabled"("p_available_billing_modes" "jsonb", "p_billing_mode" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."plan_billing_mode_enabled"("p_available_billing_modes" "jsonb", "p_billing_mode" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_client_org_billing_history"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_client_org_billing_history"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_profile_role_columns"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_profile_role_columns"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_profile_role_columns"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_ensure_org_anonymous_customer_template"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_ensure_org_anonymous_customer_template"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."payment_validations" TO "anon";
GRANT ALL ON TABLE "public"."payment_validations" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_validations" TO "service_role";



GRANT ALL ON TABLE "public"."admin_payment_stats" TO "anon";
GRANT ALL ON TABLE "public"."admin_payment_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_payment_stats" TO "service_role";



GRANT ALL ON TABLE "public"."appointments" TO "anon";
GRANT ALL ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."billing_ledger" TO "anon";
GRANT ALL ON TABLE "public"."billing_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."branches" TO "anon";
GRANT ALL ON TABLE "public"."branches" TO "authenticated";
GRANT ALL ON TABLE "public"."branches" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."client_org" TO "anon";
GRANT ALL ON TABLE "public"."client_org" TO "authenticated";
GRANT ALL ON TABLE "public"."client_org" TO "service_role";



GRANT ALL ON TABLE "public"."client_org_billing_history" TO "anon";
GRANT ALL ON TABLE "public"."client_org_billing_history" TO "authenticated";
GRANT ALL ON TABLE "public"."client_org_billing_history" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."employee_branch_assignments" TO "anon";
GRANT ALL ON TABLE "public"."employee_branch_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_branch_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."guest_customers" TO "anon";
GRANT ALL ON TABLE "public"."guest_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."guest_customers" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_adjust_batches" TO "anon";
GRANT ALL ON TABLE "public"."inventory_adjust_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_adjust_batches" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_document_sequences" TO "anon";
GRANT ALL ON TABLE "public"."inventory_document_sequences" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_document_sequences" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_movements" TO "anon";
GRANT ALL ON TABLE "public"."inventory_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_movements" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_stock" TO "anon";
GRANT ALL ON TABLE "public"."inventory_stock" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_stock" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_transfer_batch_lines" TO "anon";
GRANT ALL ON TABLE "public"."inventory_transfer_batch_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_transfer_batch_lines" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_transfer_batches" TO "anon";
GRANT ALL ON TABLE "public"."inventory_transfer_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_transfer_batches" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_transfers" TO "anon";
GRANT ALL ON TABLE "public"."inventory_transfers" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_transfers" TO "service_role";



GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."notification_templates" TO "anon";
GRANT ALL ON TABLE "public"."notification_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_templates" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."onboarding_progress" TO "anon";
GRANT ALL ON TABLE "public"."onboarding_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."onboarding_progress" TO "service_role";



GRANT ALL ON TABLE "public"."organization_business_types" TO "anon";
GRANT ALL ON TABLE "public"."organization_business_types" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_business_types" TO "service_role";



GRANT ALL ON TABLE "public"."organization_siat_config" TO "anon";
GRANT ALL ON TABLE "public"."organization_siat_config" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_siat_config" TO "service_role";



GRANT ALL ON TABLE "public"."organization_storefront_entitlements" TO "anon";
GRANT ALL ON TABLE "public"."organization_storefront_entitlements" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_storefront_entitlements" TO "service_role";



GRANT ALL ON TABLE "public"."organization_storefront_settings" TO "anon";
GRANT ALL ON TABLE "public"."organization_storefront_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_storefront_settings" TO "service_role";



GRANT ALL ON TABLE "public"."organization_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."organization_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."pos_number_sequences" TO "anon";
GRANT ALL ON TABLE "public"."pos_number_sequences" TO "authenticated";
GRANT ALL ON TABLE "public"."pos_number_sequences" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profile_client_map" TO "anon";
GRANT ALL ON TABLE "public"."profile_client_map" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_client_map" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."reservation_guests" TO "anon";
GRANT ALL ON TABLE "public"."reservation_guests" TO "authenticated";
GRANT ALL ON TABLE "public"."reservation_guests" TO "service_role";



GRANT ALL ON TABLE "public"."reservation_payments" TO "anon";
GRANT ALL ON TABLE "public"."reservation_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."reservation_payments" TO "service_role";



GRANT ALL ON TABLE "public"."reservation_rooms" TO "anon";
GRANT ALL ON TABLE "public"."reservation_rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."reservation_rooms" TO "service_role";



GRANT ALL ON TABLE "public"."reservations" TO "anon";
GRANT ALL ON TABLE "public"."reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."reservations" TO "service_role";



GRANT ALL ON TABLE "public"."role_module_permissions" TO "anon";
GRANT ALL ON TABLE "public"."role_module_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_module_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."room_types" TO "anon";
GRANT ALL ON TABLE "public"."room_types" TO "authenticated";
GRANT ALL ON TABLE "public"."room_types" TO "service_role";



GRANT ALL ON TABLE "public"."rooms" TO "anon";
GRANT ALL ON TABLE "public"."rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."rooms" TO "service_role";



GRANT ALL ON TABLE "public"."sales_order_items" TO "anon";
GRANT ALL ON TABLE "public"."sales_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."sales_orders" TO "anon";
GRANT ALL ON TABLE "public"."sales_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_orders" TO "service_role";



GRANT ALL ON TABLE "public"."sales_proformas" TO "anon";
GRANT ALL ON TABLE "public"."sales_proformas" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_proformas" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_plans" TO "anon";
GRANT ALL ON TABLE "public"."subscription_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_plans" TO "service_role";



GRANT ALL ON TABLE "public"."system_role_module_permissions" TO "anon";
GRANT ALL ON TABLE "public"."system_role_module_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."system_role_module_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."system_users" TO "anon";
GRANT ALL ON TABLE "public"."system_users" TO "authenticated";
GRANT ALL ON TABLE "public"."system_users" TO "service_role";



GRANT ALL ON TABLE "public"."transaction_items" TO "anon";
GRANT ALL ON TABLE "public"."transaction_items" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction_items" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."transactions_invoice_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."transactions_invoice_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."transactions_invoice_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



























