---
name: nexus-module-ui-builder
description: Construye o refactoriza interfaces completas de modulos en este repositorio Nuxt 4 usando arquitectura de 3 capas, convencion visual por tabs y tab Resumen orientado a KPI. Usar cuando el usuario pida crear un nuevo modulo, modernizar un modulo existente, o estandarizar UX de modulo con page orchestrator, composable de dominio, componentes presentacionales, permisos, navegacion y wiring API.
---

# Nexus Module UI Builder

## Ejecutar objetivo

Implementar modulos completos con patron consistente de:
1. `Page Orchestrator` en `app/pages/<modulo>.vue`.
2. `Composable de Dominio` en `app/composables/use<Modulo>.ts`.
3. `Componentes Presentacionales` en `app/components/<modulo>/...`.
4. Navegacion y permisos alineados con `app/config/navigation.ts` y `app/types/permissions.ts`.

Leer `references/module-ui-playbook.md` antes de editar el modulo.

## Reglas obligatorias

1. Organizar visualmente el modulo en tabs:
   - `Resumen` primero.
   - tabs adicionales segun dominio.
2. Mantener o mejorar `UiModuleHero` en `Resumen`.
3. No agregar bloque redundante de encabezado de seccion tipo "Resumen + descripcion" fuera del hero.
4. En `Resumen`, mostrar:
   - KPI prioritarios.
   - accesos rapidos hacia tabs operativas del modulo.
5. Mover operaciones detalladas (CRUD, historiales, configuracion) a tabs no-Resumen.
6. Mantener componentes presentacionales sin acceso directo a DB/API.
7. Centralizar IO HTTP en composable via `$fetch('/api/...')`.
8. Manejar errores de mutacion con feedback UI explicito.

## Flujo operativo

1. Definir alcance del modulo.
   - identificar recursos, mutaciones y permisos.
   - listar tabs requeridas (incluyendo `Resumen`).

2. Diseñar contrato del composable.
   - estados reactivos (`loading`, `error`, `success`, `rows`, `total`).
   - funciones `load`, `create`, `update`, `setStatus`, y extras del dominio.
   - tipos de payload y de filas.

3. Construir page orchestrator.
   - tabs y estado de tab activa.
   - cargas por recurso y refresh selectivo.
   - wiring de modales/acciones.

4. Implementar UI presentacional del modulo.
   - tablas, filtros, modales y panel de resumen.
   - evitar logica de negocio en template.

5. Integrar permisos y navegacion.
   - ruta con `definePageMeta` + middleware/roles/permission.
   - agregar item de navegacion y route permission si aplica.

6. Validar.
   - ejecutar `npm run typecheck`.
   - revisar que `Resumen` cumpla la regla UX.

## Checklist de salida

1. Modulo con tabs y `Resumen` primero.
2. `Resumen` con `UiModuleHero` + KPI + accesos rapidos, sin encabezado redundante.
3. Composable tipado con mutaciones y errores controlados.
4. Componentes del modulo sin acceso directo a API/DB.
5. Permisos y navegacion coherentes.
6. `typecheck` en verde o brecha documentada.
