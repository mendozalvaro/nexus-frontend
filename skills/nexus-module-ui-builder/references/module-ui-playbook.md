# Module UI Playbook (Nexus)

## Patron minimo de tabs

1. `Resumen`
2. Tabs operativas por dominio (ejemplos: `Clientes`, `Historial`, `Configuracion`, `Merge`)

## Estructura recomendada del tab Resumen

1. `UiModuleHero` del modulo.
2. Grid de KPI (3-6 tarjetas maximas).
3. Bloque de accesos rapidos a tabs operativas.
4. Alertas de estado solo si son criticas para la operacion.

Regla UX:
- No agregar un bloque adicional "Resumen" + descripcion por encima o por debajo del hero.
- El hero ya cumple el rol de contexto primario.

## Plantilla de composable por modulo

Tipos base:
- `Row` del modulo.
- `Filters` del modulo.
- `MutationPayload` del modulo.

Funciones base:
- `getDefaultFilters()`
- `load<Resource>()`
- `create<Resource>()`
- `update<Resource>()`
- `set<Resource>Status()`

Estados base:
- `loading`
- `error`
- `success`
- `rows`
- `total`

## Plantilla de page orchestrator

1. `definePageMeta` con `middleware`, `permission`, `roles`.
2. `activeTab` reactivo con `Resumen` por defecto.
3. filtros + paginacion reactiva.
4. modales de alta/edicion/acciones especiales.
5. handlers de acciones que llaman al composable y refrescan selectivamente.

## Plantilla de tabs operativas

`CRUD/Listado`:
- `UiSearchFilters`
- tabla (`UiDataTable` o tabla del modulo)
- acciones por fila (editar, estado, acciones de dominio)
- modales de formulario/confirmacion

`Historial`:
- filtros por fecha/estado
- tabla de eventos
- detalle en modal/slideover cuando aplique

`Configuracion`:
- formularios por seccion
- validacion Zod
- guardado con feedback UI

## Permisos y navegacion

Siempre sincronizar:
1. ruta del modulo en `app/pages`.
2. item en `app/config/navigation.ts`.
3. `ROUTE_PERMISSIONS` en `app/types/permissions.ts`.

## Criterios rapidos de QA

1. `Resumen` usa `UiModuleHero` y no duplica encabezado textual.
2. KPI visibles y utiles para priorizar decisiones.
3. Accesos rapidos navegan a tabs funcionales.
4. Errores de mutacion visibles en UI.
5. `npm run typecheck` sin errores nuevos.
