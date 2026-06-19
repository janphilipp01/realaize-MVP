import type { Request, Response, NextFunction } from "express";
import { and, eq } from "drizzle-orm";
import { withUserScope, memberships, users } from "@workspace/db";
import { AUTH_DISABLED, DEV_ORG_ID, DEV_ROLE } from "../lib/devAuth";

/**
 * Reads `X-Org-Id` from the request, verifies the authenticated user is a
 * member of that org, and attaches `req.org = { id, role }`.
 *
 * Must be mounted AFTER requireAuth — relies on `req.auth.authId`.
 *
 * Defense-in-depth: even though RLS would block cross-org reads, we fail fast
 * here with 403 to keep error semantics clear and avoid leaking row counts.
 */
export async function requireOrg(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Dev login bypass — act against the fixed seeded org as admin.
  if (AUTH_DISABLED) {
    req.org = { id: DEV_ORG_ID, role: DEV_ROLE };
    next();
    return;
  }

  if (!req.auth) {
    res.status(401).json({ error: "Unauthenticated" });
    return;
  }

  const headerVal = req.headers["x-org-id"];
  const orgId = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  if (!orgId || typeof orgId !== "string") {
    res.status(400).json({ error: "Missing X-Org-Id header" });
    return;
  }

  try {
    const row = await withUserScope(req.auth.authId, async (tx) => {
      const result = await tx
        .select({ role: memberships.role })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(and(eq(memberships.orgId, orgId), eq(users.authId, req.auth!.authId)))
        .limit(1);
      return result[0];
    });

    if (!row) {
      res.status(403).json({ error: "Not a member of the requested org" });
      return;
    }

    req.org = { id: orgId, role: row.role };
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    res.status(500).json({ error: `Failed to resolve org membership: ${message}` });
  }
}
