#!/bin/sh
set -e

echo "→ Syncing database schema (prisma db push)…"
# Reachable internally over the Coolify network; retries while DB warms up
n=0
until node /prisma-cli/node_modules/prisma/build/index.js db push --schema=/app/prisma/schema.prisma --skip-generate --accept-data-loss; do
  n=$((n+1))
  if [ "$n" -ge 10 ]; then
    echo "✗ prisma db push failed after 10 attempts — starting server anyway"
    break
  fi
  echo "  db not ready, retrying in 3s ($n/10)…"
  sleep 3
done

echo "→ Seeding meeting rooms…"
node prisma/seed-rooms.mjs || echo "  room seed skipped"

echo "→ Starting Next.js server on :${PORT:-3000}"
exec node server.js
