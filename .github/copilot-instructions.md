# Copilot Instructions - Nexus POS Frontend

## Estado actual

Módulos/funcionalidades implementados al 100% según el código existente:
- Multi-tenancy con organizaciones y RLS en Supabase
- Sistema de autenticación con roles (admin, manager, employee, client)
- Gestión de sucursales (branches) con asignación de empleados
- Catálogo de productos y servicios con inventario y movimientos
- Sistema de citas (appointments) con detección de conflictos
- POS híbrido para productos y servicios
- Reportes avanzados con filtros
- Dashboard con métricas y gráficos
- Onboarding completo para organizaciones
- Sistema de pagos y validaciones
- Logs forenses inmutables
- Páginas de landing públicas
- Tema oscuro/claro
- Middleware de permisos y acceso

## Stack técnico

NO SUGERIR CAMBIOS

- Framework: Nuxt 4.4.2 (Vue 3.5.31)
- UI: @nuxt/ui 4.6.0
- Backend: @nuxtjs/supabase 2.0.4 (@supabase/supabase-js 2.101.1)
- Charts: ApexCharts 5.10.4 (vue3-apexcharts 1.11.1)
- Validation: Zod 4.3.6
- Deployment: Cloudflare Pages (Wrangler 4.81.1)
- TypeScript: Estricto con typeCheck activado
- Color Mode: @nuxtjs/color-mode 4.0.0
- DevTools: Habilitado

## Estructura de carpetas

- `/app`: Directorio principal de Nuxt
  - `/assets`: CSS, imágenes, fuentes (main.css)
  - `/components`: Componentes Vue organizados por feature (admin/, auth/, base/, business/, charts/, dashboard/, features/, forms/, landing/, layout/, modals/, onboarding/, receipts/, reports/, system/, ui/)
  - `/composables`: Composables Vue (30+ archivos, uno por funcionalidad)
  - `/config`: Configuraciones (navigation.ts)
  - `/layouts`: Layouts de página (client.vue, default.vue)
  - `/middleware`: Middleware de rutas (account-status.ts, branch-access.ts, pending-account.global.ts, permissions.ts, system-only.ts)
  - `/pages`: Rutas basadas en archivos (auth/, client/, onboarding/, system/, páginas principales)
  - `/types`: Definiciones TypeScript (auth.ts, database.types.ts, forensic.ts, navigation.ts, payment.ts, permissions.ts, registration.ts, subscription.ts)
  - `/utils`: Utilidades (constants.ts, onboarding.ts, role-access.ts, roles.ts)
- `/server/api`: Route Handlers de Nuxt (admin/, appointments/, auth/, catalog/, dev/, inventory/, pos/, service-assignment/, system/)
- `/plugins`: Plugins de Nuxt
- `/public`: Assets estáticos (robots.txt, images/)
- `/supabase`: Configuración de Supabase (migrations/, seed.sql, etc.)
- Raíz: nuxt.config.ts, package.json, tsconfig.json, wrangler.toml, schema.sql

## Archivos fuente de verdad - Leer siempre antes de sugerir
- `/supabase/schema.sql` → Nombres reales de tablas, columnas, constraints y enums
- `/app/types/database.types.ts` → Tipos TypeScript generados desde Supabase. Usar estos, no inventar
- `/app/utils/constants.ts` → Enums, roles válidos, estados de citas, valores por defecto
- `/app/utils/roles.ts` → Matriz de permisos por rol. Respetar siempre
- `/server/api/**` → Ejemplos de cómo validar con Zod + chequear organization_id + RLS
- `/app/middleware/permissions.ts` → Lógica de control de acceso que ya existe

## Reglas de negocio - NO ROMPER
- Una cita/appointment bloquea 1 empleado + 1 recurso/mesa durante `duration_minutes`
- Detección de conflictos: `SELECT ... WHERE time_range && tstzrange(start, end) AND status NOT IN ('cancelled', 'no_show') FOR UPDATE`
- RLS obligatorio: Todo query a DB debe filtrar por `organization_id` desde JWT de Supabase. Nunca hardcodear IDs
- Multi-tenancy: `manager` y `employee` solo ven datos de su `branch_id` salvo que sean `admin` de la org
- Estados de cita: `pending` → `confirmed` → `in_progress` → `completed`. Solo `admin` o `manager` pueden forzar cambios
- Inventario: Movimientos negativos requieren validación de stock. Generar log forense con checksum
- Logs forenses: Tablas críticas usan triggers. No hacer INSERT/UPDATE directo sin pasar por composables
- Onboarding: Pago validado por admin es requisito para activar organización
- Permisos: `client` solo accede a su propia info y citas. `employee` accede a su branch. `manager` accede a su org. `admin` accede a todo

