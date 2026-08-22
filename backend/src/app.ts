import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import passport from "./config/passport";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { authRouter } from "./routes/auth.routes";
import { emailRouter } from "./routes/email.routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/healthz" } }));
  app.use(passport.initialize());

  app.get("/healthz", (_req, res) => res.json({ status: "ok", uptime: process.uptime() }));

  app.use("/api/auth", authRouter);
  app.use("/api", emailRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
