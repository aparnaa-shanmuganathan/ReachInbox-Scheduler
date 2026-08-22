import nodemailer from "nodemailer";
import { prisma } from "../config/db";
import { env } from "../config/env";
import { logger } from "../utils/logger";

/**
 * Ensures at least SENDER_COUNT Sender rows exist, each backed by a real Ethereal test
 * SMTP account (https://ethereal.email). This runs once at API-server boot; it is
 * idempotent (checks existing count first) so it is safe to run on every deploy/restart.
 *
 * Priority: RESEND > Gmail SMTP > Ethereal. Whichever is configured (via env vars) takes
 * over entirely — that sender is (re)provisioned and every other sender is deactivated so
 * the round-robin in schedulerService only ever picks one real sender, never a mix.
 * Deactivating rather than deleting keeps existing Email rows' sender relation intact.
 * RESEND is checked first because it's the only option that works where raw SMTP ports are
 * network-blocked (e.g. Render's free tier) — see services/emailService.ts.
 */
export async function ensureSendersProvisioned(): Promise<void> {
  if (env.RESEND_API_KEY && env.RESEND_FROM_EMAIL) {
    await ensureResendSenderProvisioned(env.RESEND_API_KEY, env.RESEND_FROM_EMAIL);
    return;
  }

  if (env.GMAIL_USER && env.GMAIL_APP_PASSWORD) {
    await ensureGmailSenderProvisioned(env.GMAIL_USER, env.GMAIL_APP_PASSWORD);
    return;
  }

  const existing = await prisma.sender.count({ where: { isActive: true } });
  if (existing >= env.SENDER_COUNT) {
    logger.info({ count: existing }, "senders already provisioned");
    return;
  }

  if (!env.ETHEREAL_AUTO_CREATE) {
    logger.warn(
      "ETHEREAL_AUTO_CREATE is false and fewer than SENDER_COUNT senders exist — " +
        "seed the `senders` table manually before scheduling campaigns.",
    );
    return;
  }

  const toCreate = env.SENDER_COUNT - existing;
  logger.info({ toCreate }, "provisioning Ethereal test SMTP accounts");

  for (let i = 0; i < toCreate; i++) {
    const testAccount = await nodemailer.createTestAccount();

    await prisma.sender.create({
      data: {
        label: `ReachInbox Sender ${existing + i + 1}`,
        fromEmail: testAccount.user,
        smtpHost: testAccount.smtp.host,
        smtpPort: testAccount.smtp.port,
        smtpUser: testAccount.user,
        smtpPass: testAccount.pass,
        smtpSecure: testAccount.smtp.secure,
      },
    });

    logger.info({ user: testAccount.user }, "provisioned Ethereal sender");
  }
}

async function ensureGmailSenderProvisioned(user: string, appPassword: string): Promise<void> {
  await prisma.sender.updateMany({
    where: { fromEmail: { not: user }, isActive: true },
    data: { isActive: false },
  });

  await prisma.sender.upsert({
    where: { fromEmail: user },
    update: {
      smtpUser: user,
      smtpPass: appPassword,
      isActive: true,
    },
    create: {
      label: "Gmail",
      fromEmail: user,
      smtpHost: "smtp.gmail.com",
      smtpPort: 465,
      smtpUser: user,
      smtpPass: appPassword,
      smtpSecure: true,
    },
  });

  logger.info({ fromEmail: user }, "provisioned real Gmail sender; deactivated other senders");
}

async function ensureResendSenderProvisioned(apiKey: string, fromEmail: string): Promise<void> {
  await prisma.sender.updateMany({
    where: { fromEmail: { not: fromEmail }, isActive: true },
    data: { isActive: false },
  });

  await prisma.sender.upsert({
    where: { fromEmail },
    update: { apiKey, provider: "RESEND", isActive: true },
    create: {
      label: "Resend",
      fromEmail,
      provider: "RESEND",
      apiKey,
    },
  });

  logger.info({ fromEmail }, "provisioned Resend sender; deactivated other senders");
}
