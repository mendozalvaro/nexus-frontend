# 📚 Biblioteca de Prompts para ChatGPT/Codex

## 🎯 Prompt Maestro de Inicio (Usar al comenzar cada sesión)

ACTÚA COMO: Senior Full-Stack Developer experto en Nuxt 4.4.2 + Supabase

CONTEXTO DEL PROYECTO:
[PEGA AQUÍ EL CONTENIDO COMPLETO DE .ai/PROJECT_CONTEXT.md]

REGLAS DE SEGURIDAD:
[PEGA AQUÍ EL CONTENIDO COMPLETO DE .ai/SECURITY_RULES.md]

CONVENCIONES DE CÓDIGO:
[PEGA AQUÍ EL CONTENIDO COMPLETO DE .ai/CODING_CONVENTIONS.md]

TAREA ACTUAL: Crea el composable useAppointments para listar y filtrar citas

REQUISITOS:

1. Seguir todas las reglas de seguridad (RLS, organization_id, etc.)
2. Usar TypeScript strict mode (sin any)
3. Incluir manejo de errores y estados de carga
4. Filtrar siempre por organization_id en queries
5. Usar componentes Nuxt UI cuando aplique
6. Usar composables del módulo @nuxtjs/supabase

ARCHIVOS A GENERAR:

1. composables/useAppointments.ts

IMPORTANTE: Antes de generar código, hazme hasta 3 preguntas de clarificación si algo no está claro.

## 🛠️ Prompt para Crear Composable

Crea un composable use[NOMBRE] para Nuxt 4.4.2.
REQUISITOS TÉCNICOS:
Usar useSupabaseClient() y useSupabaseSession() del módulo @nuxtjs/supabase
Incluir manejo de errores con try/catch y estado error ref
Retornar estado reactivo (ref/reactive) para isLoading, error, data
Incluir función de refresh o re-fetch si aplica
Seguir .ai/SECURITY_RULES.md para queries multi-tenancy
Todos los tipos deben estar definidos (sin any)
CONTEXTO DE NEGOCIO:
[DESCRIBIR QUÉ DATOS MANEJA Y PARA QUÉ]
EJEMPLO DE USO ESPERADO:

```typescript
const { data, isLoading, error, fetch } = use[NOMBRE]();
await fetch({ branchId: "xyz" });
```

GENERAR:
Archivo completo del composable en composables/use[NOMBRE].ts
Ejemplo de uso en un componente .vue
Tipos TypeScript si son necesarios

## 📄 Prompt para Crear Página Completa

Crea una página completa para [NOMBRE_PÁGINA] en Nuxt 4.4.2.
CONTEXTO:
Ruta: [RUTA_DE_LA_PÁGINA, ej: /admin/dashboard]
Layout requerido: [admin/manager/employee/client]
Rol mínimo requerido: [admin/manager/employee]
Feature flag requerido: [ej: feature_multi_branch]
FUNCIONALIDADES:
[Lista de funcionalidad 1]
[Lista de funcionalidad 2]
[Lista de funcionalidad 3]
COMPONENTES A INCLUIR:
Tabla con pagination y sorting
Modal para crear/editar registros
Filtros de búsqueda (por fecha, estado, etc.)
Estados de vacío/error/carga con UI apropiada
SEGURIDAD:
Proteger con middleware auth del módulo @nuxtjs/supabase
Verificar permisos con useSubscription composable
Todas las queries con filtro organization_id
Validar inputs antes de enviar a DB
GENERAR:
Página completa en pages/[ruta]/index.vue
Middleware si es necesario (middleware/[nombre].ts)
Composable asociado si aplica (composables/use[NOMBRE].ts)
Tipos adicionales si son necesarios (types/[nombre].ts)

---

## 🔍 Prompt para Debugging de Errores

ANÁLISIS DE ERROR - ACTÚA COMO EXPERTO EN DEBUGGING NUXT + SUPABASE
ERROR RECIBIDO: [PEGAR ERROR COMPLETO CON STACK TRACE]

CONTEXTO:
¿Qué estabas haciendo?: [DESCRIBIR ACCIÓN]
Archivo(s) relacionado(s): [LISTA DE ARCHIVOS]
Rol del usuario: [admin/manager/employee/client]
Query involucrada: [PEGAR QUERY SI APLICA]
Línea aproximada del error: [NÚMERO]
REVISAR EN ESTE ORDEN:

1. Políticas RLS en Supabase (¿el usuario tiene permiso para esta operación?)
2. Filtros de organization_id (¿faltan en la query?)
3. Tipos TypeScript (¿hay mismatch entre tipos generados y uso?)
4. Estados de carga (¿race conditions o uso antes de que data esté lista?)
5. .ai/SECURITY_RULES.md (¿violación de alguna regla de seguridad?)
   SOLICITUD:
