import type { Role } from "@workspace/db";

/**
 * Temporary login bypass for development.
 *
 * When `AUTH_DISABLED=true`, requireAuth/requireOrg skip Supabase token
 * verification and membership lookups and instead inject a fixed dev identity
 * and org. The Supabase auth code path stays intact and re-activates the moment
 * the flag is removed.
 *
 * The dev identity must correspond to a real seeded user + org so RLS-scoped
 * queries (`withUserScope`) and foreign keys keep working. Run `pnpm seed:dev`
 * once to provision them. The default IDs below match that seed.
 */
export const AUTH_DISABLED = process.env["AUTH_DISABLED"] === "true";

export const DEV_AUTH_ID = process.env["DEV_AUTH_ID"] ?? "00000000-0000-0000-0000-000000000001";
export const DEV_ORG_ID = process.env["DEV_ORG_ID"] ?? "00000000-0000-0000-0000-000000000010";
export const DEV_EMAIL = process.env["DEV_EMAIL"] ?? "dev@realaize.local";
export const DEV_ORG_NAME = process.env["DEV_ORG_NAME"] ?? "Dev Workspace";
export const DEV_ORG_SLUG = process.env["DEV_ORG_SLUG"] ?? "dev-workspace";
export const DEV_DISPLAY_NAME = "Dev User";
export const DEV_ROLE: Role = "admin";
