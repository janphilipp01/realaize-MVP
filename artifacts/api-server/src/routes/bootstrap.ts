import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { withUserScope, users, organizations, memberships, contacts, appointments, marketLocations } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import { MOCK_CONTACTS } from "../seed/mockContacts";
import { MOCK_APPOINTMENTS } from "../seed/mockAppointments";
import { MOCK_MARKET_LOCATIONS } from "../seed/mockMarketLocations";

const router: IRouter = Router();

const BootstrapBody = z.object({
  orgName: z.string().min(1).max(120).optional(),
});

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base.length > 0 ? base : "org";
}

/**
 * POST /api/bootstrap — idempotent first-login provisioning.
 *
 * If the caller already has any memberships, return them as-is. Otherwise
 * create a default organization, attach the caller as admin, and return.
 *
 * Relies on the RLS bootstrap loophole: memberships INSERT is allowed when
 * the org has no members yet (see 0001_rls.sql).
 */
router.post("/bootstrap", requireAuth, async (req, res) => {
  if (!req.auth) {
    res.status(401).json({ error: "Unauthenticated" });
    return;
  }

  const parsed = BootstrapBody.safeParse(req.body ?? {});
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
      if (!user) {
        throw new Error("User profile missing — auth trigger did not fire");
      }

      const existing = await tx
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          role: memberships.role,
        })
        .from(memberships)
        .innerJoin(organizations, eq(organizations.id, memberships.orgId))
        .where(eq(memberships.userId, user.id));
      if (existing.length > 0) {
        return { user, memberships: existing, created: false };
      }

      const orgName =
        parsed.data.orgName ?? (user.displayName ? `${user.displayName}'s Workspace` : "My Workspace");
      const baseSlug = slugify(orgName);
      const slug = `${baseSlug}-${user.id.slice(0, 8)}`;

      const orgRows = await tx
        .insert(organizations)
        .values({ name: orgName, slug, createdBy: user.id })
        .returning();
      const org = orgRows[0]!;

      await tx.insert(memberships).values({
        orgId: org.id,
        userId: user.id,
        role: "admin",
      });

      // Seed mock contacts for the new org so the app starts with sample data.
      if (MOCK_CONTACTS.length > 0) {
        await tx.insert(contacts).values(
          MOCK_CONTACTS.map((c) => ({
            orgId: org.id,
            category: c.category,
            subcategory: c.subcategory ?? null,
            firstName: c.firstName,
            lastName: c.lastName,
            company: c.company ?? null,
            position: c.position ?? null,
            email: c.email ?? null,
            phone: c.phone ?? null,
            mobile: c.mobile ?? null,
            city: c.city ?? null,
            website: c.website ?? null,
            tags: c.tags ? JSON.stringify(c.tags) : null,
          })),
        );
      }

      if (MOCK_APPOINTMENTS.length > 0) {
        await tx.insert(appointments).values(
          MOCK_APPOINTMENTS.map((a) => ({
            orgId: org.id,
            title: a.title,
            date: a.date,
            time: a.time,
            endTime: a.endTime ?? null,
            location: a.location ?? null,
            participants: a.participants ?? null,
            assetId: a.assetId ?? null,
            category: a.category,
            notes: a.notes ?? null,
          })),
        );
      }

      if (MOCK_MARKET_LOCATIONS.length > 0) {
        await tx.insert(marketLocations).values(
          MOCK_MARKET_LOCATIONS.map((m) => ({
            orgId: org.id,
            locationKey: m.locationKey,
            city: m.city,
            region: m.region,
            submarket: m.submarket,
            lastUpdated: m.lastUpdated,
            benchmarks: m.benchmarks,
            updateLog: m.updateLog,
          })),
        );
      }

      return {
        user,
        memberships: [{ id: org.id, name: org.name, slug: org.slug, role: "admin" as const }],
        created: true,
      };
    });

    logger.info(
      { authId: req.auth.authId, created: result.created },
      "bootstrap completed",
    );

    res.json({
      user: {
        id: result.user.id,
        authId: result.user.authId,
        email: result.user.email,
        displayName: result.user.displayName,
      },
      memberships: result.memberships,
      created: result.created,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    logger.error({ err: message }, "bootstrap failed");
    res.status(500).json({ error: `Bootstrap failed: ${message}` });
  }
});

export default router;
