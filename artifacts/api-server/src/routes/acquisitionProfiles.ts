import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { withUserScope, acquisitionProfiles } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { requireRole } from "../middlewares/requireRole";

const router: IRouter = Router();

router.use("/acquisition-profiles", requireAuth, requireOrg);

const TEXT_FIELDS = ["name", "screeningMode"] as const;
const ARRAY_FIELDS = ["cities", "submarkets", "assetClasses"] as const;
const NUM_FIELDS = [
  "priceMin", "priceMax", "areaMin", "areaMax",
  "minDiscountPricePct", "minDiscountFactorPct", "minGrossYieldPct",
] as const;

router.get("/acquisition-profiles", async (req, res) => {
  try {
    const rows = await withUserScope(req.auth!.authId, (tx) =>
      tx.select().from(acquisitionProfiles).where(eq(acquisitionProfiles.orgId, req.org!.id)),
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

router.post("/acquisition-profiles", requireRole("admin", "editor"), async (req, res) => {
  try {
    const b = req.body as Record<string, unknown>;
    const rows = await withUserScope(req.auth!.authId, (tx) =>
      tx.insert(acquisitionProfiles).values({
        orgId: req.org!.id,
        name: String(b.name ?? ""),
        screeningMode: String(b.screeningMode ?? "discount_to_market") as never,
        cities: Array.isArray(b.cities) ? (b.cities as string[]) : [],
        submarkets: Array.isArray(b.submarkets) ? (b.submarkets as string[]) : [],
        assetClasses: Array.isArray(b.assetClasses) ? (b.assetClasses as string[]) : [],
        priceMin: Number(b.priceMin ?? 0),
        priceMax: Number(b.priceMax ?? 0),
        areaMin: Number(b.areaMin ?? 0),
        areaMax: Number(b.areaMax ?? 0),
        minDiscountPricePct: Number(b.minDiscountPricePct ?? 0),
        minDiscountFactorPct: b.minDiscountFactorPct != null ? Number(b.minDiscountFactorPct) : null,
        minGrossYieldPct: b.minGrossYieldPct != null ? Number(b.minGrossYieldPct) : null,
        active: b.active != null ? Boolean(b.active) : true,
      }).returning(),
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

router.patch("/acquisition-profiles/:id", requireRole("admin", "editor"), async (req, res) => {
  try {
    const b = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const f of TEXT_FIELDS) if (f in b) patch[f] = String(b[f]);
    for (const f of ARRAY_FIELDS) if (f in b) patch[f] = Array.isArray(b[f]) ? b[f] : [];
    for (const f of NUM_FIELDS) if (f in b) patch[f] = b[f] != null ? Number(b[f]) : null;
    if ("active" in b) patch.active = Boolean(b.active);

    const rows = await withUserScope(req.auth!.authId, (tx) =>
      tx.update(acquisitionProfiles).set(patch)
        .where(and(eq(acquisitionProfiles.id, String(req.params.id)), eq(acquisitionProfiles.orgId, req.org!.id)))
        .returning(),
    );
    if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

router.delete("/acquisition-profiles/:id", requireRole("admin", "editor"), async (req, res) => {
  try {
    const rows = await withUserScope(req.auth!.authId, (tx) =>
      tx.delete(acquisitionProfiles)
        .where(and(eq(acquisitionProfiles.id, String(req.params.id)), eq(acquisitionProfiles.orgId, req.org!.id)))
        .returning({ id: acquisitionProfiles.id }),
    );
    if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

export default router;
