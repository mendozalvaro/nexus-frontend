# Supabase Environments

## Intent

- `nexus-app` (`ohdvqqgfebwseeudtwae`) = production
- `saas-app` (`fslplpeewerdltebokyz`) = remote development
- `supabase/seed.sql` = full demo seed for development
- `supabase/seed.prod.sql` = clean production baseline seed

## Local env files

Use `.env.local` for day-to-day development and point it to `saas-app`.

Do not keep production credentials in `.env.local`.

Suggested split:

1. `.env.local`
2. `.env.production`
3. `.env.example`

## Before touching either remote project

1. Rotate the credentials currently leaked in the local `.env`.
2. Backup both projects.
3. Recover the missing remote migration `20260622170131` into the repo before more schema work.

## Backup commands

Run once per project after linking the correct project:

```powershell
supabase db dump --linked --schema public -f backups\public-YYYYMMDD.sql
```

Optional auth/storage snapshots should be exported from the Supabase dashboard as well.

## Link commands

Production:

```powershell
supabase link --project-ref ohdvqqgfebwseeudtwae --password <PROD_DB_PASSWORD>
```

Development:

```powershell
supabase link --project-ref fslplpeewerdltebokyz --password <DEV_DB_PASSWORD>
```

## Development project bootstrap

After linking `saas-app`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\bootstrap-saas-app.ps1 -DbPassword <DEV_DB_PASSWORD>
```

Expected outcome:

- full demo dataset
- multiple demo users
- catalog, POS, appointments, reservations and notifications demo data

What the script does:

1. links `saas-app`
2. saves `supabase/saas-backup-before-reset.sql`
3. recreates `public` with `supabase/reset-public-schema.sql`
4. restores `supabase/dump.sql`
5. applies `supabase/seed.sql`
6. runs minimal verification queries

Why not `supabase db push` here:

- the local migration chain is not a clean empty-database baseline
- `supabase/dump.sql` is the current working schema baseline for `saas-app`

## Production project bootstrap

After linking `nexus-app`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\bootstrap-prod.ps1 -DbPassword <PROD_DB_PASSWORD>
```

What the script does:

1. links `nexus-app`
2. saves `supabase/nexus-backup-before-prod-reset.sql`
3. clears `auth.users`
4. truncates `public` data while preserving permission catalogs
5. applies `supabase/seed.prod.sql`
6. runs minimal verification queries

Reset SQL used by the script:

`supabase/reset-prod-data.sql`

Manual equivalent:

```sql
begin;

delete from auth.users;

do $$
declare
  stmt text;
begin
  select string_agg(format('public.%I', tablename), ', ' order by tablename)
  into stmt
  from pg_tables
  where schemaname = 'public'
    and tablename not in ('role_module_permissions', 'system_role_module_permissions');

  if stmt is not null then
    execute 'truncate table ' || stmt || ' restart identity cascade';
  end if;
end $$;

commit;
```

Then apply:

```powershell
supabase db query --linked -f supabase\seed.prod.sql -o json
```

Expected outcome:

- `System` user: `mendozalvarito@gmail.com`
- one admin demo user per organization
- plans, subscriptions, branches and demo organizations only
- no operational demo data

## Publish flow

Frontend only:

```powershell
pnpm typecheck
pnpm build
wrangler pages deploy .output/public --project-name nexuspos
```

Schema only:

```powershell
supabase link --project-ref ohdvqqgfebwseeudtwae --password <PROD_DB_PASSWORD>
supabase migration list --linked
supabase db query --linked -f supabase\migrations\<target>.sql -o json
```

App + schema:

1. apply the target Supabase SQL first
2. verify the new tables/functions with `supabase db query --linked`
3. run `pnpm typecheck`
4. run `pnpm build`
5. deploy `.output/public` to Cloudflare Pages

Prefer applying only the target SQL file when `supabase db push` tries to pull older backlog.

## Verification queries

```sql
select email from auth.users order by email;
select slug, name from public.organizations order by slug;
select slug, name from public.subscription_plans order by slug;
select organization_id, role, email from public.profiles order by organization_id, email;
```

## Notes

- `NODE_ENV=production` does not belong in local development env files.
- New migrations must use full unique timestamps.
- The previous `.gitignore` could hide new migrations by mistake; that is fixed in this repo state.
