# # Instrucciones para Codex y Copilot - NEXUS POS

## Estado actual del proyecto - Abril 2026
La app está al 50%. Ya implementado: auth con SUPABASEAUTH, CRUD de usuarios, organizaciones, sucursales, catalogo de productos y servicios, inventario y asignacion de servicio a empleado, onboarding con validacion de pago, dashboard admin y system. 
calendario de disponibilidad básico. Falta: pasarela de pago, panel cliente, pos, facturacion online SIAT.

## Critical Rules

1. **NEVER bypass Supabase RLS** - All database queries must respect Row Level Security
2. **ALWAYS filter queries by `organization_id`** - Multi-tenant queries require organization context
3. **NEVER store secrets in frontend code** - Use environment variables and server-side validation
4. **ALWAYS use `useSubscription()` composable** to check plan limits before operations
5. **ALWAYS use TypeScript strict mode** - No `any` types, strict null checks enabled
6. **VALIDATE user roles properly** - Use `is_system_user()` RPC for system role checks
7. **RESPECT middleware guards** - `system-only.ts`, `pending-account.global.ts`, etc.
8. **USE RPC functions for complex queries** - `admin_payment_validation_stats`, `is_system_user`, etc.

## User Roles & Access Control

### Role Types

- **System**: Platform administrators (separate `system_users` table)
- **Admin**: Organization owners (full access to their org)
- **Manager**: Branch managers (limited org access)
- **Employee**: Staff users (branch-specific access)
- **Client**: End customers (read-only access)

### Authentication Flow

- **Post-login redirection**: `resolvePostAuthDestination()` determines destination based on role
- **System users**: Redirect to `/system` (no organization required)
- **Regular users**: Onboarding flow if no organization, dashboard if active
- **Rate limiting**: Authentication attempts limited with progressive delays

### Middleware Guards

- `system-only.ts`: Validates system role via `system_users` table
- `pending-account.global.ts`: Blocks routes for organizations in "pending" status
- `account-status.ts`: General account validation
- `branch-access.ts`: Branch-specific permissions
- `permissions.ts`: Role-based route access

## System Administration

### System Admin Area (`/system/*`)

- **Dashboard**: Metrics, alerts, and quick actions
- **Payment Validations**: Review and approve organization onboarding payments
- **User Management**: CRUD operations on `system_users` table
- **Navigation**: Dynamic sidebar with `SYSTEM_NAVIGATION_ITEMS`

### Key Composables

- `useSystemAdmin()`: Dashboard stats, user CRUD, payment validations
- `usePaymentSystem()`: Payment validation workflow and stats
- `useAuth()`: Authentication with rate limiting
- `useRegistration()`: Onboarding and post-login redirection

## Onboarding & Payment Validation

### Onboarding Flow

1. **Registration**: Email/password with rate limiting
2. **Email Verification**: Required before proceeding
3. **Organization Setup**: Company details, timezone, currency
4. **Payment Submission**: Upload proof of payment
5. **Payment Validation**: System admin reviews and approves
6. **Activation**: Organization becomes active

### Payment Validation System

- **Status tracking**: `pending`, `approved`, `rejected`
- **File uploads**: Receipts stored in Supabase Storage with RLS
- **Audit trail**: All validations logged with reviewer info
- **Notifications**: Email alerts for status changes

## Tech Stack

- **Framework**: Nuxt 4 (Vue 3.5+) with SSR/SSG
- **Backend**: Supabase (PostgreSQL + Auth + RLS + Storage)
- **UI**: Nuxt UI (Tailwind CSS based) + Vue components
- **Types**: Auto-generated from Supabase schema (`database.types.ts`)
- **Database**: Supabase CLI for migrations and local development
- **State**: Pinia stores + Nuxt composables
- **Validation**: Zod schemas for form validation

## Code Style & Architecture

### File Structure

- **Components**: PascalCase, single-file `.vue` (auth/, admin/, ui/, etc.)
- **Composables**: camelCase with `use` prefix (`useAuth.ts`, `useSystemAdmin.ts`)
- **Pages**: File-based routing (`pages/` = routes, dynamic `[id].vue`)
- **Types**: Centralized in `types/` directory
- **Utils**: Helper functions in `utils/` (roles.ts, constants.ts, etc.)
- **Middleware**: Route guards in `middleware/` directory

### Navigation & Layout

- **Dynamic sidebar**: Changes based on user role (`SYSTEM_NAVIGATION_ITEMS`, etc.)
- **Layout system**: `layouts/default.vue` with role-aware navigation
- **Route meta**: `middleware` and `auth` properties on pages

### Database Patterns

- **RPC functions**: Complex queries via `supabase.rpc()`
- **RLS policies**: Automatic filtering by `organization_id` and user role
- **Audit logging**: All critical operations logged to `audit_logs`
- **Soft deletes**: Use `deleted_at` instead of hard deletes where possible

### Best Practices

- **Error handling**: Try/catch with user-friendly messages
- **Loading states**: Reactive loading flags in composables
- **Form validation**: Zod schemas with real-time feedback
- **Type safety**: Strict TypeScript with generated database types
- **Performance**: Lazy loading, pagination, and query optimization
