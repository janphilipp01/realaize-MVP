import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/useAuthStore";
import { fetchMe, bootstrap } from "../lib/api";
import { AUTH_DISABLED } from "../lib/devAuth";

interface Props {
  children: ReactNode;
}

/**
 * Wraps protected routes. While a Supabase session is being checked we render
 * a thin loading state. If unauthenticated, redirect to /login. If
 * authenticated but no profile/membership has been loaded yet, fetch /api/me
 * and (if needed) call /api/bootstrap to provision the user's first org.
 */
export default function AuthGuard({ children }: Props) {
  const location = useLocation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const memberships = useAuthStore((s) => s.memberships);
  const setProfile = useAuthStore((s) => s.setProfile);

  const [status, setStatus] = useState<"checking" | "ready" | "anonymous" | "error">(
    AUTH_DISABLED ? "ready" : accessToken ? "checking" : "anonymous",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (AUTH_DISABLED) return;
    let cancelled = false;

    async function load() {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? null;
      if (!token) {
        if (!cancelled) setStatus("anonymous");
        return;
      }
      try {
        let profile = await fetchMe(token).catch(() => null);
        if (!profile || profile.memberships.length === 0) {
          // First login: provision a default org.
          const bootstrapped = await bootstrap(token);
          profile = {
            user: bootstrapped.user,
            memberships: bootstrapped.memberships,
          };
        }
        if (cancelled) return;
        setProfile(profile.user, profile.memberships);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load profile");
        setStatus("error");
      }
    }

    if (accessToken && (!user || memberships.length === 0)) {
      load();
    } else if (!accessToken) {
      setStatus("anonymous");
    } else {
      setStatus("ready");
    }

    return () => {
      cancelled = true;
    };
  }, [accessToken, user, memberships.length, setProfile]);

  if (AUTH_DISABLED) {
    return <>{children}</>;
  }
  if (status === "anonymous") {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (status === "checking") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "#0d0d0f",
          color: "rgba(245,240,235,0.6)",
          fontFamily: "system-ui",
          fontSize: 14,
        }}
      >
        Loading…
      </div>
    );
  }
  if (status === "error") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          gap: 12,
          background: "#0d0d0f",
          color: "#f5f0eb",
          fontFamily: "system-ui",
          padding: 24,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600 }}>Could not load your profile</div>
        <div style={{ fontSize: 13, color: "rgba(245,240,235,0.6)", maxWidth: 480, textAlign: "center" }}>
          {error}
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{
            marginTop: 8,
            padding: "8px 18px",
            borderRadius: 10,
            border: "1px solid rgba(245,240,235,0.2)",
            background: "transparent",
            color: "#f5f0eb",
            cursor: "pointer",
          }}
        >
          Sign out
        </button>
      </div>
    );
  }
  return <>{children}</>;
}
