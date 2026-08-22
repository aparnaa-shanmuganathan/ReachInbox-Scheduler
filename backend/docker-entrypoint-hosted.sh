#!/bin/sh
# Entrypoint for the free-tier hosted deployment (Render) only — see render.yaml and
# src/hostedServer.ts. A plain shell command string passed via Render's `dockerCommand`
# is not reliably shell-parsed (quoting gets mangled), so this runs as a real script
# instead: migrate the database, then start the combined api+worker process.
set -e
npx prisma migrate deploy
exec node dist/hostedServer.js
