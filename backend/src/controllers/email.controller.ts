import { Request, Response } from "express";
import { prisma } from "../config/db";
import { CreateCampaignSchema, ListEmailsQuerySchema } from "../types/schemas";
import { parseRecipientsFromBuffer } from "../utils/parseLeads";
import { assertAttachmentAllowed } from "../utils/attachmentValidation";
import { createCampaignAndSchedule } from "../services/schedulerService";
import { ApiError } from "../middleware/errorHandler";

const ACTIVE_STATUSES = ["PENDING", "QUEUED", "PROCESSING", "RATE_LIMITED"] as const;
const TERMINAL_STATUSES = ["SENT", "FAILED"] as const;

export async function scheduleCampaign(req: Request, res: Response): Promise<void> {
  const body = CreateCampaignSchema.parse(req.body);
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;

  const leadsFile = files?.leadsFile?.[0];
  const fileRecipients = leadsFile ? parseRecipientsFromBuffer(leadsFile.buffer) : [];
  const manualRecipients = body.recipients ?? [];
  const recipients = Array.from(new Set([...fileRecipients, ...manualRecipients]));

  if (recipients.length === 0) {
    throw new ApiError(400, "No valid recipient email addresses found (upload a file or provide recipients).");
  }

  const attachmentFiles = files?.attachments ?? [];
  for (const file of attachmentFiles) {
    assertAttachmentAllowed(file.originalname);
  }
  const attachments = attachmentFiles.map((file) => ({
    filename: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    data: file.buffer,
  }));

  const campaign = await createCampaignAndSchedule({
    createdById: req.user!.sub,
    subject: body.subject,
    body: body.body,
    recipients,
    startTime: body.startTime,
    delayBetweenEmailsMs: body.delayBetweenEmailsMs,
    hourlyLimitPerSender: body.hourlyLimitPerSender,
    attachments,
  });

  res.status(201).json({
    campaign,
    recipientCount: recipients.length,
  });
}

export async function listScheduledEmails(req: Request, res: Response): Promise<void> {
  const { page, pageSize } = ListEmailsQuerySchema.parse(req.query);

  const [items, total] = await Promise.all([
    prisma.email.findMany({
      where: { status: { in: [...ACTIVE_STATUSES] } },
      orderBy: { scheduledFor: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { sender: { select: { fromEmail: true, label: true } } },
    }),
    prisma.email.count({ where: { status: { in: [...ACTIVE_STATUSES] } } }),
  ]);

  res.json({ items, total, page, pageSize });
}

export async function listSentEmails(req: Request, res: Response): Promise<void> {
  const { page, pageSize } = ListEmailsQuerySchema.parse(req.query);

  const [items, total] = await Promise.all([
    prisma.email.findMany({
      where: { status: { in: [...TERMINAL_STATUSES] } },
      orderBy: [{ sentAt: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { sender: { select: { fromEmail: true, label: true } } },
    }),
    prisma.email.count({ where: { status: { in: [...TERMINAL_STATUSES] } } }),
  ]);

  res.json({ items, total, page, pageSize });
}

export async function listSenders(_req: Request, res: Response): Promise<void> {
  const senders = await prisma.sender.findMany({
    where: { isActive: true },
    select: { id: true, label: true, fromEmail: true },
    orderBy: { createdAt: "asc" },
  });
  res.json({ senders });
}