6. Explica la causa raíz del error en términos simples
7. Proporciona el fix completo (código corregido)
8. Indica cómo prevenir este error en el futuro
9. Si es RLS, muestra la política SQL correcta o la query frontend corregida

---

## 🔐 Prompt para Security Review

AUDITORÍA DE SEGURIDAD - ACTÚA COMO EXPERTO EN SEGURIDAD SUPABASE
CÓDIGO A REVISAR: [PEGAR CÓDIGO COMPLETO DEL ARCHIVO]

CHECKLIST DE VERIFICACIÓN (Marcar cada ítem):
¿Todas las queries filtran por organization_id?
¿No hay service_role_key expuesto en el frontend?
¿Los permisos se validan en DB (RLS) y no solo en UI?
¿Los inputs de usuario están sanitizados antes de enviar a DB?
¿Las contraseñas/secrets están en .env (no hardcodeadas)?
¿Las acciones críticas (ventas, cancelaciones) se loguean para auditoría?
¿Se usa useSubscription() para verificar límites del plan antes de acciones?
¿Los tipos TypeScript están correctamente definidos (sin any)?
¿Hay manejo de estados de error y carga en operaciones async?
¿El código sigue las convenciones en .ai/CODING_CONVENTIONS.md?
TAREA:

1. Identifica TODAS las vulnerabilidades o riesgos (prioriza: Crítico, Alto, Medio, Bajo)
2. Para cada hallazgo: explica el riesgo en términos de negocio y proporciona el fix de código
3. Genera una versión corregida completa del archivo
4. Recomienda tests específicos para validar la corrección
5. Si aplica, proporciona el SQL para ajustar políticas RLS
   REFERENCIA: .ai/SECURITY_RULES.md es la fuente de verdad para reglas de seguridad.

---

## ⚡ Prompt para Optimización de Rendimiento

OPTIMIZACIÓN DE RENDIMIENTO - ACTÚA COMO EXPERTO EN NUXT + SUPABASE
PROBLEMA:
[DESCRIBIR SÍNTOMA: lentitud, timeout, N+1 queries, etc.]
CONTEXTO:
Página/Ruta: [RUTA_DE_LA_PÁGINA]
Datos cargados: [QUÉ_DATOS_Y_CUÁNTOS]
Tiempo actual de carga: [X segundos]
Dispositivo de prueba: [Mobile/Desktop]
QUERY ACTUAL: [PEGAR QUERY COMPLETA DE SUPABASE]

SOLICITUD:

1. Analiza el execution plan (¿qué índices usará esta query?)
2. Identifica queries N+1, selects innecesarios o datos no usados
3. Sugiere índices nuevos en Supabase si es necesario (proporciona SQL)
4. Propone uso de useAsyncData con caching o lazy: true si aplica
5. Sugiere pagination, infinite scroll o virtual scrolling si hay muchos datos
6. Mantén SIEMPRE los filtros de organization_id y seguridad
   GENERAR:
   Query optimizada completa en TypeScript
   SQL para índices nuevos (si aplica)
   Explicación de la mejora esperada en rendimiento
   Código de componente actualizado si requiere cambios en la UI

---

## 🧪 Prompt para Crear Componente UI

Crea un componente Vue 3 reutilizable para Nuxt 4.4.2.
CONTEXTO:
Nombre del componente: [NOMBRE_COMPONENTE.vue]
Ubicación: components/[categoria]/[NOMBRE_COMPONENTE].vue
Propósito: [DESCRIBIR QUÉ HACE EL COMPONENTE]
REQUISITOS:
Usar Composition API con <script setup lang="ts">
Props tipadas con interface y defineProps<{}>()
Emits tipados con defineEmits<{}>()
Usar componentes Nuxt UI (UButton, UCard, UInput, etc.)
Incluir estados de carga y error si aplica
Responsive mobile-first
Seguir .ai/CODING_CONVENTIONS.md
EJEMPLO DE USO:

```vue
<[NOMBRE_COMPONENTE] :prop1="valor1" @event1="handleEvent" />
```

GENERAR:
Componente completo en components/[categoria]/[NOMBRE_COMPONENTE].vue
Documentación de props y emits en comentarios JSDoc
Ejemplo de uso en página .vue

## 📊 Prompt para Crear Reporte/Dashboard

