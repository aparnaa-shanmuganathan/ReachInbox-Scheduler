import "../config/env"; // validate env before anything else touches it
import { Worker, Job } from "bullmq";
import { prisma } from "../config/db";
import { createRedisConnection, redisConnection } from "../config/redis";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import {
  EMAIL_QUEUE_NAME,
  EmailJobData,
  requeueForNextHourWindow,
  workerLimiterOptions,
} from "./emailQueue";
import { sendEmailViaSender } from "../services/emailService";
import { SenderHourlyRateLimiter } from "../services/rateLimiter";

const workerConnection = createRedisConnection("email-worker");
const rateLimiter = new SenderHourlyRateLimiter(redisConnection);

async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { emailId, senderId } = job.data;

  // --- Idempotency gate -----------------------------------------------------------
  // Atomically claim this email: only transition it out of QUEUED/PENDING once. If two
  // workers somehow pick up the same job (shouldn't happen with BullMQ's single delivery,
  // but this also protects against the reconciliation sweep racing a live job), only one
  // update affects a row — the other sees count === 0 and bails out without sending.
  const claim = await prisma.email.updateMany({
    where: { id: emailId, status: { in: ["QUEUED", "PENDING", "RATE_LIMITED"] } },
    data: { status: "PROCESSING" },
  });

  if (claim.count === 0) {
    logger.info({ emailId }, "email already claimed/sent — skipping duplicate delivery");
    return;
  }

  const email = await prisma.email.findUniqueOrThrow({
    where: { id: emailId },
    include: { sender: true, campaign: { include: { attachments: true } } },
  });

  // --- Hourly rate limit, enforced via Redis so it is correct across N worker processes ---
  // Each campaign can configure its own per-sender hourly cap; falls back to the global
  // MAX_EMAILS_PER_HOUR_PER_SENDER default if the campaign didn't set one.
  const { allowed, count } = await rateLimiter.tryReserveSlot(
    senderId,
    email.campaign.hourlyLimitPerSender,
  );
  if (!allowed) {
    logger.warn(
      { emailId, senderId, count },
      "sender hourly limit reached — deferring to next hour window",
    );
    await prisma.email.update({
      where: { id: emailId },
      data: { status: "RATE_LIMITED" },
    });
    await requeueForNextHourWindow(job.data);
    return;
  }

  // --- Actually send ---------------------------------------------------------------
  try {
    const result = await sendEmailViaSender({
      sender: email.sender,
      to: email.recipient,
      subject: email.subject,
      html: email.body,
      attachments: email.campaign.attachments.map((a) => ({
        filename: a.filename,
        content: a.data,
        contentType: a.mimeType,
      })),
    });

    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: "SENT",
        sentAt: new Date(),
        attempts: { increment: 1 },
        lastError: null,
      },
    });

    logger.info(
      { emailId, to: email.recipient, previewUrl: result.previewUrl },
      "email sent",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const attempts = (job.attemptsMade ?? 0) + 1;
    const isFinalAttempt = attempts >= (job.opts.attempts ?? 1);

    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: isFinalAttempt ? "FAILED" : "QUEUED",
        attempts: { increment: 1 },
        lastError: message,
      },
    });

    logger.error({ emailId, err: message, attempts, isFinalAttempt }, "email send failed");
    throw err; // let BullMQ apply its configured backoff/retry
  }
}

export const emailWorker = new Worker<EmailJobData>(EMAIL_QUEUE_NAME, processEmailJob, {
  connection: workerConnection,
  concurrency: env.WORKER_CONCURRENCY,
  limiter: workerLimiterOptions,
});

emailWorker.on("completed", (job) => logger.debug({ jobId: job.id }, "job completed"));
emailWorker.on("failed", (job, err) =>
  logger.error({ jobId: job?.id, err: err.message }, "job failed"),
);

async function shutdown(signal: string) {
  logger.info({ signal }, "email worker shutting down");
  await emailWorker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

logger.info(
  { concurrency: env.WORKER_CONCURRENCY, minDelayMs: env.MIN_DELAY_BETWEEN_EMAILS_MS },
  "email worker started",
);
