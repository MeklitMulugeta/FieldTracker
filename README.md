# FieldTrack

FieldTrack is a professional, offline-first field issue tracking application designed for field technicians and operations coordinators.

## Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, React Router, Lucide React, `@supabase/supabase-js`
- **Backend**: Node.js, Express, TypeScript, CORS, Helmet, Zod, dotenv, `@supabase/supabase-js`
- **Cloud & Offline Layers**: Supabase (Auth & PostgreSQL), Dexie.js (IndexedDB, planned), Vitest

## Folder Structure

```text
fieldtrack/
├── client/                 # React + Vite frontend workspace
│   ├── src/
│   │   ├── components/     # common, layout, worker, coordinator components
│   │   ├── lib/            # Client Supabase instance and env validation (supabase.ts)
│   │   ├── pages/          # Login, Register, WorkerDashboard, CoordinatorDashboard, Reports
│   │   ├── services/       # API client and sample data
│   │   ├── hooks/          # Custom React hooks
│   │   ├── offline/        # Reserved boundary for Dexie.js offline storage
│   │   ├── types/          # Shared frontend TypeScript models
│   │   └── utils/          # Formatting and class helpers
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── .env.example
├── server/                 # Express + TypeScript backend workspace
│   ├── src/
│   │   ├── config/         # Environment validation (env.ts) and Supabase client (supabase.ts)
│   │   ├── controllers/    # HTTP route handlers
│   │   ├── middleware/     # 404, centralized error handling, logging
│   │   ├── routes/         # Express route definitions
│   │   ├── services/       # Business logic
│   │   ├── types/          # Backend API types
│   │   ├── validators/     # Zod request validation schemas
│   │   ├── app.ts
│   │   └── server.ts
│   ├── tests/              # Vitest + Supertest API and config tests
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── supabase/               # Reserved for migrations, functions, seed.sql, config.toml
├── docs/                   # System architecture documentation
├── package.json            # Root npm workspaces configuration
└── README.md
```

## Prerequisites

- Node.js `>= 20.0.0`
- npm `>= 10.0.0`

## Installation

Install dependencies for the root monorepo and all workspaces (`client` and `server`):

```bash
npm install
```

## Environment Variables & Local Setup

Create local `.env` files in both `client/` and `server/` from their `.env.example` templates before connecting to your Supabase project:

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

Populate each local file manually with your Supabase project credentials:

- **Client (`client/.env`)** — Public browser configuration only (read via `import.meta.env` in `client/src/lib/supabase.ts`):
  - `VITE_API_BASE_URL` — Backend API base URL (default `http://localhost:5000/api`)
  - `VITE_SUPABASE_URL` — Your Supabase Project URL
  - `VITE_SUPABASE_PUBLISHABLE_KEY` — Your Supabase Publishable Key (never place secret keys in `client/`)
- **Server (`server/.env`)** — Server-only configuration (read via `process.env` in `server/src/config/env.ts` and `server/src/config/supabase.ts`):
  - `PORT` — Express server port (default `5000`)
  - `CLIENT_ORIGIN` — Allowed CORS origin for local frontend development
  - `SUPABASE_URL` — Your Supabase Project URL
  - `SUPABASE_PUBLISHABLE_KEY` — Your Supabase Publishable Key
  - `SUPABASE_SECRET_KEY` — Your Supabase Secret Key (server-only; never expose to the browser, API responses, or logs)

**Security Rules**:
- `.env` and `.env.*` (except `.env.example`) are excluded from Git via `.gitignore`.
- Never commit real credentials into `.env.example`, source code, `package.json`, `tsconfig.json`, or documentation.
- Both `client` and `server` validate Supabase environment variables at startup and report missing variable names without displaying any credential values.

## Running the Applications

Run both client and server concurrently from the root:

```bash
npm run dev
```

Or run each workspace independently:

```bash
# Start the Vite frontend (port 3000)
npm run dev:client

# Start the Express API server (port 5000)
npm run dev:server
```

Verify the backend health endpoint:

```bash
curl http://localhost:5000/api/health
```

## Building & Type Checking

```bash
# Build both client and server
npm run build

# Build individually
npm run build:client
npm run build:server

# Type-check both workspaces
npm run lint
```

## Running Tests

```bash
# Run all workspace tests
npm run test

# Run tests individually
npm run test:client
npm run test:server
```
