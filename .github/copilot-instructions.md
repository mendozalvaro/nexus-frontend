# Copilot Instructions - Nexus POS Frontend

## 1) Jerarquia de instrucciones (source of truth)

Aplicar en este orden, sin excepcion:
1. `.github/copilot-instructions.md` (este archivo)
2. `.codex/instructions.md`
3. `.ai/PROJECT_CONTEXT.md`
4. Codigo fuente actual del repositorio

Si existe conflicto entre documento y codigo ejecutable, prevalece el codigo y se debe proponer actualizacion documental.

## 2) Estado del proyecto y stack (no inventar cambios)

Proyecto SaaS multi-tenant con Nuxt 4 + Supabase + RLS.

Stack actual validado en `package.json` y `nuxt.config.ts`:
- Nuxt `^4.4.2` / Vue `^3.5.31`
- `@nuxt/ui ^4.6.0`
- `@nuxtjs/supabase ^2.0.4` / `@supabase/supabase-js ^2.101.1`
- Zod `^4.3.6`
- ApexCharts `^5.10.4` / `vue3-apexcharts ^1.11.1`
- TypeScript estricto con `typeCheck: true`
- Deployment: Cloudflare Pages (`nitro.preset = cloudflare-pages`)

## 3) Arquitectura obligatoria (módulos nuevos y refactors)

### Patron de 3 capas
- `Page Orchestrator` (`app/pages/**`): estado de UI, orchestration, loaders por recurso, computed derivados.
- `Composable de Dominio` (`app/composables/**`): acceso a datos, mutaciones, normalizacion, cache y refresh selectivo.
- `Componentes Presentacionales` (`app/components/**`): UI pura con `props`/`emits`, sin acceso directo a DB.

### Implementacion backend alineada a 3 capas
- `API Layer` (`server/api/**`): transporte HTTP solamente (entrada/salida, auth base, codigos de estado).
- `Service Layer` (`server/services/**`): casos de uso por dominio, reglas de negocio, permisos, tenant enforcement, orchestration transaccional.
- `Utility Layer` (`server/utils/**`): helpers puros y utilidades tecnicas transversales; no centralizar casos de uso aqui.

### Reglas de modularidad
- Carga por recurso con claves independientes (`useAsyncData`/estados separados).
- Refresh selectivo por entidad; evitar refresh global salvo caso justificado.
- Manejo explicito de errores de mutacion (`try/catch`, feedback UI).
- Mantener compatibilidad progresiva con módulos legacy durante migraciones.

## 4) Multi-tenant y seguridad (obligatorio)

- Todo acceso a datos debe respetar `organization_id` + RLS.
- No hardcodear IDs de tenant, sucursal o usuario.
- `manager` y `employee` operan con alcance de sucursal/organizacion segun reglas vigentes.
- `client` solo accede a su propia informacion.
- Endpoints sensibles deben validar actor, rol y contexto tenant server-side.

## 5) Reglas de acceso a datos

### Frontend
- Prohibido usar `supabase.from()` o `fetch` directo dentro de componentes presentacionales.
- Acceso a API/DB desde composables de dominio.
- Llamadas HTTP del frontend deben centralizarse en composables via `$fetch('/api/...')`.

### Backend
- Route Handlers en `server/api/**` con validacion de entrada (Zod o equivalente tipado estricto).
- Mover y/o implementar logica de dominio en `server/services/**` (evitar negocio en handlers).
- Mantener `server/utils/**` para funciones de soporte, no para orquestacion de negocio.
- No exponer operaciones cross-tenant.

## 6) Reglas de auth

- No invocar `supabase.auth.getUser()` en componentes de UI.
- Usar `useAuth()` como fuente principal de sesion/perfil.
- Excepciones permitidas: composables de infraestructura de sesion (`useSessionAccess`, `useRegistration`) donde la validacion activa de token sea parte del diseno.
- En backend usar helpers server-side de Supabase para usuario autenticado y validar contexto de tenant.

## 7) Estructura y convenciones de codigo limpio

### Organizacion de componentes
- **Todos los componentes se registran en `app/components/[modulo]/`** agrupados por dominio.
- Subcarpetas obligatorias por tipo:
  - Formularios → `app/components/[modulo]/forms/` (ej: `ProductForm.vue`, `BranchForm.vue`)
  - Modales → `app/components/[modulo]/modals/` (ej: `InventoryMovementModal.vue`, `TransferModal.vue`)
  - Tabs/Vistas → `app/components/[modulo]/tabs/` o `app/components/[modulo]/views/`
  - Componentes reutilizables del modulo → `app/components/[modulo]/` (raiz)
- Ejemplo: modales de inventario → `app/components/inventory/modals/InventoryMovementModal.vue`.
- Carpetas validas: `auth/`, `layout/`, `ui/`, `inventory/`, `catalog/`, `users/`, `branches/`, `forms/`, `features/`, `dashboard/`, `admin/`, `reports/`, `onboarding/`, `landing/`, `system/`, `charts/`, `receipts/`.
- Prohibido crear carpetas genericas como `modals/` o `features/` para componentes de dominio especifico; mover al modulo correspondiente.

### Convenciones generales
- TypeScript estricto; evitar `any`.
- Imports absolutos `@/` para `types`, `utils` y módulos compartidos.
- Nombres descriptivos por dominio (`useInventory`, `useUsers`, `useAppointments`, etc.).
- Evitar logica de negocio en templates Vue.
- Extraer funciones puras reutilizables a `app/utils/**` o `server/utils/**`.
- Mantener funciones pequenas, cohesion alta y bajo acoplamiento.

## 8) Patrones recomendados para este repo

- `Facade Pattern`: composables como fachada entre UI y API.
- `Repository-like access`: concentrar operaciones por agregado en cada composable de dominio.
- `Orchestrator Pattern`: paginas coordinan casos de uso y estado derivado.
- `Policy/Guard Pattern`: middleware + validaciones server-side para permisos.
- `Fail-fast validation`: validar input al inicio con esquemas.

## 9) Fuente de verdad tecnica antes de implementar

Leer siempre antes de cambios estructurales:
- `schema.sql`
- `app/types/database.types.ts`
- `app/utils/constants.ts`
- `app/utils/roles.ts`
- `app/utils/role-access.ts`
- `server/api/**`
- `app/middleware/permissions.ts`

## 10) Workflow multi-agente (si aplica en la sesion)

Si la tarea usa handoff/agentes:
- Leer `.ai/STATE.md` y continuar desde `pending`.
- Actualizar `.ai/STATE.md` y `.ai/HISTORY.md` con evidencia minima de cambios.
- No marcar modulo como completo si sigue en placeholder o sin backend funcional.

## 11) Checklist de aceptacion para PR/refactor

- [ ] Respeta patron de 3 capas.
- [ ] No hay acceso directo DB en componentes presentacionales.
- [ ] En backend: handlers delgados (`server/api`) + casos de uso en `server/services`.
- [ ] Validacion de tenant/rol aplicada en frontend y backend.
- [ ] Errores de mutaciones manejados explicitamente.
- [ ] Tipos actualizados y sin `any` accidental.
- [ ] `npm run typecheck` en verde.
- [ ] Tests relevantes (si existen) pasan o se documenta brecha.
