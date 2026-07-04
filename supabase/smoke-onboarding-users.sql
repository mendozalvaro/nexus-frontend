begin;

create or replace function pg_temp.seed_auth_user(
  p_id uuid,
  p_email text,
  p_password text,
  p_full_name text,
  p_role text default 'admin'
) returns void
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at,
    is_sso_user,
    deleted_at,
    is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000',
    p_id,
    'authenticated',
    'authenticated',
    lower(trim(p_email)),
    crypt(p_password, gen_salt('bf')),
    now(),
    now(),
    '',
    now(),
    '',
    null,
    '',
    '',
    null,
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', p_role),
    jsonb_build_object('full_name', p_full_name, 'role', p_role),
    false,
    now(),
    now(),
    null,
    null,
    '',
    '',
    null,
    '',
    0,
    null,
    '',
    null,
    false,
    null,
    false
  )
  on conflict (id) do update
  set
    email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    raw_user_meta_data = excluded.raw_user_meta_data,
    raw_app_meta_data = excluded.raw_app_meta_data,
    email_confirmed_at = now(),
    updated_at = now(),
    deleted_at = null,
    banned_until = null,
    is_anonymous = false;

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    p_id,
    p_id,
    jsonb_build_object('sub', p_id::text, 'email', lower(trim(p_email))),
    'email',
    lower(trim(p_email)),
    now(),
    now(),
    now()
  )
  on conflict (id) do update
  set
    user_id = excluded.user_id,
    identity_data = excluded.identity_data,
    provider = excluded.provider,
    provider_id = excluded.provider_id,
    last_sign_in_at = now(),
    updated_at = now();
end;
$$;

select pg_temp.seed_auth_user(
  '3d9f1111-1111-4111-8111-111111111111',
  'smoke.onboarding.trial@nexuspos.demo',
  'Demo123456!',
  'Smoke Trial',
  'admin'
);

select pg_temp.seed_auth_user(
  '3d9f2222-2222-4222-8222-222222222222',
  'smoke.onboarding.paid@nexuspos.demo',
  'Demo123456!',
  'Smoke Paid',
  'admin'
);

select pg_temp.seed_auth_user(
  '3d9f3333-3333-4333-8333-333333333333',
  'smoke.onboarding.reuse@nexuspos.demo',
  'Demo123456!',
  'Smoke Reuse',
  'client'
);

insert into public.profiles (
  id,
  organization_id,
  full_name,
  email,
  role,
  phone,
  is_active,
  created_at,
  updated_at,
  trial_consumed_at
) values (
  '3d9f3333-3333-4333-8333-333333333333',
  null,
  'Smoke Reuse',
  'smoke.onboarding.reuse@nexuspos.demo',
  'client',
  null,
  true,
  now(),
  now(),
  now()
)
on conflict (id) do update
set
  organization_id = null,
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  is_active = true,
  trial_consumed_at = now(),
  updated_at = now();

delete from public.onboarding_progress
where user_id in (
  '3d9f1111-1111-4111-8111-111111111111',
  '3d9f2222-2222-4222-8222-222222222222',
  '3d9f3333-3333-4333-8333-333333333333'
);

delete from public.profiles
where id in (
  '3d9f1111-1111-4111-8111-111111111111',
  '3d9f2222-2222-4222-8222-222222222222'
)
and organization_id is null;

commit;
