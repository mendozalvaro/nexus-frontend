# Nexus POS - Frontend

## Project Overview

**Nexus POS** (nexus-frontend) is a multi-tenant SaaS Point of Sale (POS) application built with **Nuxt 4** (Vue 3). It supports businesses that sell both products and services, with appointment scheduling, inventory management, user roles, and subscription-based feature gating.

The application is deployed to **Cloudflare Pages** and uses **Supabase** as its backend (PostgreSQL database, authentication, and Row Level Security).

### Key Features

- **Multi-Tenancy**: Organizations (tenants) with isolated data via RLS policies
- **Subscription Plans**: Tiered plans with feature gating (branches, users, inventory transfers, API access, white label, advanced reports, forensic export)
- **Branch Management**: Multi-branch support with employee assignments per branch
- **User Roles**: `admin`, `manager`, `employee`, `client` with role-based access control
- **Catalog**: Products (with inventory tracking, SKU, stock movements) and Services (with duration and pricing)
- **Appointments**: Scheduling with conflict detection (EXCLUDE constraints), status flow management
- **POS Transactions**: Hybrid product + service transactions with multiple payment methods
- **Forensic Audit Logs**: Immutable audit trail with checksums for critical tables
- **Landing Pages**: Public marketing pages (pricing, about, terms, privacy)

### Tech Stack

| Category   | Technology                            |
| ---------- | ------------------------------------- |
| Framework  | Nuxt 4 (Vue 3)                        |
| UI Library | Nuxt UI v4                            |
| Backend    | Supabase (PostgreSQL + Auth)          |
| Charts     | ApexCharts (vue3-apexcharts)          |
| Validation | Zod                                   |
| Deployment | Cloudflare Pages (via Wrangler)       |
| Language   | TypeScript (strict mode)              |
| Color Mode | @nuxtjs/color-mode (dark/light theme) |

## Project Structure

```
nexus-frontend/
├── app/                      # Nuxt app directory
│   ├── assets/               # CSS, images, fonts
│   ├── components/           # Vue components (organized by feature)
│   │   ├── admin/            # Admin-specific components
│   │   ├── auth/             # Authentication components
│   │   ├── base/             # Base/shared UI components
│   │   ├── business/         # Business logic components
│   │   ├── charts/           # Chart components
│   │   ├── dashboard/        # Dashboard widgets
│   │   ├── features/         # Feature-specific components
│   │   ├── forms/            # Form components
│   │   ├── landing/          # Landing page components
│   │   ├── layout/           # Layout components
│   │   ├── modals/           # Modal dialogs
│   │   ├── onboarding/       # Onboarding flow components
│   │   ├── receipts/         # Receipt components
│   │   ├── reports/          # Report components
│   │   ├── system/           # System admin components
│   │   └── ui/               # Generic UI components
│   ├── composables/          # Vue composables (30+ composables)
│   ├── config/               # Configuration files
│   ├── layouts/              # Page layouts
│   ├── middleware/           # Route middleware
│   ├── pages/                # File-based routing
│   │   ├── auth/             # Login, register, callback
│   │   ├── client/           # Client-facing pages
│   │   ├── onboarding/       # Organization onboarding
│   │   └── system/           # System admin pages
│   ├── types/                # TypeScript type definitions
│   └── utils/                # Utility functions
├── server/                   # Nuxt server-side API routes
│   ├── api/                  # API endpoints (organized by domain)
│   └── utils/                # Server utilities
├── plugins/                  # Nuxt plugins
├── public/                   # Static assets
├── supabase/                 # Supabase configuration (ignored)
├── nuxt.config.ts            # Nuxt configuration
├── wrangler.toml             # Cloudflare Workers/Pages config
├── schema.sql                # Complete database schema
└── package.json              # Dependencies and scripts
```

## Building and Running

### Prerequisites

- Node.js (LTS recommended)
- npm, pnpm, yarn, or bun
- Supabase project (for backend)
- Environment variables (see `.env` requirements below)

### Setup

```bash
# Install dependencies
npm install

# Generate Supabase types (requires SUPABASE_PROJECT_ID env var)
npm run supabase:types
```

