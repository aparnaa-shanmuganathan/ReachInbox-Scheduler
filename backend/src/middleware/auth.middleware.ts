import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface AuthTokenPayload {
  sub: string; // User.id
  email: string;
  name: string;
  avatarUrl: string | null;
}

// @types/passport already augments Express.Request with `user?: Express.User` and lets
// consumers extend the (empty-by-default) Express.User interface via declaration merging.
// We extend that interface instead of redeclaring Request.user ourselves, which would
// conflict with passport's declaration (TS requires merged properties to share one type).
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends AuthTokenPayload {}
  }
}

/**
 * Real auth: the token is issued server-side by us (see auth.routes.ts) only after a
 * successful Google OAuth handshake — this middleware just verifies that signed token on
 * every subsequent API call. The frontend sends it as `Authorization: Bearer <token>`.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