## Reglas de código

- Usar Route Handlers en `/server/api/` para lógica del servidor, no Server Actions
- Validación con Zod en schemas definidos en `/utils/`
- Tipos estrictos de TypeScript, sin `any`
- Composables para lógica reutilizable, uno por archivo
- Sanitización de inputs en composables de auth y forms
- Estado global con `useState` de Nuxt
- Imports absolutos con `@/` para types y utils
- Middleware para control de acceso basado en roles
- Componentes organizados por dominio/feature
- Logs forenses con checksums para tablas críticas

## Reglas de auth en Nexus POS
- No hacer `supabase.auth.getUser()` en cada componente. Usar `useAuth()`
- En `/server/api`: Usar `const user = await serverSupabaseUser(event)` + validar `organization_id`
- El `profile` se cachea 30s. Para forzar refresh: `await fetchProfile({ force: true })`
- `role` y `organizationId` ya están computados desde `profile` o metadata. No recalcular

## Validación de auth - Probado con tests
- `useAuth()` usa `useState` global + cache de 30s. Test: `app/composables/__tests__/useAuth.spec.ts`
- `user`, `profile`, `role`, `organizationId` son computados reactivos. No recalcular ni volver a pedir
- Para refrescar perfil tras UPDATE: `await fetchProfile({ force: true })`
- En componentes nunca `supabase.auth.getUser()` - genera N requests. Usar `useAuth()` - genera 1 cada 30s

## No hacer nunca en Nexus POS
- No usar `fetch` o `supabase.from()` directo desde `/app/components`. Usar composables de `/app/composables`
- No crear endpoints en `/server/api` sin validar `organization_id` en body/query y sin check de RLS
- No usar `ref()` para estado que debe persistir entre rutas. Usar `useState('key', () => ...)`
- No importar archivos de `/server/api` en `/app/components`. Solo via `$fetch` o composables
- No hacer `supabase.auth.getUser()` en cada componente. Usar `useSupabaseUser()` o `useAuth()`
- No escribir SQL crudo sin pasar por Supabase client. Rompe RLS
- No asumir que el usuario tiene `branch_id`. `client` y `system` no tienen
- No crear nuevos roles sin actualizar `/app/utils/roles.ts` y `/app/utils/role-access.ts`

## WIP y TODO

- No hay archivos con //TODO o FIXME identificados
- Funciones incompletas: Ninguna detectada
- Módulos mencionados en README/QWEN.md pero sin código: Todos los listados parecen implementados

## Decisiones técnicas

- Uso de Supabase por PostgreSQL + Auth + RLS para multi-tenancy (INFERIDO de configuración)
- Nuxt 4 por SSR/SSG y Vue 3 ecosystem
- Zod para validación por type safety y runtime checks
- ApexCharts por integración con Vue y features avanzadas
- Cloudflare Pages por deployment serverless
- TypeScript estricto por robustez en base de código grande
- Tema con @nuxtjs/color-mode por UX mejorada</content>
<parameter name="filePath">c:\Users\PC-Alvarito\Dev\nexus-frontend\.github\copilot-instructions.md

## 🔄 Multi-Agent Workflow

### Protocolo de Handoff
1. **Antes de empezar**: Leer `.ai/STATE.md` para conocer el estado actual
2. **Continuar desde**: `last_step` → `pending` (no regenerar archivos ya listados)
3. **Actualizar estado**: Modificar `last_step`, `pending`, `files_created`, `files_modified`
4. **Commit handoff**: Usar `ai-handoff` para registrar el punto de transición
5. **Historial**: Actualizar `.ai/HISTORY.md` con timestamp y resumen

### Archivos de Persistencia
- `.ai/STATE.md`: Estado actual del workflow (last_step, pending, archivos modificados)
- `.ai/PLAN.md`: Planes pendientes y asignaciones actuales
- `.ai/HISTORY.md`: Log de handoffs entre agentes
- `.ai/PROJECT_CONTEXT.md`: Contexto general del proyecto (leer siempre)

### Reglas de Optimización
- No regenerar código ya creado (ver `files_created`)
- No modificar archivos ya listados en `files_modified` sin necesidad
- Si hay conflictos con reglas del proyecto, abortar y reportar
- Mantener contexto mínimo pero suficiente para continuidad
- Usar `ai-handoff` para commits de transición (optimiza tokens al separar contextos)

### Flujo Típico
1. Agente A lee STATE.md → ejecuta tarea → actualiza STATE.md → `ai-handoff` y registra log en HISTORY.md
2. Agente B lee STATE.md → continúa desde pending → ejecuta tarea → actualiza STATE.md → `ai-handoff` y registra log en HISTORY.md
3. Repetir hasta completar el proyecto