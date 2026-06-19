import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { withUserScope, appointments } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { requireRole } from "../middlewares/requireRole";

const router: IRouter = Router();

router.use("/appointments", requireAuth, requireOrg);

const TEXT_FIELDS = [
  "title", "date", "time", "endTime", "location",
  "participants", "assetId", "category", "notes",
] as const;

router.get("/appointments", async (req, res) => {
  try {
    const rows = await withUserScope(req.auth!.authId, (tx) =>
      tx.select().from(appointments).where(eq(appointments.orgId, req.org!.id)),
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

router.get("/appointments/:id", async (req, res) => {
  try {
    const rows = await withUserScope(req.auth!.authId, (tx) =>
      tx
        .select()
        .from(appointments)
        .where(and(eq(appointments.id, req.params.id), eq(appointments.orgId, req.org!.id)))
        .limit(1),
    );
    if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

router.post("/appointments", requireRole("admin", "editor"), async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const rows = await withUserScope(req.auth!.authId, (tx) =>
      tx
        .insert(appointments)
        .values({
          orgId: req.org!.id,
          title: String(body.title ?? ""),
          date: String(body.date ?? ""),
          time: String(body.time ?? ""),
          endTime: body.endTime != null ? String(body.endTime) : null,
          location: body.location != null ? String(body.location) : null,
          participants: body.participants != null ? String(body.participants) : null,
          assetId: body.assetId != null ? String(body.assetId) : null,
          category: String(body.category ?? "Sonstiges"),
          notes: body.notes != null ? String(body.notes) : null,
        })
        .returning(),
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

router.patch("/appointments/:id", requireRole("admin", "editor"), async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const f of TEXT_FIELDS) {
      if (f in body) patch[f] = body[f] != null ? String(body[f]) : null;
    }

    const rows = await withUserScope(req.auth!.authId, (tx) =>
      tx
        .update(appointments)
        .set(patch)
        .where(and(eq(appointments.id, String(req.params.id)), eq(appointments.orgId, req.org!.id)))
        .returning(),
    );
    if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

router.delete("/appointments/:id", requireRole("admin", "editor"), async (req, res) => {
  try {
    const rows = await withUserScope(req.auth!.authId, (tx) =>
      tx
        .delete(appointments)
        .where(and(eq(appointments.id, String(req.params.id)), eq(appointments.orgId, req.org!.id)))
        .returning({ id: appointments.id }),
    );
    if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

export default router;
