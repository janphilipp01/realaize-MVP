import { withUserScope, users, organizations, memberships } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  DEV_AUTH_ID,
  DEV_ORG_ID,
  DEV_EMAIL,
  DEV_ORG_NAME,
  DEV_ORG_SLUG,
  DEV_DISPLAY_NAME,
  DEV_ROLE,
} from "../lib/devAuth";

/**
 * Provisions the fixed dev user + org + membership used by the AUTH_DISABLED
 * login bypass. Idempotent — safe to run repeatedly. Runs unscoped so it can
 * bypass RLS to create the bootstrap rows (same elevated-privilege path the
 * comment in withUserScope describes for seeds).
 */
async function seedDev(): Promise<void> {
  await withUserScope(null, async (tx) => {
    await tx
      .insert(users)
      .values({ authId: DEV_AUTH_ID, email: DEV_EMAIL, displayName: DEV_DISPLAY_NAME })
      .onConflictDoNothing({ target: users.authId });

    const userRow = (
      await tx.select().from(users).where(eq(users.authId, DEV_AUTH_ID)).limit(1)
    )[0];
    if (!userRow) throw new Error("Dev user insert failed");

    await tx
      .insert(organizations)
      .values({ id: DEV_ORG_ID, name: DEV_ORG_NAME, slug: DEV_ORG_SLUG, createdBy: userRow.id })
      .onConflictDoNothing({ target: organizations.id });

    await tx
      .insert(memberships)
      .values({ orgId: DEV_ORG_ID, userId: userRow.id, role: DEV_ROLE })
      .onConflictDoNothing({ target: [memberships.orgId, memberships.userId] });
  });

  logger.info(
    { authId: DEV_AUTH_ID, orgId: DEV_ORG_ID },
    "dev seed completed — login bypass identity is ready",
  );
}

seedDev()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err: err instanceof Error ? err.message : err }, "dev seed failed");
    process.exit(1);
  });
