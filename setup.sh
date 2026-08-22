#!/usr/bin/env bash
# ReachInbox Scheduler — one-shot bootstrap.
#
# What this does:
#   1. Creates backend/.env and frontend/.env.local from their .example files if missing.
#   2. If Docker is available: builds and starts everything (Postgres, Redis, API, worker,
#      frontend) via docker compose.
#   3. If Docker is NOT available: installs npm dependencies for both backend and frontend
#      so you can run each process manually (see the printed instructions at the end).
#
# Usage:
#   ./setup.sh
#
# This script is safe to re-run — it won't overwrite an .env file that already exists.

set -euo pipefail
cd "$(dirname "$0")"

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RESET='\033[0m'

log()  { echo -e "${GREEN}==>${RESET} $1"; }
warn() { echo -e "${YELLOW}!!${RESET} $1"; }

# --- 1. Env files -----------------------------------------------------------------
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  log "Created backend/.env from .env.example"
  warn "Edit backend/.env before going further: set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and JWT_SECRET."
else
  log "backend/.env already exists — leaving it as is."
fi

if [ ! -f frontend/.env.local ]; then
  cp frontend/.env.local.example frontend/.env.local
  log "Created frontend/.env.local from .env.local.example"
else
  log "frontend/.env.local already exists — leaving it as is."
fi

# --- 2. Check for required Google OAuth config before going further ---------------
if grep -q "your-google-oauth-client-id" backend/.env 2>/dev/null; then
  warn "backend/.env still has placeholder Google OAuth credentials."
  warn "Google Sign-In will not work until you set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET."
  warn "See README.md §3 for how to create them. Continuing anyway — you can fix this later."
fi

# --- 3. Docker path (preferred) ----------------------------------------------------
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  log "Docker detected — building and starting all services (Postgres, Redis, API, worker, frontend)."
  docker compose up --build -d

  echo ""
  log "Stack is starting. Useful commands:"
  echo "    docker compose logs -f api       # API server logs"
  echo "    docker compose logs -f worker    # BullMQ worker logs (send activity, Ethereal preview URLs)"
  echo "    docker compose logs -f           # everything"
  echo "    docker compose down              # stop everything"
  echo ""
  log "Dashboard:  http://localhost:3000"
  log "API:        http://localhost:4000/healthz"
  exit 0
fi

# --- 4. No Docker — fall back to local dev instructions ----------------------------
warn "Docker not found (or not running). Falling back to local installs."
warn "You'll need your own local Postgres and Redis running — see README.md §2."

log "Installing backend dependencies…"
(cd backend && npm install && npx prisma generate)

log "Installing frontend dependencies…"
(cd frontend && npm install)

echo ""
log "Dependencies installed. Next steps (run each in its own terminal):"
echo ""
echo "  ${BOLD}1) Run migrations (once, after Postgres is reachable):${RESET}"
echo "       cd backend && npm run prisma:migrate:dev"
echo ""
echo "  ${BOLD}2) Start the API server:${RESET}"
echo "       cd backend && npm run dev"
echo ""
echo "  ${BOLD}3) Start the BullMQ worker (separate process):${RESET}"
echo "       cd backend && npm run worker:dev"
echo ""
echo "  ${BOLD}4) Start the frontend:${RESET}"
echo "       cd frontend && npm run dev"
echo ""
log "Dashboard will be at http://localhost:3000 once all four are running."
