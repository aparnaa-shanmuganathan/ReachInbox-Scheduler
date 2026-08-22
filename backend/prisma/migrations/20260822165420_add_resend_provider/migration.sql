-- CreateEnum
CREATE TYPE "SenderProvider" AS ENUM ('SMTP', 'RESEND');

-- AlterTable
ALTER TABLE "senders" ADD COLUMN     "apiKey" TEXT,
ADD COLUMN     "provider" "SenderProvider" NOT NULL DEFAULT 'SMTP',
ALTER COLUMN "smtpHost" DROP NOT NULL,
ALTER COLUMN "smtpPort" DROP NOT NULL,
ALTER COLUMN "smtpUser" DROP NOT NULL,
ALTER COLUMN "smtpPass" DROP NOT NULL;
