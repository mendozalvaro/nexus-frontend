# HISTORY — Lodging / Settings UI / Reservations UI

## 2026-06-18 — Handoff: refinamiento UX de lodging y settings

### Implementado
- Se estabilizó la hidratación de auth/contexto para `reservations`, `reports` y header.
- Se rediseñó la UI de `reservations` para acercarla al patrón de `catalogo`.
- Se refactorizó `PreferencesSection` al patrón real de `settings`, usando cards directas.
- Se mejoró la sección `Parámetros operativos` de `lodging` con mejor simetría visual.
- Se reorganizó `OrganizationForm` para dar protagonismo a `País` y derivar mejor `Moneda` / `Zona horaria`.
- Se corrigió el uso de selects en `OrganizationForm` a la API estándar del repo (`:items`, `label-key`, `value-key`).

### Decisiones tomadas
- `settings` no debe usar `hero` ni `UiSectionShell`; debe seguir el patrón de cards del módulo.
- En `Preferencias`, el layout final quedó en variante compacta:
  - `Apariencia`
  - `Resumen actual`
  - `Recibos`
  - `Parámetros operativos`
- En `Organización`, se eligió una variante minimalista para `Configuración regional`, sin panel lateral de resumen.
- Las listas de `Moneda` y `Zona horaria` deben priorizar la opción sugerida por el país, no mostrarse como listas planas sin contexto.

### Pendiente al salir
- Confirmar visualmente en runtime que los selects regionales de `settings` sí despliegan opciones.
- Confirmar visualmente que el tab `Preferencias` se comporta bien dentro de `settings`.
- No cerrar el frente de `settings` hasta completar esa validación visual.
