import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { withUserScope, users, memberships, organizations } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

/**
 * GET /api/me — returns the authenticated user's profile + all orgs they
 * belong to (with role). The frontend uses this to populate the OrgSwitcher
 * and decide whether to call /api/bootstrap (when memberships is empty).
 */
router.get("/me", requireAuth, async (req, res) => {
  if (!req.auth) {
    res.status(401).json({ error: "Unauthenticated" });
    return;
  }

  try {
    const data = await withUserScope(req.auth.authId, async (tx) => {
      const userRows = await tx
        .select()
        .from(users)
        .where(eq(users.authId, req.auth!.authId))
        .limit(1);

      const user = userRows[0];
      if (!user) return null;

      const orgRows = await tx
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          role: memberships.role,
        })
        .from(memberships)
        .innerJoin(organizations, eq(organizations.id, memberships.orgId))
        .where(eq(memberships.userId, user.id));

      return {
        user: {
          id: user.id,
          authId: user.authId,
          email: user.email,
          displayName: user.displayName,
        },
        memberships: orgRows,
      };
    });

    if (!data) {
      // The trigger should have created a public.users row on signup. If it
      // hasn't, the auth user exists in supabase but not yet locally.
      res.status(404).json({ error: "User profile not yet provisioned" });
      return;
    }

    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    res.status(500).json({ error: `Failed to load profile: ${message}` });
  }
});

export default router;
