import type { AuthUser, OrgMembership } from "../store/useAuthStore";

/**
 * Temporary login bypass for development.
 *
 * When `VITE_AUTH_DISABLED=true`, AuthGuard renders straight through (no
 * redirect to /login, no /api/me fetch) and main.tsx seeds the auth store with
 * the dev identity below. The Supabase auth code path stays intact and
 * re-activates the moment the flag is removed.
 *
 * The IDs must match the backend dev seed (`pnpm seed:dev`) so API calls
 * resolve against the same seeded org.
 */
export const AUTH_DISABLED = import.meta.env["VITE_AUTH_DISABLED"] === "true";

export const DEV_ORG_ID = import.meta.env["VITE_DEV_ORG_ID"] ?? "00000000-0000-0000-0000-000000000010";

export const DEV_USER: AuthUser = {
  id: "00000000-0000-0000-0000-000000000002",
  authId: "00000000-0000-0000-0000-000000000001",
  email: "dev@realaize.local",
  displayName: "Dev User",
};

export const DEV_MEMBERSHIP: OrgMembership = {
  id: DEV_ORG_ID,
  name: "Dev Workspace",
  slug: "dev-workspace",
  role: "admin",
};