Crea un dashboard/reporte para [NOMBRE_REPORTE] en Nuxt 4.4.2.
CONTEXTO:
Ruta: [RUTA_DE_LA_PÁGINA]
Layout: [admin/manager/employee]
Rol requerido: [admin/manager]
Feature flag: [feature_advanced_reports]
MÉTRICAS A MOSTRAR:
[Métrica 1: ej: Ventas totales del mes]
[Métrica 2: ej: Citas completadas vs canceladas]
[Métrica 3: ej: Productos más vendidos]
COMPONENTES VISUALES:
Cards con KPIs principales
Gráficos (usar librería compatible con Nuxt)
Tabla con datos detallados y exportación
Filtros por rango de fecha y sucursal
REQUISITOS TÉCNICOS:
Usar useAsyncData para server-side fetching
Implementar caching para evitar queries repetidas
Incluir estados de loading skeleton
Todas las queries con filtro organization_id
Verificar feature flag antes de mostrar
GENERAR:
Página completa en pages/[ruta]/index.vue
Composable para fetch de datos del reporte
Componentes reutilizables para cards y gráficos

## 🔄 Prompt para Refactorizar Código Existente

REFACTORIZACIÓN - ACTÚA COMO SENIOR DEVELOPER
CÓDIGO ACTUAL: [PEGAR CÓDIGO COMPLETO ACTUAL]

PROBLEMAS IDENTIFICADOS:
[Problema 1: ej: Código repetitivo en múltiples componentes]
[Problema 2: ej: Manejo de errores inconsistente]
[Problema 3: ej: Tipos TypeScript no definidos correctamente]
OBJETIVOS DE REFACTORIZACIÓN:
Extraer lógica repetitiva a composable
Unificar manejo de errores y estados de carga
Mejorar tipado TypeScript
Optimizar queries de Supabase
Mantener funcionalidad actual sin breaking changes
GENERAR:

1. Código refactorizado completo
2. Lista de cambios realizados con justificación
3. Nuevos archivos creados (composables, utils, types)
4. Guía de migración para actualizar usos existentes

## 🧩 Prompt para Integración con API Externa

INTEGRACIÓN API EXTERNA - ACTÚA COMO EXPERTO EN INTEGRACIONES
CONTEXTO:
API a integrar: [NOMBRE_API, ej: Stripe, WhatsApp, Google Calendar]
Propósito: [DESCRIBIR QUÉ FUNCIONALIDAD SE BUSCA]
Endpoint relevante: [URL_DEL_ENDPOINT SI APLICA]
REQUISITOS:
Usar server/api/ de Nuxt para llamadas server-side (nunca desde cliente)
Almacenar API keys en .env (nunca en código frontend)
Implementar manejo de errores y reintentos
Loguear acciones críticas para auditoría
Validar respuestas de la API antes de procesar
SEGURIDAD:
NO exponer API keys en el frontend
Usar runtimeConfig para variables sensibles
Implementar rate limiting si es necesario
Validar webhooks con firmas criptográficas
GENERAR:

1. Server endpoint en server/api/[nombre].ts
2. Composable para usar desde el frontend
3. Variables de entorno en .env.example
4. Documentación de configuración requerida

## 📝 Prompt para Generar Documentación

GENERAR DOCUMENTACIÓN - ACTÚA COMO TECHNICAL WRITER
CONTEXTO:
Qué documentar: [COMPONENTE/COMPOSABLE/PÁGINA/API]
Audiencia: [Desarrolladores del equipo / Usuarios finales]
Formato: [Markdown / JSDoc / README]
CÓDIGO A DOCUMENTAR: [PEGAR CÓDIGO COMPLETO]

REQUISITOS:
Explicar propósito y funcionalidad principal
Documentar todos los props, emits, y métodos
Incluir ejemplos de uso prácticos
Listar dependencias y requisitos
Mencionar consideraciones de seguridad si aplica
GENERAR:

1. Documentación completa en formato Markdown
2. JSDoc comments para el código
3. Ejemplos de uso en diferentes contextos
4. FAQ o troubleshooting si es complejo

## 🎯 Prompt para Planificación de Feature Completa

PLANIFICACIÓN DE FEATURE - ACTÚA COMO TECH LEAD
NUEVA FUNCIONALIDAD: [NOMBRE_DEL_FEATURE]
DESCRIPCIÓN:
[DESCRIBIR QUÉ DEBE HACER EL FEATURE Y POR QUÉ]
REQUISITOS DE NEGOCIO:
[Requisito 1]
[Requisito 2]
[Requisito 3]
RESTRICCIONES TÉCNICAS:
Debe seguir .ai/SECURITY_RULES.md
Compatible con planes Emprende, Crecimiento y Enterprise
Feature flag: [nombre_del_feature_flag]
Deadline estimado: [TIEMPO]
SOLICITUD:

1. Diseña la arquitectura del feature (archivos necesarios)
2. Define el esquema de base de datos si requiere cambios
3. Lista los composables, componentes y páginas a crear
4. Identifica riesgos técnicos y mitigaciones
5. Estima esfuerzo por archivo (en horas)
6. Define criterios de aceptación para testing
   GENERAR:
   Documento de diseño técnico completo
   Lista de tareas ordenadas por dependencia
   Snippets de código para las partes más complejas
   Checklist de testing (unitario, integración, E2E)
