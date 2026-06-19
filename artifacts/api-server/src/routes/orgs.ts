import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { withUserScope, users, organizations, memberships } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { requireRole } from "../middlewares/requireRole";

const router: IRouter = Router();

const CreateOrgBody = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase alphanumeric with dashes")
    .optional(),
});

const UpdateOrgBody = z.object({
  name: z.string().min(1).max(120).optional(),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "org"
  );
}

/**
 * GET /api/orgs — orgs the caller is a member of (RLS enforces visibility).
 */
router.get("/orgs", requireAuth, async (req, res) => {
  if (!req.auth) {
    res.status(401).json({ error: "Unauthenticated" });
    return;
  }
  try {
    const rows = await withUserScope(req.auth.authId, async (tx) => {
      return await tx
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          role: memberships.role,
          createdAt: organizations.createdAt,
        })
        .from(memberships)
        .innerJoin(organizations, eq(organizations.id, memberships.orgId))
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(eq(users.authId, req.auth!.authId));
    });
    res.json({ orgs: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    res.status(500).json({ error: `Failed to list orgs: ${message}` });
  }
});

/**
 * POST /api/orgs — create a new org. The creator becomes its admin.
 */
router.post("/orgs", requireAuth, async (req, res) => {
  if (!req.auth) {
    res.status(401).json({ error: "Unauthenticated" });
    return;
  }
  const parsed = CreateOrgBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: `Invalid body: ${parsed.error.message}` });
    return;
  }

  try {
    const result = await withUserScope(req.auth.authId, async (tx) => {
      const userRows = await tx
        .select()
        .from(users)
        .where(eq(users.authId, req.auth!.authId))
        .limit(1);
      const user = userRows[0];
      if (!user) throw new Error("User profile missing");

      const baseSlug = parsed.data.slug ?? slugify(parsed.data.name);
      const slug = `${baseSlug}-${user.id.slice(0, 8)}`;

      const orgRows = await tx
        .insert(organizations)
        .values({ name: parsed.data.name, slug, createdBy: user.id })
        .returning();
      const org = orgRows[0]!;

      await tx.insert(memberships).values({
        orgId: org.id,
        userId: user.id,
        role: "admin",
      });

      return org;
    });

    res.status(201).json({ org: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    res.status(500).json({ error: `Failed to create org: ${message}` });
  }
});

/**
 * PATCH /api/orgs/:id — admin only.
 */
router.patch("/orgs/:id", requireAuth, requireOrg, requireRole("admin"), async (req, res) => {
  const parsed = UpdateOrgBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: `Invalid body: ${parsed.error.message}` });
    return;
  }
  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }

  try {
    const result = await withUserScope(req.auth!.authId, async (tx) => {
      const rows = await tx
        .update(organizations)
        .set(parsed.data)
        .where(eq(organizations.id, req.org!.id))
        .returning();
      return rows[0];
    });
    if (!result) {
      res.status(404).json({ error: "Org not found" });
      return;
    }
    res.json({ org: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    res.status(500).json({ error: `Failed to update org: ${message}` });
  }
});

export default router;
