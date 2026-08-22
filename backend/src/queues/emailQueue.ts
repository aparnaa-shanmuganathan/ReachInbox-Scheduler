import { Queue } from "bullmq";
import { createRedisConnection } from "../config/redis";
import { env } from "../config/env";

export const EMAIL_QUEUE_NAME = "email-send";

export interface EmailJobData {
  emailId: string; // Postgres Email.id — the durable source of truth
  campaignId: string;
  senderId: string;
}

const connection = createRedisConnection("email-queue");

// The queue itself is backed by Redis. As long as Redis persistence (AOF, enabled in the
// provided docker-compose) is on, every delayed job survives a Node process restart AND
// a Redis restart without any cron process re-deriving "what should run when" — BullMQ's
// delayed-job zset *is* the schedule.
export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    // Exponential backoff on transient SMTP failures.
    attempts: 4,
    backoff: { type: "exponential", delay: 5000 },
    // Keep a bounded history in Redis; Postgres remains the durable/queryable record.
    removeOnComplete: { age: 3600, count: 5000 },
    removeOnFail: { age: 86400, count: 5000 },
  },
});

/**
 * Enqueue (or re-enqueue) a single email as a BullMQ delayed job.
 *
 * Idempotency: jobId is deterministic (== the Postgres Email row id). BullMQ silently
 * no-ops if a job with that id already exists, so calling this twice for the same email
 * (e.g. once from the API, once from the restart-reconciliation sweep) can never create a
 * duplicate job.
 */
export async function enqueueEmailJob(
  data: EmailJobData,
  scheduledFor: Date,
): Promise<void> {
  const delay = Math.max(0, scheduledFor.getTime() - Date.now());

  await emailQueue.add(EMAIL_QUEUE_NAME, data, {
    jobId: data.emailId,
    delay,
  });
}

/** Re-enqueue a job that was deferred because its sender's hourly quota was exhausted. */
export async function requeueForNextHourWindow(data: EmailJobData): Promise<void> {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);

  await emailQueue.add(EMAIL_QUEUE_NAME, data, {
    jobId: `${data.emailId}:retry:${nextHour.getTime()}`,
    delay: nextHour.getTime() - now.getTime(),
  });
}

export const emailQueueConnection = connection;

export const workerLimiterOptions = {
  // Enforces a MINIMUM DELAY BETWEEN INDIVIDUAL SENDS across the whole worker: BullMQ's
  // rate limiter allows at most `max` jobs to *start* every `duration` ms, queue-wide.
  // With max: 1, this is exactly "at least MIN_DELAY_BETWEEN_EMAILS_MS between sends"
  // regardless of how many concurrent workers are running.
  max: 1,
  duration: env.MIN_DELAY_BETWEEN_EMAILS_MS,
};
