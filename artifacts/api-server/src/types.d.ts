import type { Role } from "@workspace/db";

declare global {
  namespace Express {
    interface Request {
      // Set by requireAuth — the verified Supabase JWT subject.
      auth?: {
        authId: string;
        email: string | undefined;
      };
      // Set by requireOrg — the org the request is acting against.
      org?: {
        id: string;
        role: Role;
      };
    }
  }
}

export {};
