import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/useAuthStore";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const location = useLocation();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (accessToken) {
    const from = (location.state as { from?: { pathname?: string } })?.from?.pathname ?? "/";
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setInfo("Account created. Check your inbox for the confirmation link.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#0d0d0f",
        color: "#f5f0eb",
        fontFamily: "system-ui",
        padding: 24,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 360,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          background: "rgba(245,240,235,0.04)",
          border: "1px solid rgba(245,240,235,0.1)",
          borderRadius: 16,
          padding: 28,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
          {mode === "signin" ? "Sign in to Realaize" : "Create your account"}
        </div>
        <div style={{ fontSize: 13, color: "rgba(245,240,235,0.55)", marginBottom: 8 }}>
          {mode === "signin"
            ? "Use your email and password."
            : "We'll provision a workspace for you on first login."}
        </div>

        {mode === "signup" && (
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "rgba(245,240,235,0.6)" }}>Display name</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Sophie"
              style={inputStyle}
              autoComplete="name"
            />
          </label>
        )}

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, color: "rgba(245,240,235,0.6)" }}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
            autoComplete="email"
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, color: "rgba(245,240,235,0.6)" }}>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={inputStyle}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
        </label>

        {error && (
          <div style={{ fontSize: 12, color: "#ff8585", lineHeight: 1.4 }}>{error}</div>
        )}
        {info && (
          <div style={{ fontSize: 12, color: "#7be1a3", lineHeight: 1.4 }}>{info}</div>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{
            marginTop: 4,
            padding: "10px 16px",
            borderRadius: 10,
            border: "none",
            background: busy ? "rgba(0,122,255,0.5)" : "#007aff",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? "Working…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "signin" ? "signup" : "signin"));
            setError(null);
            setInfo(null);
          }}
          style={{
            background: "transparent",
            border: "none",
            color: "rgba(245,240,235,0.55)",
            fontSize: 12,
            cursor: "pointer",
            marginTop: -4,
          }}
        >
          {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "rgba(245,240,235,0.06)",
  border: "1px solid rgba(245,240,235,0.15)",
  color: "#f5f0eb",
  borderRadius: 10,
  padding: "9px 12px",
  fontSize: 14,
  outline: "none",
  fontFamily: "inherit",
};
