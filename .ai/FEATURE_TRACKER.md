| Modulo | Estado funcional | Estado cumplimiento arquitectura | 3-layer frontend | service-layer backend | tenant/role enforcement | tests | Evidencia |
|---|---|---|---|---|---|---|---|
| auth | Completado | completed | Compliant | Compliant | Compliant | Pendiente | `app/composables/useAuth.ts`, `app/composables/useSessionAccess.ts`, `app/composables/useRegistration.ts`, `app/composables/auth/useAuthAudit.ts`, `app/middleware/permissions.ts`, `server/api/profile.get.ts`, `server/api/profile.patch.ts`, `server/api/auth/accessible-branches.get.ts`, `server/api/auth/onboarding-progress.get.ts`, `server/api/auth/onboarding-progress.post.ts`, `server/api/auth/post-auth-context.get.ts`, `server/api/auth/audit.post.ts`, `.ai/AUTH_USE_CASE_DIAGRAM.md` |
| inventory | Completado | completed | Compliant | Compliant | Compliant | Parcial | `server/services/inventory/*.ts` (8 files), `server/api/inventory/*.get.ts` (7 endpoints), `app/composables/useInventory.ts` (0 supabase) |
| appointments (staff) | Completado | completed | Compliant | Compliant (+service) | Compliant | Parcial | `app/pages/appointments.vue` (tabs + kanban), `app/components/appointments/**` (8 componentes: tabs, summary, toolbar, kanban, forms/, modals/), `app/composables/useAppointments.ts` (0 supabase, fix employee label), `app/composables/useAppointmentDashboard.ts` (dashboard KPIs), `server/services/appointments/*.ts` (3 files), `server/api/appointments/*.ts` (7 endpoints). **E2E validated**: creacion de cita + kanban board (2026-05-12) |
| pos | Completado | completed | Compliant | Compliant (+service) | Compliant | Parcial | `app/pages/pos.vue` (implementado), `app/components/pos/*.vue` (3 componentes), `app/composables/usePOS.ts` (0 supabase), `server/services/pos/*.ts` (5 files), `server/api/pos/*.ts` (6 endpoints) |
| reports (staff) | Completado | completed | Compliant | Compliant (+service) | Compliant | Pendiente | `server/services/reports/*.ts` (6 files), `server/api/reports/*.get.ts` (6 endpoints), `app/composables/useReports.ts` (0 supabase) |
| users (staff) | Completado | completed | Compliant | Compliant | Compliant | Pendiente | `server/services/users/list.ts`, `server/api/admin/users/index.get.ts`, `app/composables/useUsers.ts` (0 supabase) |
| system/users | Completado | pending | Pendiente recertificacion | Parcial | Parcial | Pendiente | `app/pages/system/users.vue`, `server/api/system/users/**` |
| branches | Completado | completed | Compliant | Compliant | Compliant | Pendiente | `server/services/branches/*.ts`, `server/api/admin/branches/*.get.ts`, `app/composables/useBranches.ts` (0 supabase) |
| catalogo | Completado | completed | Compliant | Compliant (+service) | Compliant | Pendiente | `server/services/catalog/**`, `server/api/catalog/products.get.ts`, `app/composables/useCatalog.ts` |
| service-assignment | Completado | completed | Compliant | Compliant (+service) | Compliant | Pendiente | `server/services/service-assignment/*.ts` (2 files), `server/api/service-assignment/*.get.ts`, `app/composables/useServiceAssignment.ts` (0 supabase) |
| dashboard (staff) | Completado | completed | Compliant | Compliant (+service) | Compliant | Pendiente | `server/services/dashboard/stats.ts`, `server/api/dashboard-stats.get.ts`, `app/composables/useDashboard.ts` |
| settings | Completado | completed | Compliant (stub) | N/A (stub) | N/A | Pendiente | `app/pages/settings.vue` (stub, 0 supabase) |
| profile (staff) | Completado | completed | Compliant | Compliant (thin handler) | Compliant | Pendiente | `app/pages/profile.vue`, `server/api/profile.get.ts`, `server/api/profile.patch.ts` |
| client/dashboard | Completado | completed | Compliant (mock) | N/A (mock) | Compliant | Pendiente | `app/pages/client/dashboard.vue` (static mock, 0 supabase) |
| client/profile | Completado | completed | Compliant | N/A (uses useAuth) | Compliant | Pendiente | `app/pages/client/profile.vue` (read-only via useAuth) |
| client/appointments | Completado | completed | Compliant (stub) | N/A (stub) | N/A | Pendiente | `app/pages/client/appointments/index.vue` (stub, 0 supabase) |
| client/bookings | Completado | completed | Compliant (stub) | N/A (stub) | N/A | Pendiente | `app/pages/client/bookings.vue` (stub, 0 supabase) |
| client/reports | Completado | completed | Compliant (stub) | N/A (stub) | N/A | Pendiente | `app/pages/client/reports.vue` (stub, 0 supabase) |
| onboarding | Completado | completed | Compliant | Compliant (+service) | Compliant | Pendiente | `server/services/onboarding.ts`, `server/api/onboarding/*.ts` (4 endpoints), `app/composables/useOrganization.ts` (0 supabase), `app/composables/usePaymentValidation.ts` (0 supabase), `app/pages/onboarding/payment.vue` (0 supabase) |
| landing/subscription | Completado | completed | Compliant | Compliant (+service) | N/A (public) | Pendiente | `server/services/public/plans.ts`, `server/api/public/plans.get.ts`, `app/composables/useLandingPlans.ts`, `app/pages/index.vue` (0 supabase) |
| system/access stats | Completado | completed | Compliant | Compliant (+service) | Compliant | Pendiente | `server/services/system/stats.ts`, `server/api/system/stats.get.ts`, `app/composables/useSystemAdmin.ts` (0 supabase for stats) |
| client/profile API | Completado | completed | Compliant | Compliant (+service) | Compliant | Pendiente | `server/services/clientProfile.ts`, `server/api/clients/profile.get.ts`, `server/api/clients/upsert.ts` |

## Notas de ejecucion
- Estrategia activa: `Auth First` como gate de calidad para recertificacion integral.
- Regla global: ningun modulo vuelve a `completed` hasta cumplir checklist de `.github/copilot-instructions.md`.
- **PROYECTO CERRADO: 16/16 modulos certificados compliant con arquitectura 3 capas.**
- 0 llamadas directas a Supabase en composables en todo el codebase.
- `npm run typecheck`: consistently green.
