select jsonb_build_object(
  'profile', (
    select to_jsonb(x)
    from (
      select
        p.id,
        p.email,
        p.role,
        p.role_id,
        p.organization_id
      from profiles p
      where p.email = 'resprogreso@gmail.com'
    ) x
  ),
  'role_permissions', (
    select coalesce(jsonb_agg(to_jsonb(rmp) order by rmp.module_key), '[]'::jsonb)
    from role_module_permissions rmp
    where rmp.role_id = (
      select role_id
      from profiles
      where email = 'resprogreso@gmail.com'
    )
    and rmp.module_key in (
      'users',
      'reports.sales',
      'reports.services',
      'reports.lodging',
      'settings',
      'profile'
    )
  )
) as snapshot;
