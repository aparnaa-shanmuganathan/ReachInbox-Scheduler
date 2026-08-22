import nodemailer, { Transporter } from "nodemailer";
import type { Sender } from "@prisma/client";
import { logger } from "../utils/logger";

const transporterCache = new Map<string, Transporter>();

function getTransporter(sender: Sender): Transporter {
  const cached = transporterCache.get(sender.id);
  if (cached) return cached;

  const transporter = nodemailer.createTransport({
    host: sender.smtpHost,
    port: sender.smtpPort,
    secure: sender.smtpSecure,
    auth: { user: sender.smtpUser, pass: sender.smtpPass },
  });

  transporterCache.set(sender.id, transporter);
  return transporter;
}

export interface SendEmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface SendEmailInput {
  sender: Sender;
  to: string;
  subject: string;
  html: string;
  attachments?: SendEmailAttachment[];
}

export interface SendEmailResult {
  messageId: string;
  previewUrl: string | false;
}

export async function sendEmailViaSender(input: SendEmailInput): Promise<SendEmailResult> {
  const transporter = getTransporter(input.sender);

  const info = await transporter.sendMail({
    from: `"${input.sender.label}" <${input.sender.fromEmail}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
    attachments: input.attachments,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  logger.debug({ to: input.to, previewUrl }, "email dispatched via Ethereal");

  return { messageId: info.messageId, previewUrl };
}
