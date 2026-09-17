#!/usr/bin/env bash
set -euo pipefail
# This script runs inside a disposable --network none container. No host ports or volumes for DB.
cp -a /source/. /work/
mkdir -p /evidence
cd /work
case "${FACTORY_PHASE:?}" in
  unit)
    bun run lint
    bun run typecheck
    bun node_modules/typescript/bin/tsc --noEmit -p factory/tsconfig.json
    bun run test
    ;;
  e2e)
    # Credentials are generated for this disposable database only; never reuse .env.local from host.
    bun scripts/dev/provision-local-env.ts
    set -a
    source .env.local
    set +a
    export PAYLOAD_SCHEMA_PUSH=true
    pg_version=$(ls /usr/lib/postgresql | sort -V | tail -1)
    export PATH="/usr/lib/postgresql/$pg_version/bin:$PATH"
    install -d -o postgres -g postgres /tmp/factory-pg
    runuser -u postgres -- initdb -D /tmp/factory-pg --auth-local=trust --auth-host=trust > /evidence/postgres-init.log
    runuser -u postgres -- pg_ctl -D /tmp/factory-pg -l /tmp/factory-pg/server.log -o '-h 127.0.0.1 -p 55433' -w start
    trap 'runuser -u postgres -- pg_ctl -D /tmp/factory-pg -m immediate stop >/dev/null 2>&1 || true' EXIT
    runuser -u postgres -- createuser -h 127.0.0.1 -p 55433 hoteles
    runuser -u postgres -- createdb -h 127.0.0.1 -p 55433 -O hoteles hoteles
    bun run seed
    node node_modules/@playwright/test/cli.js test --config factory/ci/playwright.config.ts
    ;;
  build)
    # Build is independent of tests so a test cannot repair the source before this check.
    bun scripts/dev/provision-local-env.ts
    set -a
    source .env.local
    set +a
    cd apps/web
    node node_modules/next/dist/bin/next build
    ;;
  *) echo 'Unknown verification phase' >&2; exit 2 ;;
esac
