import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AUTH_DISABLED } from "./devAuth";

const url = import.meta.env["VITE_SUPABASE_URL"];
const anonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"];

// In the login-bypass dev mode Supabase config is optional; we still construct
// a client (with harmless placeholders) so the auth code path keeps compiling
// and re-activates the moment the flag is removed.
if ((!url || !anonKey) && !AUTH_DISABLED) {
  throw new Error(
    "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set. Copy .env.example to .env.local.",
  );
}

export const supabase: SupabaseClient = createClient(
  url ?? "http://localhost:54321",
  anonKey ?? "dev-anon-key-placeholder",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
