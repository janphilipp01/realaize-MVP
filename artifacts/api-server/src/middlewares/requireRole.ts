import type { Request, Response, NextFunction } from "express";
import type { Role } from "@workspace/db";

/**
 * Gates a handler on the caller's role within the org from `req.org`.
 * Must be mounted AFTER requireOrg.
 *
 * Usage:
 *   router.post("/", requireAuth, requireOrg, requireRole("admin", "editor"), handler)
 */
export function requireRole(...allowed: Role[]) {
  return function (req: Request, res: Response, next: NextFunction): void {
    if (!req.org) {
      res.status(403).json({ error: "Org context not resolved" });
      return;
    }
    if (!allowed.includes(req.org.role)) {
      res.status(403).json({
        error: `Role '${req.org.role}' is not permitted. Required: ${allowed.join(", ")}`,
      });
      return;
    }
    next();
  };
}
