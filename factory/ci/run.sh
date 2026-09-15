#!/usr/bin/env bash
set -euo pipefail
# Use only on a disposable checkout. Candidate code is executed in fresh networkless containers.
root=$(pwd)
image=${FACTORY_CHECKS_IMAGE:-hoteles-factory-checks:local}
evidence=${FACTORY_EVIDENCE_DIR:?Set an absolute directory outside the checkout}
case "$evidence" in /*) ;; *) echo 'Evidence path must be absolute' >&2; exit 2;; esac
case "$evidence/" in "$root/"*) echo 'Evidence must live outside the candidate checkout' >&2; exit 2;; esac
test ! -e .env.local || { echo 'Refusing a checkout containing real local credentials' >&2; exit 2; }
mkdir -p "$evidence"
test ! -e "$evidence/phases.tsv" || { echo 'Use a fresh evidence directory for each run' >&2; exit 2; }
test -f bun.lock
docker build -t "$image" -f factory/ci/Dockerfile factory/ci
# Snapshot omits Git, credentials, orchestration and any previous outputs. Control is mounted read-only.
snapshot=$(mktemp -d)
trap 'rm -rf "$snapshot"' EXIT
tar --exclude='./.git' --exclude='./.github' --exclude='./.env*' --exclude='./.factory' --exclude='node_modules' \
    --exclude='./test-results' --exclude='./playwright-report' --exclude='./apps/web/.next' \
    -cf - . | tar -xf - -C "$snapshot"
cache=${FACTORY_BUN_CACHE:-$evidence/bun-cache}
mkdir -p "$cache"
start=$SECONDS
# Resolve/install Linux packages in the same OS as verification; do not copy macOS node_modules.
docker run --rm --user "$(id -u):$(id -g)" --cap-drop ALL --security-opt no-new-privileges \
    -e BUN_INSTALL_CACHE_DIR=/cache -e TMPDIR=/tmp \
    -v "$snapshot:/work" -v "$cache:/cache" "$image" \
    bun install --frozen-lockfile --ignore-scripts > "$evidence/install.log" 2>&1
printf '{"installationSeconds":%s}\n' "$((SECONDS-start))" > "$evidence/timing.json"
exit_code=0
for phase in ${FACTORY_PHASES:-unit e2e build}; do
  mkdir -p "$evidence/$phase"
  if docker run --rm --network none --cap-drop ALL --cap-add CHOWN --cap-add DAC_OVERRIDE \
      --cap-add FOWNER --cap-add SETUID --cap-add SETGID --security-opt no-new-privileges \
      --pids-limit 1024 --shm-size=1g -e "FACTORY_PHASE=$phase" \
      -v "$snapshot:/source:ro" -v "$root/factory/ci:/checks:ro" \
      -v "$evidence/$phase:/evidence" "$image" bash /checks/inside.sh \
      > "$evidence/$phase.log" 2>&1; then
    printf '%s passed\n' "$phase"
    printf '%s\t0\n' "$phase" >> "$evidence/phases.tsv"
  else
    phase_exit=$?
    exit_code=1
    printf '%s\t%s\n' "$phase" "$phase_exit" >> "$evidence/phases.tsv"
    printf '%s failed; see %s/%s.log\n' "$phase" "$evidence" "$phase"
    tail -35 "$evidence/$phase.log"
  fi
done
exit "$exit_code"
