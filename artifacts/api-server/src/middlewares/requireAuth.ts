import type { Request, Response, NextFunction } from "express";
import { verifySupabaseJwt } from "../lib/supabaseJwt";
import { logger } from "../lib/logger";
import { AUTH_DISABLED, DEV_AUTH_ID, DEV_EMAIL } from "../lib/devAuth";

/**
 * Verifies the `Authorization: Bearer <jwt>` header against the Supabase JWT
 * secret and attaches `req.auth = { authId, email }`.
 *
 * Returns 401 on missing/invalid tokens. Any route that performs DB work on
 * behalf of a user MUST go through this middleware so `withUserScope` can
 * apply the right RLS subject.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Dev login bypass — inject a fixed, seeded identity instead of verifying.
  if (AUTH_DISABLED) {
    req.auth = { authId: DEV_AUTH_ID, email: DEV_EMAIL };
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing Authorization: Bearer header" });
    return;
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    res.status(401).json({ error: "Empty bearer token" });
    return;
  }

  try {
    const claims = await verifySupabaseJwt(token);
    req.auth = {
      authId: claims.sub,
      email: typeof claims["email"] === "string" ? (claims["email"] as string) : undefined,
    };
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    logger.warn({ err: message }, "auth: token verification failed");
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
