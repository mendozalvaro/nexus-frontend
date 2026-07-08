# Hardening y seed remoto - 2026-06-03

## Alcance

Este documento resume el saneamiento aplicado sobre el proyecto Supabase enlazado `ohdvqqgfebwseeudtwae`, el rediseño de `supabase/seed.sql` y el estado final de seguridad validado con `supabase db advisors`.

## Fuente de verdad adoptada

- El baseline confiable pasa a ser `supabase/dump.sql` + la BD remota enlazada.
- `supabase/migrations/**` sigue siendo el historial de cambios; el schema operativo debe contrastarse contra `dump.sql` y la BD real.

## Cambios aplicados

### 1. Alineación de migraciones remotas faltantes

Se incorporaron al repo migraciones que ya existían en el remoto:

- `supabase/migrations/20260601174150_20260529_fix_categories_columns.sql`
- `supabase/migrations/20260602104330_20260530_multi_business_type.sql`
- `supabase/migrations/20260602104342_20260530_update_rpcs_business_types.sql`

### 2. Hardening SQL y RLS

Se agregaron y aplicaron las siguientes migraciones de saneamiento:

- `supabase/migrations/20260603033357_remote_schema_seed_hardening.sql`
- `supabase/migrations/20260603042911_advisors_second_pass_hardening.sql`
- `supabase/migrations/20260603043429_advisors_third_pass_hardening.sql`
- `supabase/migrations/20260603045011_advisors_fourth_pass_hardening.sql`
- `supabase/migrations/20260603053059_advisors_fifth_pass_hardening.sql`
- `supabase/migrations/20260603054018_advisors_sixth_pass_hardening.sql`
- `supabase/migrations/20260603135715_advisors_seventh_pass_rls_initplan.sql`

Principales efectos:

- habilitación/corrección de RLS en tablas públicas relevantes
- reducción de superficie `SECURITY DEFINER`
- cierre de RPC administrativas expuestas al cliente
- migración de flujos sensibles a endpoints backend
- normalización de policies para eliminar warnings `auth_rls_initplan`
- corrección de vista `admin_payment_stats`
- limpieza de duplicidades de policies e índice duplicado

### 3. Refactor backend para sacar RPC sensibles del cliente

Se movieron llamadas críticas a backend/API:

- `server/services/system/payment-validations.ts`
- `server/api/system/payment-validations/stats.get.ts`
- `server/api/system/payment-validations/index.get.ts`
- `server/api/system/payment-validations/[validationId].get.ts`
- `server/api/system/payment-validations/[validationId]/review.post.ts`
- `server/api/account-status.get.ts`
- `server/api/subscription/capabilities.get.ts`

Refactors asociados:

- `server/api/auth/post-auth-context.get.ts`
- `app/composables/usePaymentSystem.ts`
- `app/composables/useAccountStatus.ts`
- `app/composables/useSubscription.ts`
- `app/composables/useForensic.ts`

## Nuevo `seed.sql`

`supabase/seed.sql` fue reescrito para dejar un baseline funcional de demo:

- 4 organizaciones demo:
  - una `product`
  - una `service`
  - una `lodging`
  - una multi-negocio con los 3 tipos
- usuario `System`
  - email: `mendozalvarito@gmail.com`
  - nombre: `Alvaro Mendoza`
- datos de prueba por funcionalidad:
  - catálogo
  - inventario y transferencias
  - clientes
  - citas
  - POS
  - reservas/hospedaje
  - pagos y validaciones
  - proformas / órdenes
  - notificaciones
  - SIAT
  - billing

## Estado final de Advisors

Después de la séptima pasada, la base quedó esencialmente limpia a nivel SQL/RLS. Los warnings residuales válidos son:

### Deuda aceptada del core RLS

Se aceptan explícitamente estos 5 warnings `authenticated_security_definer_function_executable`:

- `public.get_user_branch_id()`
- `public.get_user_organization_id()`
- `public.get_user_role()`
- `public.is_branch_in_user_organization(uuid)`
- `public.is_user_assigned_to_branch(uuid)`

### Razón de aceptación

Estas funciones son helpers nucleares del modelo de autorización actual y hoy participan en policies RLS y validaciones de alcance tenant/sucursal. Revocar `EXECUTE` a `authenticated` sin rediseñar ese core rompe permisos transversales en la app.

### Criterio para resolver esta deuda en el futuro

Solo debe tocarse dentro de un refactor explícito del core de autorización que:

- mueva el cálculo de contexto a claims/materialización segura o a otro mecanismo equivalente
- reduzca la dependencia de helpers `SECURITY DEFINER` en policies
- revalide extremo a extremo permisos de `system_admin`, `owner`, `admin`, `manager`, `employee` y `client`

Mientras ese rediseño no exista, estos 5 warnings quedan documentados como deuda aceptada y no como error operativo del baseline actual.

## Password leak protection

Queda como requisito habilitar `leaked password protection` en Auth.

Referencia funcional:

- Supabase lo expone en Auth settings del dashboard.
- También existe vía Management API en `PATCH /v1/projects/{project_ref}/config/auth` con `password_hibp_enabled=true`.

Nota:

- este setting no se corrige con SQL ni con migraciones de base
- requiere acceso de configuración del proyecto Supabase
- después de habilitarlo, conviene volver a correr `supabase db advisors --linked --output json`

### Estado real en este proyecto

Se intentó habilitarlo programáticamente el `2026-06-03` usando la Management API autenticada del proyecto:

- `GET /v1/projects/ohdvqqgfebwseeudtwae/config/auth`
- `PATCH /v1/projects/ohdvqqgfebwseeudtwae/config/auth` con `password_hibp_enabled=true`

El intento fue rechazado por Supabase con este motivo funcional:

- la protección contra contraseñas filtradas con HaveIBeenPwned solo está disponible en `Pro Plan` o superior

Por tanto:

- el warning `auth_leaked_password_protection` no se puede resolver en el plan actual
- no es un problema de SQL, migración o permisos locales
- para cerrarlo hay que subir el proyecto a `Pro` o superior y luego volver a activar el setting

## Validación

- Las migraciones de hardening fueron aplicadas contra el remoto enlazado.
- El seed fue ejecutado contra el remoto enlazado.
- `supabase db advisors --linked --output json` terminó limpio salvo:
  - la deuda aceptada del core RLS indicada arriba
  - el warning de `leaked password protection` mientras no se habilite en Auth

## Pendientes conocidos

- Decidir si la deuda aceptada del core RLS se mantiene o entra a un refactor mayor de autorización.
- Mantener futuras migraciones usando como contraste `supabase/dump.sql` + validación remota.
