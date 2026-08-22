import { prisma } from "../config/db";
import { emailQueue, enqueueEmailJob } from "../queues/emailQueue";
import { env } from "../config/env";
import { logger } from "../utils/logger";

/**
 * Belt-and-suspenders persistence: BullMQ + Redis AOF persistence already means delayed
 * jobs survive a plain process restart. This sweep additionally protects against the edge
 * cases that Redis persistence alone doesn't cover:
 *   - the API process crashing between committing Email rows and enqueueing their jobs
 *   - Redis losing data (AOF disabled, volume wiped, etc.) while Postgres rows persist
 *
 * It looks for Email rows that are still awaiting send (QUEUED/PENDING) whose scheduled
 * time hasn't already been handled, checks whether a BullMQ job with that deterministic
 * id exists, and re-enqueues if not. Because job ids are deterministic
 * (jobId === Email.id), this can run on a timer forever without ever creating a duplicate.
 */
export async function reconcileScheduledEmails(): Promise<void> {
  const pending = await prisma.email.findMany({
    where: { status: { in: ["PENDING", "QUEUED"] } },
    take: 2000,
  });

  let recovered = 0;
  for (const email of pending) {
    const existingJob = await emailQueue.getJob(email.id);
    if (existingJob) continue;

    await enqueueEmailJob(
      { emailId: email.id, campaignId: email.campaignId, senderId: email.senderId },
      email.scheduledFor,
    );
    recovered++;
  }

  if (recovered > 0) {
    logger.warn({ recovered }, "reconciliation sweep re-enqueued orphaned email jobs");
  }
}

export function startReconciliationLoop(): NodeJS.Timeout {
  logger.info(
    { intervalMs: env.RECONCILE_INTERVAL_MS },
    "starting scheduler reconciliation loop",
  );
  return setInterval(() => {
    reconcileScheduledEmails().catch((err) =>
      logger.error({ err }, "reconciliation sweep failed"),
    );
  }, env.RECONCILE_INTERVAL_MS);
}
