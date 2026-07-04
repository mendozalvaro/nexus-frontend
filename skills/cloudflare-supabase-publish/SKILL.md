---
name: cloudflare-supabase-publish
description: Publica esta app Nuxt en Cloudflare Pages y aplica cambios de Supabase para este repositorio. Use when Codex needs to deploy frontend changes, publish app updates, apply Supabase migrations or SQL files, rebuild the dev database, or coordinate a combined Cloudflare plus Supabase rollout for nexus-frontend.
---

# Cloudflare Supabase Publish

## Overview

Aplicar el flujo real de release de este repo sin inventar pipelines nuevos. Separar despliegue de app y cambios de base de datos, ejecutar solo lo necesario y verificar al final.

## Read First

Leer primero:

- `.github/copilot-instructions.md`
- `package.json`
- `wrangler.toml`
- `supabase/ENVIRONMENTS.md`

Confirmar el objetivo antes de ejecutar:

- solo frontend
- solo Supabase
- ambos

## Environment Map

- `nexus-app` / `ohdvqqgfebwseeudtwae` = production
- `saas-app` / `fslplpeewerdltebokyz` = remote development
- `supabase/dump.sql` = current schema baseline for empty dev rebuilds
- `supabase/seed.sql` = full demo seed
- `supabase/seed.prod.sql` = clean production seed

No usar `supabase db push` para reconstruir una base vacia de `saas-app`; en este repo el baseline util para eso es `dump.sql + seed.sql`.

## Supabase Flow

1. Verificar proyecto enlazado con `supabase projects list`.
2. Si el pedido es incremental:
- ejecutar `supabase migration list --linked`
- aplicar solo el SQL objetivo con `supabase db query --linked -f supabase\migrations\<archivo>.sql -o json` cuando `db push` quiera arrastrar backlog viejo
3. Si el pedido es reconstruir `saas-app`:
- ejecutar `powershell -ExecutionPolicy Bypass -File scripts\bootstrap-saas-app.ps1 -DbPassword <DEV_DB_PASSWORD>`
4. Si el pedido es preparar `nexus-app` en limpio:
- ejecutar `powershell -ExecutionPolicy Bypass -File scripts\bootstrap-prod.ps1 -DbPassword <PROD_DB_PASSWORD>`
5. Verificar con una consulta minima del objeto cambiado.

## Cloudflare Flow

1. Ejecutar `pnpm typecheck`.
2. Ejecutar `pnpm build`.
3. Publicar con `wrangler pages deploy .output/public --project-name nexuspos`.
4. Si cambian variables de entorno, confirmar primero que existen en Cloudflare Pages.

## Combined Rollout Order

1. Aplicar primero el cambio de Supabase.
2. Verificar tablas, funciones o seeds.
3. Ejecutar `pnpm typecheck`.
4. Ejecutar `pnpm build`.
5. Publicar a Cloudflare Pages.

## Output

- indicar proyecto Supabase tocado
- indicar SQL o migration aplicada
- indicar si Cloudflare se publico o no
- indicar verificacion ejecutada
