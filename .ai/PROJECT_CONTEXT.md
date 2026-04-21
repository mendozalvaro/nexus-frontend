# 🏢 NexusPOS - Contexto del Proyecto

## Visión General

SaaS Multi-Tenancy para gestión híbrida de Productos + Servicios + Citas.
Lanzamiento: Abril 2026
Stack: Nuxt 4 + Supabase (PostgreSQL + Auth + RLS)

## Roles de Usuario (CRÍTICO)

| Rol          | Alcance                 | Permisos Clave                                                         |
| ------------ | ----------------------- | ---------------------------------------------------------------------- |
| **admin**    | Toda la empresa         | Crear sucursales, gestionar usuarios, ver reportes globales, auditoría |
| **manager**  | Una sucursal específica | Gestionar empleados locales, inventario local, caja diaria             |
| **employee** | 1+ sucursales asignadas | Ver sus citas, realizar ventas, registrar clientes walk-in             |
| **client**   | Solo sus datos          | Reservar citas, comprar productos, ver historial                       |

## Reglas de Negocio NO NEGOCIABLES

1. **Multi-Tenancy**: TODA query DEBE filtrar por `organization_id`
2. **Suscripciones**: Límites de sucursales/usuarios validados en DB con triggers
3. **Forense**: Transacciones, stock y citas se auditan automáticamente (tabla audit_logs)
4. **Inmutabilidad**: Productos/Servicios NO se borran, se desactivan (`is_active = false`)
5. **Walk-ins**: Citas y ventas pueden ser sin cliente registrado (solo nombre/teléfono)
6. **Snapshot**: Transaction_items guarda snapshot_data (nombre/precio al momento de venta)

## Planes y Feature Flags

| Plan        | Precio   | Sucursales | Manager | Transferencias | Forensic Export |
| ----------- | -------- | ---------- | ------- | -------------- | --------------- |
| Emprende    | $20/mes  | 1          | ❌      | ❌             | ❌              |
| Crecimiento | $65/mes  | 5          | ✅      | ✅             | ❌              |
| Enterprise  | $200/mes | ∞          | ✅      | ✅             | ✅              |

## Estructura de Base de Datos (Tablas Principales)

- organizations (tenants)
- branches (sucursales por org)
- profiles (usuarios con role + org_id)
- subscription_plans + organization_subscriptions
- products + services + categories
- inventory_stock (por branch)
- appointments (con start_time, end_time, employee_id)
- transactions + transaction_items
- audit_logs (inmutable, solo lectura para admin)

## Convenciones Técnicas

- Framework: Nuxt 4.4.2 con App Router
- UI: Nuxt UI + Tailwind CSS
- Auth: @nuxtjs/supabase module (manejo automático de sesión)
- Types: Generados desde Supabase CLI
- State: Composables + Pinia (solo si es necesario)
- BD: usa Supabase CLI ejemplo supabase gen types typescript --local > types/supabase.ts

## Metodologia de Orquestacion de Modulos (Obligatoria)

Estandar obligatorio para modulos nuevos y refactors progresivos. Aplicar como regla general, no acoplada a un modulo especifico.

- Patron de 3 capas obligatorio:
  - **Page Orchestrator**: estado UI, carga de datos, casos de uso y coordinacion.
  - **Composable de Dominio**: acceso a datos, mutaciones, normalizacion de payloads/respuestas.
  - **Componentes Presentacionales**: solo UI; comunicacion por `props`/`emits`; sin logica de negocio.
- Carga de datos por recurso (no bloque monolitico), con claves independientes de cache/async-data.
- Refresh selectivo por entidad/operacion; prohibido refresh global cuando no sea necesario.
- Derivados de UI en `computed` dentro del orquestador (filtros, conteos, etiquetas derivadas).
- Multi-tenant enforcement obligatorio en capa dominio/API (`organization_id` + RLS).
- Errores de mutacion: manejo explicito (`try/catch`) y feedback de UI; evitar promesas no manejadas.
- Compatibilidad: cuando exista loader agregado legacy, mantenerlo como composicion de loaders parciales.

### Checklist obligatorio para nuevos modulos/refactors

- Separacion de 3 capas aplicada.
- Refresh selectivo implementado.
- Componentes sin acceso directo a DB/API.
- Contexto tenant validado.
- Errores de mutacion controlados.

### Nota de adopcion

- Aplica a modulos nuevos y refactors progresivos.
- Excepciones solo con limitacion tecnica explicita y documentada en PR/handoff.
