import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Admin client — bypasses RLS via service-role key. Used only for token
// verification; all user-scoped DB queries go through withUserScope instead.
let _admin: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.",
    );
  }
  _admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}

export interface SupabaseJwtClaims {
  sub: string;
  email?: string;
}

/**
 * Verify a Supabase access token via auth.getUser().
 * Works regardless of signing algorithm (HS256, RS256, …).
 */
export async function verifySupabaseJwt(token: string): Promise<SupabaseJwtClaims> {
  const { data, error } = await getAdminClient().auth.getUser(token);
  if (error || !data.user) {
    throw new Error(error?.message ?? "Token invalid or expired");
  }
  return {
    sub: data.user.id,
    email: data.user.email,
  };
}
