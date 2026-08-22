import { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";
import { logger } from "../utils/logger";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Validation failed", details: err.flatten() });
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err instanceof MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "One of your files is over the 50MB attachment limit."
        : err.code === "LIMIT_UNEXPECTED_FILE"
          ? "Too many files attached."
          : err.message;
    res.status(400).json({ error: message });
    return;
  }

  const message = err instanceof Error ? err.message : "Unknown error";
  logger.error({ err, path: req.path }, "unhandled error");
  res.status(500).json({ error: "Internal server error", message });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
}
