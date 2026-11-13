#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Checking local-only safety guards..."

# 1. Refuse to run if the workspace appears linked to a hosted Supabase project
if [[ -f "supabase/.temp/project-ref" ]] || [[ -f "supabase/.temp/gotrue-version" && -f "supabase/.temp/pooler-url" ]]; then
  echo "ERROR: Remote Supabase link artifacts detected in supabase/.temp/."
  echo "Refusing to run migration tests to protect your hosted Supabase project."
  exit 1
fi

# 2. Refuse any non-local database URLs if present in the shell environment
for var_name in DATABASE_URL SUPABASE_DB_URL POSTGRES_URL; do
  var_val="${!var_name:-}"
  if [[ -n "$var_val" ]]; then
    if [[ ! "$var_val" =~ ^postgres(ql)?://[^@]+@(127\.0\.0\.1|localhost)(:[0-9]+)?/ ]]; then
      echo "ERROR: $var_name is set to a non-local address."
      echo "Refusing to execute database tests while non-local DB connection strings are set."
      exit 1
    fi
  fi
done

# 3. Verify required local tools
if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker is not installed or not in PATH."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker daemon is not running. Start Docker Desktop / Docker Engine first."
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "ERROR: Supabase CLI is not installed or not in PATH."
  echo "Install it from https://supabase.com/docs/guides/cli"
  exit 1
fi

# 4. Ensure local Supabase containers are running (never using --linked)
if ! supabase status >/dev/null 2>&1; then
  echo "==> Starting isolated local Supabase stack..."
  supabase start
fi

LOCAL_DB_URL="$(supabase status -o env 2>/dev/null | awk -F= '/^DB_URL=/{gsub(/^"|"$/, "", $2); print $2}' || true)"
LOCAL_DB_URL="${LOCAL_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

if [[ ! "$LOCAL_DB_URL" =~ ^postgres(ql)?://[^@]+@(127\.0\.0\.1|localhost)(:[0-9]+)?/ ]]; then
  echo "ERROR: Resolved DB URL is not local ($LOCAL_DB_URL). Aborting."
  exit 1
fi

echo "==> Resetting isolated local database and applying migrations 0001-0006 + seed.sql..."
supabase db reset --local

echo "==> Executing isolated SQL schema, RLS, RPC, and Storage verification..."
if command -v psql >/dev/null 2>&1; then
  psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/01_schema_and_security.sql
else
  LOCAL_CONTAINER="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
  if [[ -z "$LOCAL_CONTAINER" ]]; then
    echo "ERROR: Neither host psql nor running supabase_db_* container was found."
    exit 1
  fi
  docker exec -i "$LOCAL_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/01_schema_and_security.sql
fi

echo "==> Verifying seed.sql executes cleanly with active sample profiles inside a rolled-back transaction..."
SEED_WRAPPER_SQL="$(mktemp)"
trap 'rm -f "$SEED_WRAPPER_SQL"' EXIT
cat > "$SEED_WRAPPER_SQL" <<'EOF'
BEGIN;
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'seed.worker@fieldtrack.local', '{"full_name":"Seed Worker"}'::jsonb),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2', 'seed.coord@fieldtrack.local', '{"full_name":"Seed Coordinator"}'::jsonb);
UPDATE public.profiles SET role = 'coordinator' WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2';
EOF
cat supabase/seed.sql | grep -Ev '^(BEGIN|COMMIT);[[:space:]]*$' >> "$SEED_WRAPPER_SQL"
cat >> "$SEED_WRAPPER_SQL" <<'EOF'
ROLLBACK;
EOF

if command -v psql >/dev/null 2>&1; then
  psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f "$SEED_WRAPPER_SQL"
else
  docker exec -i "$LOCAL_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$SEED_WRAPPER_SQL"
fi

echo "==> Isolated local migration & security tests passed!"
