/**
 * Optional manual seeding script for pre-created Ethereal (or any real SMTP) accounts.
 * Only needed when ETHEREAL_AUTO_CREATE=false — by default the API server auto-provisions
 * senders on boot (see services/senderProvisioning.ts) and this script isn't required.
 *
 * Usage: fill in SENDERS below with real credentials, then `npm run seed`.
 */
import { prisma } from "../config/db";
import { logger } from "./logger";

const SENDERS: Array<{
  label: string;
  fromEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpSecure: boolean;
}> = [
  // {
  //   label: "Growth Team Sender",
  //   fromEmail: "growth@example.com",
  //   smtpHost: "smtp.ethereal.email",
  //   smtpPort: 587,
  //   smtpUser: "your-ethereal-user",
  //   smtpPass: "your-ethereal-pass",
  //   smtpSecure: false,
  // },
];

async function main() {
  if (SENDERS.length === 0) {
    logger.warn("No senders defined in seedSenders.ts — edit the SENDERS array first.");
    return;
  }

  for (const sender of SENDERS) {
    await prisma.sender.upsert({
      where: { fromEmail: sender.fromEmail },
      update: sender,
      create: sender,
    });
    logger.info({ fromEmail: sender.fromEmail }, "seeded sender");
  }
}

main()
  .catch((err) => {
    logger.error({ err }, "seed failed");
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
