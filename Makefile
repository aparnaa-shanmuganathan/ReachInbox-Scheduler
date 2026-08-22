# ReachInbox Scheduler — convenience commands.
# Run `make help` to see this list. Most of these just wrap docker compose / npm scripts
# so you don't have to remember which subdirectory a given command lives in.

.PHONY: help setup up down logs logs-api logs-worker restart migrate seed \
        backend-dev worker-dev frontend-dev test build clean

help:
	@echo "ReachInbox Scheduler"
	@echo ""
	@echo "  make setup          First-time setup (env files + deps, or Docker if available)"
	@echo "  make up             Build and start everything via Docker (detached)"
	@echo "  make down           Stop everything"
	@echo "  make restart        Restart all containers (tests the persistence story)"
	@echo "  make logs           Tail logs for all services"
	@echo "  make logs-api       Tail API server logs"
	@echo "  make logs-worker    Tail worker logs (send activity, Ethereal preview URLs)"
	@echo "  make migrate        Run Prisma migrations against the running Postgres"
	@echo ""
	@echo "  make backend-dev    Run the API server locally (no Docker)"
	@echo "  make worker-dev     Run the BullMQ worker locally (no Docker)"
	@echo "  make frontend-dev   Run the Next.js dashboard locally (no Docker)"
	@echo "  make test           Run backend unit tests"
	@echo ""
	@echo "  make clean          Remove node_modules/dist/.next build artifacts"

setup:
	./setup.sh

up:
	docker compose up --build -d

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f

logs-api:
	docker compose logs -f api

logs-worker:
	docker compose logs -f worker

migrate:
	docker compose exec api npx prisma migrate deploy

backend-dev:
	cd backend && npm run dev

worker-dev:
	cd backend && npm run worker:dev

frontend-dev:
	cd frontend && npm run dev

test:
	cd backend && npm test

clean:
	rm -rf backend/node_modules backend/dist frontend/node_modules frontend/.next
