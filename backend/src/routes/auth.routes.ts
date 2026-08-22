import { Router } from "express";
import jwt from "jsonwebtoken";
import type { User as PrismaUser } from "@prisma/client";
import passport from "../config/passport";
import { env } from "../config/env";
import { requireAuth } from "../middleware/auth.middleware";
import type { AuthTokenPayload } from "../middleware/auth.middleware";

export const authRouter = Router();

function issueToken(user: PrismaUser): string {
  const payload: AuthTokenPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
  };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}

// Step 1: browser hits this, gets redirected to Google's real consent screen.
authRouter.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"], session: false }),
);

// Step 2: Google redirects back here with the auth code. Passport exchanges it, our
// GoogleStrategy verify callback upserts the User row, and we issue a first-party JWT.
authRouter.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: `${env.FRONTEND_URL}/login?error=oauth_failed` }),
  (req, res) => {
    // Passport attaches whatever the GoogleStrategy verify callback returned (a Prisma
    // User row) to req.user for this one request — distinct from the AuthTokenPayload
    // shape that requireAuth() sets on every other authenticated route.
    const user = req.user as unknown as PrismaUser;
    const token = issueToken(user);
    // Hand the token to the SPA via a short-lived redirect param; the frontend immediately
    // stores it (see /auth/callback) and never puts it in a bookmark-able URL again.
    res.redirect(`${env.FRONTEND_URL}/auth/callback?token=${encodeURIComponent(token)}`);
  },
);

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

authRouter.post("/logout", requireAuth, (_req, res) => {
  // Stateless JWT: logout is a client-side token discard. Documented in the README as a
  // trade-off — a production system would use short-lived access tokens + a revocable
  // refresh token store.
  res.json({ ok: true });
});
