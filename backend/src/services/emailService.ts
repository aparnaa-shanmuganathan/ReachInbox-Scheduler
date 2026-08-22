import nodemailer, { Transporter } from "nodemailer";
import type { Sender } from "@prisma/client";
import { logger } from "../utils/logger";

const transporterCache = new Map<string, Transporter>();

function getTransporter(sender: Sender): Transporter {
  const cached = transporterCache.get(sender.id);
  if (cached) return cached;

  if (!sender.smtpHost || !sender.smtpPort || !sender.smtpUser || !sender.smtpPass) {
    throw new Error(`Sender ${sender.id} is missing SMTP config (provider=${sender.provider})`);
  }

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
  if (input.sender.provider === "RESEND") {
    return sendViaResendApi(input);
  }
  return sendViaSmtp(input);
}

async function sendViaSmtp(input: SendEmailInput): Promise<SendEmailResult> {
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

// HTTP-API delivery via Resend (https://resend.com), used where raw SMTP ports are
// network-blocked (e.g. Render's free tier blocks outbound 25/465/587 entirely). Talks
// over HTTPS (port 443), so it isn't affected by that block.
async function sendViaResendApi(input: SendEmailInput): Promise<SendEmailResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.sender.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${input.sender.label} <${input.sender.fromEmail}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      attachments: input.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content.toString("base64"),
      })),
    }),
  });

  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) {
    throw new Error(`Resend API error (${res.status}): ${body.message ?? JSON.stringify(body)}`);
  }

  logger.debug({ to: input.to, id: body.id }, "email dispatched via Resend");
  return { messageId: body.id ?? "", previewUrl: false };
}
