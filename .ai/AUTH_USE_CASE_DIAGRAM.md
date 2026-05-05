# Auth Module - Use Case Diagram by Layers

## Scope
- Module: `auth` (Ola 0 - Auth First)
- Architecture view: Presentacion / Aplicacion / Infraestructura

## Diagram (Mermaid)
```mermaid
flowchart LR
  subgraph P[Presentacion]
    UI1[Login Page]
    UI2[Registro y Onboarding]
    UI3[Profile Page]
    UI4[Route Middleware]
  end

  subgraph A[Aplicacion]
    C1[useAuth]
    C2[useUserContext]
    C3[useRegistration]
    C4[useAuthAudit]
    U1[Caso: Iniciar sesion]
    U2[Caso: Registrar usuario]
    U3[Caso: Cargar/Actualizar perfil]
    U4[Caso: Resolver destino post-auth]
    U5[Caso: Guardar/Cargar onboarding progress]
    U6[Caso: Auditar evento critico]
  end

  subgraph I[Infraestructura]
    S1[Supabase Auth SDK]
    E1[GET /api/profile]
    E2[PATCH /api/profile]
    E3[GET /api/auth/post-auth-context]
    E4[GET /api/auth/onboarding-progress]
    E5[POST /api/auth/onboarding-progress]
    E6[POST /api/auth/audit]
    DB[(Supabase DB)]
    AU[(Supabase Auth)]
  end

  UI1 --> C1
  UI2 --> C3
  UI3 --> C1
  UI4 --> C2

  C1 --> U1
  C1 --> U3
  C3 --> U2
  C3 --> U4
  C3 --> U5
  C4 --> U6

  U1 --> S1
  U2 --> S1
  U3 --> E1
  U3 --> E2
  U4 --> E3
  U5 --> E4
  U5 --> E5
  U6 --> E6

  S1 --> AU
  E1 --> DB
  E2 --> DB
  E3 --> DB
  E4 --> DB
  E5 --> DB
  E6 --> DB
```

## Notes
- Session lifecycle stays in client (`supabase.auth.*`) to preserve browser session/cookies.
- Business data and tenant-sensitive writes are resolved through backend endpoints (`/api/*`).
- Auth audit is now backend-only via `POST /api/auth/audit`.
