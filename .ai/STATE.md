# Multi-Agent Workflow State

## Current State
- **last_step**: inventory_get_api_handlers_created
- **pending**: [Ola 2] inventory_frontend_refactor
- **agent**: codex

## Refactor Waves
- **wave_0_completed**: auth (closed)
- **wave_1_in_progress**: inventory, appointments, pos, reports
- **wave_1_completed**: inventory (GET API + service layer)
- **wave_2_completed**: catalogo (service layer + 3-layer compliant)
- **wave_3_pending**: branches, service-assignment, client/*

## Module Compliance Ledger
- **in_progress_modules**:
  - inventory (wave 1)
- **completed_modules**:
  - auth (closed - 3-layer compliant)
  - dashboard (staff) - 3-layer compliance + service layer refactored
  - catalogo - service layer + compliant

## Auth Evidence (current iteration)
- Middleware guard hardening: `app/middleware/permissions.ts`
  - retry with `forceProfileRefresh + forceUserValidation` when profile is missing.
  - deny/redirect to `/auth/login` if context is still unresolved.
- Unified error contract in auth-related API endpoints:
  - `server/utils/http-error.ts` (shared helper `throwApiError`)
  - `server/api/profile.get.ts` (`AUTH_PROFILE_FETCH_ERROR`)
  - `server/api/auth/accessible-branches.get.ts` (`AUTH_ACCESSIBLE_BRANCHES_FETCH_ERROR`)
- Auth refactor aligned to clean architecture rules:
  - `app/utils/auth.ts` (sanitization/validation/domain auth helpers)
  - `app/composables/auth/useAuthAudit.ts` (audit concern extracted)
  - `app/composables/auth/useClientProfileState.ts` (client profile state/cache extracted)
  - `app/composables/useAuth.ts` reduced to facade/orchestrator keeping public API compatibility.
  - `app/composables/useAuth.ts` simplified with `executeAuthAction` wrapper to reduce duplicated submit/error flow.
  - `app/composables/useRegistration.ts` split post-auth destination rules into pure resolvers for maintainability.
  - `app/composables/auth/useAuthAudit.ts` now persists audit via backend endpoint `POST /api/auth/audit`.
  - Use-case diagram documented: `.ai/AUTH_USE_CASE_DIAGRAM.md`.

## Dashboard Evidence (current iteration)
- Service layer created: `server/services/dashboard/stats.ts`
  - Pure business logic for stats calculation (sales, appointments, products, customers)
  - Supports period filtering (7d/30d/90d) and branch filtering
  - Proper TypeScript typing with `TransactionRow`, error handling
- API handler refactored: `server/api/dashboard-stats.get.ts`
  - Reduced from 83 to 37 lines (delegate to service)
  - Input validation (branchId UUID regex), cache headers preserved
- Frontend composable refactored: `app/composables/useDashboard.ts`
  - `logBlockedFeatureAttempt` now uses `$fetch('/api/auth/audit')` instead of direct `supabase.from()`
  - Aligns with rule #5: no direct DB access in composables
- TypeScript types: `DashboardStatsParams`, `DashboardStatsResult` interfaces

## Acceptance Gate (dashboard)
- [x] Service layer created (`server/services/dashboard/stats.ts`)
- [x] API handler delegates to service (no business logic in handler)
- [x] Composable audit uses API endpoint (no direct DB)
- [x] `npm run typecheck` green
- [ ] Tests (pending: no test suite for dashboard stats)
- [x] Evidence logged in `FEATURE_TRACKER.md` and `HISTORY.md`

## Acceptance Gate (auth)
- [x] Frontend 3-layer audit completed (`pages/auth`, `composables/auth`, auth components)
- [x] `useAuth` confirmed as main auth gateway (exceptions: `useSessionAccess`, `useRegistration`)
- [x] Error contract `code/message/details` applied end-to-end
- [ ] Role/tenant route guards validated by direct URL access (bloqueado: entorno sin servidor local accesible)
- [x] `npm run typecheck` green
- [ ] auth-related tests green (bloqueado por entorno: vitest/esbuild spawn EPERM)
- [x] Evidence logged in `FEATURE_TRACKER.md` and `HISTORY.md`
- [x] **AUTH MODULE CLOSED** (typecheck green, arquitectura compliant)

## Catalogo Evidence (current iteration)
- Service layer created: `server/services/catalog/products.ts`, `services.ts`, `categories.ts`
  - Pure business logic for products, services, categories CRUD
  - Proper TypeScript typing
- API handlers refactored: `server/api/catalog/*.get.ts`
  - Reduced business logic to delegate to service layer
- Frontend composable refactored: `app/composables/useCatalog.ts`
  - Now uses `$fetch('/api/catalog/...')` instead of direct `supabase.from()`
  - Aligns with rule #5: no direct DB access in composables

## Acceptance Gate (catalogo)
- [x] Service layer created
- [x] API handlers delegate to service
- [x] Composable uses API endpoint (no direct DB)
- [x] `npm run typecheck` green
- [ ] Tests (pending)
- [x] Evidence logged


