| Modulo | Estado funcional | Estado cumplimiento arquitectura | 3-layer frontend | service-layer backend | tenant/role enforcement | tests | Evidencia |
|---|---|---|---|---|---|---|---|
| auth | Completado | completed | Compliant | Compliant | Compliant | Pendiente | `app/composables/useAuth.ts`, `app/composables/useSessionAccess.ts`, `app/composables/useRegistration.ts`, `app/composables/auth/useAuthAudit.ts`, `app/middleware/permissions.ts`, `server/api/profile.get.ts`, `server/api/profile.patch.ts`, `server/api/auth/accessible-branches.get.ts`, `server/api/auth/onboarding-progress.get.ts`, `server/api/auth/onboarding-progress.post.ts`, `server/api/auth/post-auth-context.get.ts`, `server/api/auth/audit.post.ts`, `.ai/AUTH_USE_CASE_DIAGRAM.md` |
| inventory | Completado | completed | Compliant | Compliant | Compliant | Parcial | `server/services/inventory/*.ts` (8 files), `server/api/inventory/*.get.ts` (7 endpoints), `app/composables/useInventory.ts` (0 supabase) |
| appointments (staff) | Completado | pending | Pendiente recertificacion | Pendiente | Parcial | Pendiente | `app/pages/appointments.vue`, `server/api/appointments/**` |
| pos | Completado | pending | Pendiente recertificacion | Pendiente | Parcial | Pendiente | `app/pages/pos.vue`, `server/api/pos/**` |
| reports (staff) | Parcial | pending | Pendiente recertificacion | Pendiente | Pendiente | Pendiente | `app/pages/reports.vue`, `app/composables/useReports.ts` |
| users (staff) | Completado | completed | Compliant | Compliant | Compliant | Pendiente | `server/services/users/list.ts`, `server/api/admin/users/index.get.ts`, `app/composables/useUsers.ts` (0 supabase) |
| system/users | Completado | pending | Pendiente recertificacion | Parcial | Parcial | Pendiente | `app/pages/system/users.vue`, `server/api/system/users/**` |
| branches | Completado | completed | Compliant | Compliant | Compliant | Pendiente | `server/services/branches/*.ts`, `server/api/admin/branches/*.get.ts`, `app/composables/useBranches.ts` (0 supabase) |
| catalogo | Completado | completed | Compliant | Compliant (+service) | Compliant | Pendiente | `server/services/catalog/**`, `server/api/catalog/products.get.ts`, `app/composables/useCatalog.ts` |
| service-assignment | Completado | pending | Pendiente recertificacion | Pendiente | Parcial | Pendiente | `app/pages/service-assignment.vue`, `server/api/service-assignment/**` |
| dashboard (staff) | Completado | completed | Compliant | Compliant (+service) | Compliant | Pendiente | `server/services/dashboard/stats.ts`, `server/api/dashboard-stats.get.ts`, `app/composables/useDashboard.ts` |
| settings | Parcial | pending | Pendiente recertificacion | Pendiente | Pendiente | Pendiente | `app/pages/settings.vue` |
| profile (staff) | Completado | pending | Pendiente recertificacion | Pendiente | Parcial | Pendiente | `app/pages/profile.vue`, `server/api/profile.get.ts` |
| client/dashboard | Completado | pending | Pendiente recertificacion | Pendiente | Parcial | Pendiente | `app/pages/client/dashboard.vue` |
| client/profile | Completado | pending | Pendiente recertificacion | Pendiente | Parcial | Pendiente | `app/pages/client/profile.vue`, `server/api/clients/profile.get.ts` |
| client/appointments | Parcial | pending | Pendiente recertificacion | Pendiente | Pendiente | Pendiente | `app/pages/client/appointments/index.vue` |
| client/bookings | Parcial | pending | Pendiente recertificacion | Pendiente | Pendiente | Pendiente | `app/pages/client/bookings.vue` |
| client/reports | Parcial | pending | Pendiente recertificacion | Pendiente | Pendiente | Pendiente | `app/pages/client/reports.vue` |
| onboarding | Parcial | pending | Pendiente recertificacion | Pendiente | Parcial | Pendiente | `app/pages/onboarding/**`, `app/composables/useRegistration.ts` |
| landing/subscription/system-access | Completado | pending | Pendiente recertificacion | Pendiente | Pendiente | Pendiente | `app/pages/index.vue`, `app/pages/system/access.vue` |

## Notas de ejecucion
- Estrategia activa: `Auth First` como gate de calidad para recertificacion integral.
- Regla global: ningun modulo vuelve a `completed` hasta cumplir checklist de `.github/copilot-instructions.md`.
- Proxima accion: cerrar auditoria+refactor de `auth` y usarlo como plantilla para Ola 1.
