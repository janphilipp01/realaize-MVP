import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { withUserScope } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { requireRole } from "../middlewares/requireRole";

// Tables share { id, orgId, data, createdAt, updatedAt }.
type PortfolioTable = PgTable & {
  id: any;
  orgId: any;
  data: any;
  createdAt: any;
  updatedAt: any;
};

function flatten(row: { id: string; orgId: string; data: unknown; createdAt: Date; updatedAt: Date }) {
  const data = (row.data ?? {}) as Record<string, unknown>;
  return {
    ...data,
    id: row.id,
    orgId: row.orgId,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}

function stripMeta(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    if (k === "id" || k === "orgId" || k === "createdAt" || k === "updatedAt") continue;
    out[k] = v;
  }
  return out;
}

/**
 * Mounts standard CRUD routes for a portfolio-style table on the given router.
 * `mountPath` is the URL segment (e.g. "/assets").
 */
export function mountPortfolioRoutes(router: IRouter, mountPath: string, table: PortfolioTable): void {
  router.use(mountPath, requireAuth, requireOrg);

  router.get(mountPath, async (req, res) => {
    try {
      const rows = await withUserScope(req.auth!.authId, (tx) =>
        tx.select().from(table as any).where(eq(table.orgId, req.org!.id)),
      );
      res.json(rows.map(flatten as any));
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
    }
  });

  router.get(`${mountPath}/:id`, async (req, res) => {
    try {
      const rows = await withUserScope(req.auth!.authId, (tx) =>
        tx
          .select()
          .from(table as any)
          .where(and(eq(table.id, req.params.id), eq(table.orgId, req.org!.id)))
          .limit(1),
      );
      if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
      res.json(flatten(rows[0] as any));
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
    }
  });

  router.post(mountPath, requireRole("admin", "editor"), async (req, res) => {
    try {
      const data = stripMeta(req.body);
      const rows = await withUserScope(req.auth!.authId, (tx) =>
        tx
          .insert(table as any)
          .values({ orgId: req.org!.id, data })
          .returning(),
      );
      res.status(201).json(flatten(rows[0] as any));
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
    }
  });

  router.patch(`${mountPath}/:id`, requireRole("admin", "editor"), async (req, res) => {
    try {
      // Fetch current, merge, write back. Body fields are top-level; merged into `data`.
      const current = await withUserScope(req.auth!.authId, (tx) =>
        tx
          .select()
          .from(table as any)
          .where(and(eq(table.id, req.params.id), eq(table.orgId, req.org!.id)))
          .limit(1),
      );
      if (!current[0]) { res.status(404).json({ error: "Not found" }); return; }
      const merged = { ...((current[0] as any).data ?? {}), ...stripMeta(req.body) };
      const rows = await withUserScope(req.auth!.authId, (tx) =>
        tx
          .update(table as any)
          .set({ data: merged, updatedAt: new Date() })
          .where(and(eq(table.id, req.params.id), eq(table.orgId, req.org!.id)))
          .returning(),
      );
      res.json(flatten(rows[0] as any));
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
    }
  });

  router.delete(`${mountPath}/:id`, requireRole("admin", "editor"), async (req, res) => {
    try {
      const rows = await withUserScope(req.auth!.authId, (tx) =>
        tx
          .delete(table as any)
          .where(and(eq(table.id, req.params.id), eq(table.orgId, req.org!.id)))
          .returning({ id: table.id }),
      );
      if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
    }
  });
}

export function makePortfolioRouter(mountPath: string, table: PortfolioTable): IRouter {
  const router: IRouter = Router();
  mountPortfolioRoutes(router, mountPath, table);
  return router;
}
