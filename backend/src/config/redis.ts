import { Redis } from "ioredis";
import { env } from "./env";
import { logger } from "../utils/logger";

// BullMQ requires maxRetriesPerRequest: null on the connection it manages internally.
// We create one shared connection and reuse it for the Queue, the Worker, and our own
// Redis-backed rate-limit counters, rather than opening a new socket per module.
export function createRedisConnection(name: string): Redis {
  const connection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  connection.on("connect", () => logger.info(`[redis:${name}] connected`));
  connection.on("error", (err) => logger.error({ err }, `[redis:${name}] connection error`));

  return connection;
}

export const redisConnection = createRedisConnection("shared");
