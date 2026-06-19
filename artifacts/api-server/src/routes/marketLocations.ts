import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { withUserScope, marketLocations } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { requireRole } from "../middlewares/requireRole";

const router: IRouter = Router();

router.use("/market-locations", requireAuth, requireOrg);

interface Benchmark {
  id: string;
  locationId: string;
  usageType: string;
  rentMin: number; rentMax: number; rentMedian: number;
  purchasePriceMin: number; purchasePriceMax: number; purchasePriceMedian: number;
  multiplierMin: number; multiplierMax: number; multiplierMedian: number;
  vacancyRatePercent: number;
  confidenceScore: number;
  sourceLabel: string;
  lastUpdated: string;
  notes?: string | null;
}

interface UpdateEntry {
  id: string;
  locationId: string;
  timestamp: string;
  updatedBy: string;
  changes: string;
  sourceLabel: string;
}

function toApi(row: typeof marketLocations.$inferSelect) {
  return {
    id: row.locationKey,
    city: row.city,
    region: row.region,
    submarket: row.submarket,
    lastUpdated: row.lastUpdated,
    benchmarks: (row.benchmarks as Benchmark[]) ?? [],
    updateLog: (row.updateLog as UpdateEntry[]) ?? [],
  };
}

router.get("/market-locations", async (req, res) => {
  try {
    const rows = await withUserScope(req.auth!.authId, (tx) =>
      tx.select().from(marketLocations).where(eq(marketLocations.orgId, req.org!.id)),
    );
    res.json(rows.map(toApi));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

router.post("/market-locations", requireRole("admin", "editor"), async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const rows = await withUserScope(req.auth!.authId, (tx) =>
      tx
        .insert(marketLocations)
        .values({
          orgId: req.org!.id,
          locationKey: String(body.id ?? ""),
          city: String(body.city ?? ""),
          region: String(body.region ?? ""),
          submarket: String(body.submarket ?? ""),
          lastUpdated: String(body.lastUpdated ?? new Date().toISOString().split("T")[0]),
          benchmarks: [],
          updateLog: [],
        })
        .returning(),
    );
    res.status(201).json(toApi(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

router.patch("/market-locations/:id", requireRole("admin", "editor"), async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const f of ["city", "region", "submarket", "lastUpdated"] as const) {
      if (f in body) patch[f] = String(body[f] ?? "");
    }

    const rows = await withUserScope(req.auth!.authId, (tx) =>
      tx
        .update(marketLocations)
        .set(patch)
        .where(and(eq(marketLocations.locationKey, req.params.id), eq(marketLocations.orgId, req.org!.id)))
        .returning(),
    );
    if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    res.json(toApi(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

router.delete("/market-locations/:id", requireRole("admin", "editor"), async (req, res) => {
  try {
    const rows = await withUserScope(req.auth!.authId, (tx) =>
      tx
        .delete(marketLocations)
        .where(and(eq(marketLocations.locationKey, req.params.id), eq(marketLocations.orgId, req.org!.id)))
        .returning({ id: marketLocations.id }),
    );
    if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

// Replace benchmarks for the supplied usageTypes; prepend the update entry.
router.post("/market-locations/:id/benchmarks", requireRole("admin", "editor"), async (req, res) => {
  try {
    const body = req.body as { benchmarks?: Benchmark[]; updateEntry?: UpdateEntry };
    const newBms = Array.isArray(body.benchmarks) ? body.benchmarks : [];
    const entry = body.updateEntry;

    const updated = await withUserScope(req.auth!.authId, async (tx) => {
      const existing = await tx
        .select()
        .from(marketLocations)
        .where(and(eq(marketLocations.locationKey, req.params.id), eq(marketLocations.orgId, req.org!.id)))
        .limit(1);
      if (!existing[0]) return null;

      const current = existing[0];
      const oldBms = (current.benchmarks as Benchmark[]) ?? [];
      const newTypes = new Set(newBms.map((b) => b.usageType));
      const merged = [...oldBms.filter((b) => !newTypes.has(b.usageType)), ...newBms];

      const oldLog = (current.updateLog as UpdateEntry[]) ?? [];
      const mergedLog = entry ? [entry, ...oldLog] : oldLog;

      const today = new Date().toISOString().split("T")[0];
      const rows = await tx
        .update(marketLocations)
        .set({ benchmarks: merged, updateLog: mergedLog, lastUpdated: today, updatedAt: new Date() })
        .where(eq(marketLocations.id, current.id))
        .returning();
      return rows[0];
    });

    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(toApi(updated));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

export default router;
