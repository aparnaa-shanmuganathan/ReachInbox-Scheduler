import { prisma } from "../config/db";
import { enqueueEmailJob } from "../queues/emailQueue";
import { logger } from "../utils/logger";

export interface CampaignAttachmentInput {
  filename: string;
  mimeType: string;
  size: number;
  data: Buffer;
}

export interface CreateCampaignInput {
  createdById: string;
  subject: string;
  body: string;
  recipients: string[]; // parsed, deduped, validated email addresses
  startTime: Date;
  delayBetweenEmailsMs: number;
  hourlyLimitPerSender: number;
  attachments?: CampaignAttachmentInput[];
}

/**
 * Creates a Campaign + one Email row per recipient, assigns senders round-robin, computes
 * each recipient's scheduledFor time by spacing them delayBetweenEmailsMs apart starting
 * at startTime, and enqueues each as a BullMQ delayed job.
 *
 * This is intentionally NOT a single giant transaction around the Redis enqueue calls:
 * Postgres rows are committed first (source of truth), then jobs are enqueued. If the
 * process crashes between those two steps, the periodic reconciliation sweep
 * (see reconciliation.ts) picks up any PENDING rows with no jobId and enqueues them —
 * so nothing is silently lost even under 1000+ row campaigns.
 */
export async function createCampaignAndSchedule(input: CreateCampaignInput) {
  const senders = await prisma.sender.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (senders.length === 0) {
    throw new Error("No senders configured. Cannot schedule a campaign.");
  }

  const campaign = await prisma.campaign.create({
    data: {
      subject: input.subject,
      body: input.body,
      delayBetweenEmailsMs: input.delayBetweenEmailsMs,
      hourlyLimitPerSender: input.hourlyLimitPerSender,
      startTime: input.startTime,
      totalRecipients: input.recipients.length,
      createdById: input.createdById,
    },
  });

  if (input.attachments && input.attachments.length > 0) {
    await prisma.attachment.createMany({
      data: input.attachments.map((a) => ({
        campaignId: campaign.id,
        filename: a.filename,
        mimeType: a.mimeType,
        size: a.size,
        data: a.data,
      })),
    });
  }

  // Round-robin sender assignment + strictly increasing scheduledFor per recipient.
  // Order is preserved as-uploaded, which is what "preserving order as much as possible"
  // under rate-limiting/backpressure means downstream in the worker.
  const emailRows = input.recipients.map((recipient, index) => ({
    campaignId: campaign.id,
    senderId: senders[index % senders.length].id,
    recipient,
    subject: input.subject,
    body: input.body,
    scheduledFor: new Date(input.startTime.getTime() + index * input.delayBetweenEmailsMs),
  }));

  // Batch insert. createMany doesn't return rows, so we re-fetch by campaignId to get ids
  // for enqueueing — cheap relative to the insert itself and keeps this correct for
  // 1000+ recipients without holding everything in one giant `create` loop.
  await prisma.email.createMany({ data: emailRows });

  const createdEmails = await prisma.email.findMany({
    where: { campaignId: campaign.id },
    orderBy: { scheduledFor: "asc" },
  });

  let enqueued = 0;
  for (const email of createdEmails) {
    await enqueueEmailJob(
      { emailId: email.id, campaignId: campaign.id, senderId: email.senderId },
      email.scheduledFor,
    );
    enqueued++;
  }

  await prisma.email.updateMany({
    where: { campaignId: campaign.id, status: "PENDING" },
    data: { status: "QUEUED" },
  });

  logger.info(
    { campaignId: campaign.id, recipients: createdEmails.length, enqueued },
    "campaign scheduled",
  );

  return campaign;
}
