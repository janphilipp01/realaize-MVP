import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { and, eq } from "drizzle-orm";
import { withUserScope, users, memberships, type Role } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { requireRole } from "../middlewares/requireRole";

const router: IRouter = Router();

const ROLES = ["admin", "editor", "viewer"] as const;

const InviteBody = z.object({
  email: z.string().email(),
  role: z.enum(ROLES).default("viewer"),
});

const UpdateRoleBody = z.object({
  role: z.enum(ROLES),
});

/**
 * GET /api/orgs/:id/members — anyone in the org may list members (RLS allows).
 */
router.get("/orgs/:id/members", requireAuth, requireOrg, async (req, res) => {
  try {
    const rows = await withUserScope(req.auth!.authId, async (tx) => {
      return await tx
        .select({
          membershipId: memberships.id,
          userId: users.id,
          email: users.email,
          displayName: users.displayName,
          role: memberships.role,
          joinedAt: memberships.createdAt,
        })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(eq(memberships.orgId, req.org!.id));
    });
    res.json({ members: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    res.status(500).json({ error: `Failed to list members: ${message}` });
  }
});

/**
 * POST /api/orgs/:id/members — admin invites an existing user (by email)
 * into the org. For Phase 1 we require the invitee to already have signed up
 * (so a public.users row exists). Email-invite flow is a later phase.
 */
router.post(
  "/orgs/:id/members",
  requireAuth,
  requireOrg,
  requireRole("admin"),
  async (req, res) => {
    const parsed = InviteBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: `Invalid body: ${parsed.error.message}` });
      return;
    }

    try {
      const result = await withUserScope(req.auth!.authId, async (tx) => {
        const target = await tx
          .select()
          .from(users)
          .where(eq(users.email, parsed.data.email))
          .limit(1);
        if (target.length === 0) {
          return { kind: "no_user" as const };
        }
        const targetUser = target[0]!;

        const existing = await tx
          .select()
          .from(memberships)
          .where(
            and(
              eq(memberships.orgId, req.org!.id),
              eq(memberships.userId, targetUser.id),
            ),
          )
          .limit(1);
        if (existing.length > 0) {
          return { kind: "exists" as const };
        }

        const inserted = await tx
          .insert(memberships)
          .values({
            orgId: req.org!.id,
            userId: targetUser.id,
            role: parsed.data.role as Role,
          })
          .returning();
        return { kind: "ok" as const, membership: inserted[0]! };
      });

      if (result.kind === "no_user") {
        res
          .status(404)
          .json({ error: "No user with that email — invitee must sign up first" });
        return;
      }
      if (result.kind === "exists") {
        res.status(409).json({ error: "User is already a member of this org" });
        return;
      }
      res.status(201).json({ membership: result.membership });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown";
      res.status(500).json({ error: `Failed to add member: ${message}` });
    }
  },
);

/**
 * PATCH /api/orgs/:id/members/:membershipId — change role.
 */
router.patch(
  "/orgs/:id/members/:membershipId",
  requireAuth,
  requireOrg,
  requireRole("admin"),
  async (req, res) => {
    const parsed = UpdateRoleBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: `Invalid body: ${parsed.error.message}` });
      return;
    }
    const rawMembershipId = req.params["membershipId"];
    if (!rawMembershipId || typeof rawMembershipId !== "string") {
      res.status(400).json({ error: "Missing membershipId" });
      return;
    }
    const membershipId: string = rawMembershipId;

    try {
      const result = await withUserScope(req.auth!.authId, async (tx) => {
        const rows = await tx
          .update(memberships)
          .set({ role: parsed.data.role as Role })
          .where(
            and(eq(memberships.id, membershipId), eq(memberships.orgId, req.org!.id)),
          )
          .returning();
        return rows[0];
      });
      if (!result) {
        res.status(404).json({ error: "Membership not found in this org" });
        return;
      }
      res.json({ membership: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown";
      res.status(500).json({ error: `Failed to update member: ${message}` });
    }
  },
);

/**
 * DELETE /api/orgs/:id/members/:membershipId — remove a member.
 * Refuses to remove the last admin so an org always has at least one.
 */
router.delete(
  "/orgs/:id/members/:membershipId",
  requireAuth,
  requireOrg,
  requireRole("admin"),
  async (req, res) => {
    const rawMembershipId = req.params["membershipId"];
    if (!rawMembershipId || typeof rawMembershipId !== "string") {
      res.status(400).json({ error: "Missing membershipId" });
      return;
    }
    const membershipId: string = rawMembershipId;
    try {
      const result = await withUserScope(req.auth!.authId, async (tx) => {
        const target = await tx
          .select()
          .from(memberships)
          .where(
            and(eq(memberships.id, membershipId), eq(memberships.orgId, req.org!.id)),
          )
          .limit(1);
        if (target.length === 0) return { kind: "not_found" as const };

        if (target[0]!.role === "admin") {
          const admins = await tx
            .select()
            .from(memberships)
            .where(and(eq(memberships.orgId, req.org!.id), eq(memberships.role, "admin")));
          if (admins.length <= 1) return { kind: "last_admin" as const };
        }

        await tx
          .delete(memberships)
          .where(
            and(eq(memberships.id, membershipId), eq(memberships.orgId, req.org!.id)),
          );
        return { kind: "ok" as const };
      });
      if (result.kind === "not_found") {
        res.status(404).json({ error: "Membership not found in this org" });
        return;
      }
      if (result.kind === "last_admin") {
        res
          .status(409)
          .json({ error: "Cannot remove the last admin — promote someone first" });
        return;
      }
      res.status(204).end();
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown";
      res.status(500).json({ error: `Failed to remove member: ${message}` });
    }
  },
);

export default router;