### Development

```bash
# Start dev server on http://localhost:3000
npm run dev
```

### Production

```bash
# Build for production
npm run build

# Preview production build locally
npm run preview

# Generate static site
npm run generate
```

### Code Quality

```bash
# Run ESLint
npm run lint

# Fix linting issues
npm run lint:fix

# Run TypeScript type checking
npm run typecheck
```

### Deployment

Deployed to Cloudflare Pages:

```bash
# Build output is in .output/public (configured in wrangler.toml)
npm run build
```

### Environment Variables

Required environment variables (see `.gitignore` - use `.env` file):

| Variable                         | Description                                  |
| -------------------------------- | -------------------------------------------- |
| `NUXT_PUBLIC_SUPABASE_URL`       | Supabase project URL                         |
| `NUXT_PUBLIC_SUPABASE_ANON_KEY`  | Supabase anonymous key                       |
| `NUXT_SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `SUPABASE_PROJECT_ID`            | Supabase project ID (for type generation)    |

## Database Schema

The database schema is defined in `schema.sql`. Key tables include:

- **`organizations`** - Multi-tenant tenants
- **`subscription_plans`** - Plan definitions with feature flags
- **`organization_subscriptions`** - Active subscriptions per org
- **`branches`** - Business locations
- **`profiles`** - User profiles linked to auth.users
- **`employee_branch_assignments`** - Multi-branch employee assignments
- **`products`** / **`services`** - Catalog items
- **`inventory_stock`** / **`inventory_movements`** - Inventory tracking
- **`appointments`** - Service appointments with conflict detection
- **`transactions`** / **`transaction_items`** - POS transactions
- **`audit_logs`** - Forensic audit trail (append-only, admin read-only)

All tables have Row Level Security (RLS) enabled with policies enforcing organization isolation and role-based access.

## Composables

The application has 30+ composables organized by domain:

- **Auth**: `useAuth`, `useAuthContext`, `useAuthRateLimit`, `useSessionAccess`
- **Business**: `useBranches`, `useBranchSelector`, `useCatalog`, `useInventory`, `useAppointments`, `usePOS`
- **User Management**: `useUsers`, `useRegistration`, `useOrganization`
- **System**: `useSystemAdmin`, `useSubscription`, `useFeatureFlags`, `useForensic`
- **UI/UX**: `useTheme`, `useNotifications`, `useNavigation`, `useDashboard`
- **Operations**: `usePaymentSystem`, `usePaymentValidation`, `useServiceAssignment`, `useReports`
- **Other**: `useLanding`, `useOnboarding`, `useSupabase`, `usePermissions`, `useCatalogMedia`

## Development Conventions

### TypeScript

- **Strict mode** is enabled (`strict: true` in `tsconfig.json`)
- All rules active: `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, etc.
- Path aliases: `@/` and `~/` resolve to `app/`, `@@/` and `~~/` resolve to project root

### Code Style

- ESLint is configured via `@nuxt/ui` module
- Run `npm run lint:fix` to auto-fix style issues
- Vue 3 Composition API with `<script setup>` syntax

### Routing

- File-based routing via Nuxt (`app/pages/` directory)
- Auth middleware protects routes (configured in `nuxt.config.ts` supabase module)
- Public routes: `/`, `/pricing`, `/about`, `/terms`, `/privacy`, `/auth/**`, `/test-all-composables`
- Protected routes: All others redirect to `/auth/login` if not authenticated

### Component Organization

Components are organized by feature domain under `app/components/`. Use descriptive naming conventions that indicate purpose (e.g., `DashboardStats.vue`, `AuthLoginForm.vue`).

## Key Configuration

### Supabase Module (`nuxt.config.ts`)

- Auto-redirect to login for protected routes
- Cookie prefix: `nexuspos-auth`
- Session cookie max-age: 7 days

### Nitro Preset

- Deploy target: `cloudflare-pages`
- Build output: `.output/public`

### Compatibility Date

- Nuxt: `2025-07-15`
- Wrangler/Cloudflare: `2025-01-01`

## Lanaguage

- Code: English Sintax
- Talk: Spanish
