begin;

do $$
declare
  stmt text;
begin
  select string_agg(format('public.%I', tablename), ', ' order by tablename)
  into stmt
  from pg_tables
  where schemaname = 'public'
    and tablename not in (
      'role_module_permissions',
      'system_role_module_permissions'
    );

  if stmt is not null then
    execute 'truncate table ' || stmt || ' restart identity cascade';
  end if;
end $$;

delete from auth.users;

commit;
