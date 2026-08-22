import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().url(),
  BACKEND_URL: z.string().url(),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("7d"),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CALLBACK_URL: z.string().url(),

  ETHEREAL_AUTO_CREATE: z.coerce.boolean().default(true),
  SENDER_COUNT: z.coerce.number().min(1).default(2),

  // Optional: when both are set, the api provisions a real Gmail SMTP sender on boot and
  // deactivates any Ethereal test senders instead of round-robining across both. Requires
  // an App Password (Google Account -> Security -> App passwords), not the account password.
  GMAIL_USER: z.string().email().optional(),
  GMAIL_APP_PASSWORD: z.string().min(1).optional(),

  MIN_DELAY_BETWEEN_EMAILS_MS: z.coerce.number().min(0).default(2000),
  WORKER_CONCURRENCY: z.coerce.number().min(1).default(5),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().min(1).default(200),
  RECONCILE_INTERVAL_MS: z.coerce.number().min(1000).default(60000),
}).refine((data) => Boolean(data.GMAIL_USER) === Boolean(data.GMAIL_APP_PASSWORD), {
  message: "GMAIL_USER and GMAIL_APP_PASSWORD must both be set, or both left unset",
  path: ["GMAIL_APP_PASSWORD"],
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast and loudly — a misconfigured scheduler that starts anyway is worse than one
  // that refuses to start.
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
