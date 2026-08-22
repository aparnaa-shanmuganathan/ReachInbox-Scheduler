// Combined API + worker entrypoint used ONLY for the free-tier hosted deployment (Render),
// where a background-worker service requires a paid plan. Locally and in docker-compose,
// the api (server.ts) and worker (queues/emailWorker.ts) run as intentionally separate
// processes — see README "Architecture" — so they can be scaled independently in a real
// deployment. This file just runs both in one process to stay on Render's free tier; it
// is not used anywhere in the local/Docker setup.
import "./server";
import "./queues/emailWorker";
