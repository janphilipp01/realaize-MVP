import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { withUserScope, contacts } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { requireRole } from "../middlewares/requireRole";

const router: IRouter = Router();

// All contacts routes require auth + org membership.
router.use("/contacts", requireAuth, requireOrg);

/** Parse JSON-encoded string columns back to arrays. */
function deserialize(row: typeof contacts.$inferSelect) {
  return {
    ...row,
    linkedObjectIds: row.linkedObjectIds ? (JSON.parse(row.linkedObjectIds) as string[]) : null,
    tags: row.tags ? (JSON.parse(row.tags) as string[]) : null,
  };
}

// GET /api/contacts — list all contacts for the org
router.get("/contacts", async (req, res) => {
  try {
    const rows = await withUserScope(req.auth!.authId, (tx) =>
      tx.select().from(contacts).where(eq(contacts.orgId, req.org!.id)),
    );
    res.json(rows.map(deserialize));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

// GET /api/contacts/:id
router.get("/contacts/:id", async (req, res) => {
  try {
    const rows = await withUserScope(req.auth!.authId, (tx) =>
      tx
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, req.params.id), eq(contacts.orgId, req.org!.id)))
        .limit(1),
    );
    if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    res.json(deserialize(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

// POST /api/contacts — admin or editor only
router.post("/contacts", requireRole("admin", "editor"), async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const rows = await withUserScope(req.auth!.authId, (tx) =>
      tx
        .insert(contacts)
        .values({
          orgId: req.org!.id,
          category: String(body.category ?? "Sonstiges"),
          subcategory: body.subcategory != null ? String(body.subcategory) : null,
          firstName: String(body.firstName ?? ""),
          lastName: String(body.lastName ?? ""),
          company: body.company != null ? String(body.company) : null,
          position: body.position != null ? String(body.position) : null,
          email: body.email != null ? String(body.email) : null,
          phone: body.phone != null ? String(body.phone) : null,
          mobile: body.mobile != null ? String(body.mobile) : null,
          address: body.address != null ? String(body.address) : null,
          city: body.city != null ? String(body.city) : null,
          website: body.website != null ? String(body.website) : null,
          notes: body.notes != null ? String(body.notes) : null,
          linkedObjectIds: Array.isArray(body.linkedObjectIds) ? JSON.stringify(body.linkedObjectIds) : null,
          tags: Array.isArray(body.tags) ? JSON.stringify(body.tags) : null,
        })
        .returning(),
    );
    res.status(201).json(deserialize(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

// PATCH /api/contacts/:id — admin or editor only
router.patch("/contacts/:id", requireRole("admin", "editor"), async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    const textFields = [
      "category", "subcategory", "firstName", "lastName", "company",
      "position", "email", "phone", "mobile", "address", "city", "website", "notes",
    ] as const;
    for (const f of textFields) {
      if (f in body) patch[f] = body[f] != null ? String(body[f]) : null;
    }
    if ("linkedObjectIds" in body)
      patch["linkedObjectIds"] = Array.isArray(body.linkedObjectIds) ? JSON.stringify(body.linkedObjectIds) : null;
    if ("tags" in body)
      patch["tags"] = Array.isArray(body.tags) ? JSON.stringify(body.tags) : null;

    const rows = await withUserScope(req.auth!.authId, (tx) =>
      tx
        .update(contacts)
        .set(patch)
        .where(and(eq(contacts.id, req.params.id), eq(contacts.orgId, req.org!.id)))
        .returning(),
    );
    if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    res.json(deserialize(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

// DELETE /api/contacts/:id — admin or editor only
router.delete("/contacts/:id", requireRole("admin", "editor"), async (req, res) => {
  try {
    const rows = await withUserScope(req.auth!.authId, (tx) =>
      tx
        .delete(contacts)
        .where(and(eq(contacts.id, req.params.id), eq(contacts.orgId, req.org!.id)))
        .returning({ id: contacts.id }),
    );
    if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

export default router;
