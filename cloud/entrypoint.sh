#!/bin/sh
set -e

echo "[Entrypoint] Running Prisma migrations..."
npx prisma migrate deploy

echo "[Entrypoint] Seeding database..."
npx prisma db seed || echo "[Entrypoint] Seed skipped or already applied"

echo "[Entrypoint] Starting server..."
exec node dist/index.js
