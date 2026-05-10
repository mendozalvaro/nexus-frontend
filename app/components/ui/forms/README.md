# Admin Forms

Primitives base para formularios administrativos sobre Nuxt UI.

## Uso recomendado

- `AdminFormSection`: secciona formularios por contexto y mantiene jerarquía visual consistente.
- `AdminFieldGroup`: crea grids responsivos sin repetir clases de layout.
- `AdminFormActions`: unifica footers de formularios y modales.
- `AdminReadonlyField`: muestra valores no editables con apariencia de input.
- `AdminFieldHint`: helper de warnings, ayuda contextual o feedback secundario.
- `AdminRepeaterCard`: contenedor para listas repetibles como líneas de inventario.

## Reglas

- Formularios nuevos o refactorizados deben usar `UForm + Zod`.
- Usa presets de `app/utils/ui/forms.ts` para inputs/selects/textarea antes de repetir `:ui`.
- Mantén la lógica de negocio fuera del template; los wrappers solo resuelven composición y consistencia visual.

## Proceso de implementación

Antes de construir o refactorizar un formulario, define esta ficha:

- tipo: `page form`, `modal CRUD`, `modal complejo`, `repeater-heavy`
- layout: `1 columna`, `2 columnas` o `mixto`
- tamaño del modal:
  `1 columna` => angosto
  `2 columnas` => ancho
  `mixto` => declarar ancho según la sección dominante
- secciones: título, descripción y objetivo de cada bloque
- acciones: primaria, secundaria y prevalidación si aplica
- campos especiales: `readonly`, `helper`, `warning`, `repeater`
- transformación: `form state -> payload`
- reset: comportamiento al cerrar y reabrir

## Reglas de layout

- `1 columna`: formularios simples, confirmaciones y campos largos.
- `2 columnas`: CRUD estándar con campos cortos o pares relacionados.
- `mixto`: contexto superior + detalle complejo o repeater.
- En modales, el ancho debe seguir el layout elegido; no definir `max-w-*` de forma ad hoc.

## Plantilla base

- Usa [admin-crud-modal-template.md](/abs/path/c:/Users/PC-Alvarito/Dev/nexus-frontend/app/components/ui/forms/templates/admin-crud-modal-template.md) como base para modales CRUD.
- Si el formulario tiene líneas repetibles o validación de inventario compleja, parte de la plantilla y luego escala al patrón de `InventoryMovementModal` o `InventoryTransferModal`.
