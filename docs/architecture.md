# FieldTrack Architecture Overview

## 1. Monorepo Structure

FieldTrack is organized as an npm workspaces monorepo separating the client application, backend API server, Supabase configuration, and documentation:

- `client/` — React + TypeScript + Vite single-page application styled with Tailwind CSS.
- `server/` — Independent Node.js + Express + TypeScript REST API server with Zod validation, Helmet security headers, and CORS protection.
- `supabase/` — Reserved directory for PostgreSQL migrations, Edge Functions, and local Supabase CLI configuration (to be implemented in later milestones).
- `docs/` — Technical architecture and system design documentation.

## 2. Client-Server Separation

The frontend and backend are decoupled packages with independent `package.json` and `tsconfig.json` files:

- **Client (`@fieldtrack/client`)**:
  - Serves the UI for two distinct operational personas:
    - **Field Workers**: Mobile-first interface designed for thumb-zone ergonomics, rapid field issue logging, and offline/sync visibility.
    - **Operations Coordinators**: Desktop-first analytical workspace with a dark navy sidebar, triage tables, severity tracking, and crew activity monitoring.
  - Communicates with the backend via HTTP requests targeting `VITE_API_BASE_URL` (proxied via Vite `/api` during local development).
  - Initializes the browser Supabase client in `client/src/lib/supabase.ts` using only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from `import.meta.env`.
  - Contains a dedicated `src/offline/` module boundary reserved for Dexie.js / IndexedDB integration in upcoming milestones.

- **Server (`@fieldtrack/server`)**:
  - Exposes versioned/namespaced REST endpoints under `/api/*`.
  - Enforces security middleware (`helmet`, strict `cors` origins) and standardized JSON error responses (`notFoundHandler`, `errorHandler`).
  - Validates request payloads and environment variables using `zod` (`server/src/config/env.ts`).
  - Initializes server-side Supabase clients in `server/src/config/supabase.ts` from `process.env`, keeping `SUPABASE_SECRET_KEY` strictly isolated on the server side and out of logs or API responses.

## 3. Data Flow (Current Milestone vs. Planned)

### Milestone 1 (Foundation)
- `GET /api/health` verifies backend availability and returns a structured JSON status with an ISO 8601 server timestamp.
- Frontend pages render using explicitly labeled sample data to validate navigation, responsive layouts, and the shared component design system.

### Planned Subsequent Milestones
1. **Authentication & RBAC**: Supabase Auth integration with role-aware routing (`worker` vs `coordinator`).
2. **Database & Storage**: PostgreSQL schema in `supabase/migrations/`, row-level security policies, and photo attachment storage.
3. **Offline-First Engine**: Dexie.js IndexedDB persistence in `client/src/offline/` with deterministic background synchronization and conflict handling.
