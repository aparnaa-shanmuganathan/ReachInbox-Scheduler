import { env } from "./config/env";
import { createApp } from "./app";
import { prisma } from "./config/db";
import { logger } from "./utils/logger";
import { ensureSendersProvisioned } from "./services/senderProvisioning";
import { reconcileScheduledEmails, startReconciliationLoop } from "./services/reconciliation";

async function main() {
  await ensureSendersProvisioned();

  // Run once immediately at boot — this is what makes "restart the server, future emails
  // still send" work even if the process crashed mid-enqueue before the restart.
  await reconcileScheduledEmails();
  const reconcileTimer = startReconciliationLoop();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 API server listening on ${env.BACKEND_URL} (port ${env.PORT})`);
  });

  async function shutdown(signal: string) {
    logger.info({ signal }, "API server shutting down");
    clearInterval(reconcileTimer);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error({ err }, "fatal startup error");
  process.exit(1);
});
