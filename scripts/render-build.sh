#!/usr/bin/env bash
# Render build script — wraps DB-dependent commands in retry logic so the
# build survives Neon's free-tier auto-suspend cold starts.
#
# Without this, a build that hits a sleeping DB fails instantly with P1001
# "Can't reach database server" and the deploy never recovers.
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

echo "[render-build] Pushing schema (with retry)..."
retry npx prisma db push --accept-data-loss

echo "[render-build] Seeding member logins (with retry)..."
retry node scripts/seed-member-logins.mjs

echo "[render-build] Running Next build..."
npm run build

echo "[render-build] ✓ Build complete"
