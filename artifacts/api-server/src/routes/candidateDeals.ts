import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { withUserScope, candidateDeals, profileMatches } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { requireRole } from "../middlewares/requireRole";

const router: IRouter = Router();

router.use("/candidate-deals", requireAuth, requireOrg);

// List candidates with their profile matches attached.
router.get("/candidate-deals", async (req, res) => {
  try {
    const result = await withUserScope(req.auth!.authId, async (tx) => {
      const cands = await tx.select().from(candidateDeals).where(eq(candidateDeals.orgId, req.org!.id));
      if (cands.length === 0) return [];
      const ids = cands.map((c) => c.id);
      const matches = await tx.select().from(profileMatches)
        .where(and(eq(profileMatches.orgId, req.org!.id), inArray(profileMatches.candidateId, ids)));
      const byCand = new Map<string, typeof matches>();
      for (const m of matches) {
        const arr = byCand.get(m.candidateId) ?? [];
        arr.push(m);
        byCand.set(m.candidateId, arr);
      }
      return cands.map((c) => ({ ...c, matches: byCand.get(c.id) ?? [] }));
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

router.get("/candidate-deals/:id", async (req, res) => {
  try {
    const result = await withUserScope(req.auth!.authId, async (tx) => {
      const rows = await tx.select().from(candidateDeals)
        .where(and(eq(candidateDeals.id, req.params.id), eq(candidateDeals.orgId, req.org!.id))).limit(1);
      if (!rows[0]) return null;
      const matches = await tx.select().from(profileMatches)
        .where(and(eq(profileMatches.orgId, req.org!.id), eq(profileMatches.candidateId, rows[0].id)));
      return { ...rows[0], matches };
    });
    if (!result) { res.status(404).json({ error: "Not found" }); return; }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

// User actions on the Radar: shortlist / reject / promote / set listing_active.
router.patch("/candidate-deals/:id", requireRole("admin", "editor"), async (req, res) => {
  try {
    const b = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if ("status" in b) patch.status = String(b.status);
    if ("rejectReason" in b) patch.rejectReason = b.rejectReason != null ? String(b.rejectReason) : null;
    if ("reviewNote" in b) patch.reviewNote = b.reviewNote != null ? String(b.reviewNote) : null;
    if ("listingActive" in b) patch.listingActive = Boolean(b.listingActive);

    const rows = await withUserScope(req.auth!.authId, (tx) =>
      tx.update(candidateDeals).set(patch)
        .where(and(eq(candidateDeals.id, String(req.params.id)), eq(candidateDeals.orgId, req.org!.id)))
        .returning(),
    );
    if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

export default router;
