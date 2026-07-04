-- Ensure each organization has one active anonymous customer template.
-- This is the source-of-truth policy at SQL level (independent of caller path/RPC).

create or replace function public.ensure_org_anonymous_customer_template(
  p_organization_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
    'Anónimo',
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
    'Cliente Anónimo',
    null,
    null,
    'sin_documento',
    null,
    true
  )
  on conflict (client_id, organization_id) do update
  set status = excluded.status,
      is_anonymous_template = true,
      billing_data = coalesce(public.client_org.billing_data, '{}'::jsonb),
      updated_at = now();
end;
$$;

create or replace function public.trg_ensure_org_anonymous_customer_template()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_org_anonymous_customer_template(new.id);
  return new;
end;
$$;

drop trigger if exists trg_organizations_ensure_anonymous_customer_template on public.organizations;
create trigger trg_organizations_ensure_anonymous_customer_template
after insert on public.organizations
for each row
execute function public.trg_ensure_org_anonymous_customer_template();

-- Backfill idempotently for already existing organizations.
do $$
declare
  org_row record;
begin
  for org_row in
    select id from public.organizations
  loop
    perform public.ensure_org_anonymous_customer_template(org_row.id);
  end loop;
end $$;
