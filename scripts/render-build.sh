#!/usr/bin/env bash
# Render build script.
# Keep build DB-free by default so deploys don't fail when the hosted pool
# is saturated (e.g. Supabase pooler "max clients reached").
set -euo pipefail

retry() {
  local max=6
  local delay=10
  local i=1
  while true; do
    echo "[render-build] Attempt $i/$max: $*"
    if "$@"; then
      return 0
    fi
    if [ "$i" -ge "$max" ]; then
      echo "[render-build] ✗ Giving up after $max attempts"
      return 1
    fi
    echo "[render-build] Failed — waiting ${delay}s for DB to wake..."
    sleep "$delay"
    i=$((i + 1))
  done
}

echo "[render-build] Installing dependencies..."
npm install --include=dev

echo "[render-build] Generating Prisma client..."
npx prisma generate

if [ "${RUN_DB_JOBS_ON_BUILD:-0}" = "1" ]; then
  echo "[render-build] RUN_DB_JOBS_ON_BUILD=1 -> running DB jobs"
  echo "[render-build] Pushing schema (with retry)..."
  retry npx prisma db push --accept-data-loss

  echo "[render-build] Restoring QC data — team, watches, tasks (with retry)..."
  retry node scripts/restore-qc-data.mjs

  echo "[render-build] Seeding member logins (with retry)..."
  retry node scripts/seed-member-logins.mjs
else
  echo "[render-build] Skipping DB jobs during build (safe mode)."
fi

echo "[render-build] Running Next build..."
npm run build

echo "[render-build] ✓ Build complete"
