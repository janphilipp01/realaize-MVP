import React from 'react';
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  setBaseUrl,
  setAuthTokenGetter,
  setOrgIdGetter,
} from "@workspace/api-client-react";
import App from "@/App";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/useAuthStore";
import { AUTH_DISABLED, DEV_ORG_ID, DEV_USER, DEV_MEMBERSHIP } from "@/lib/devAuth";
import "./index.css";

const apiBaseUrl = import.meta.env["VITE_API_BASE_URL"] ?? "";
if (apiBaseUrl) setBaseUrl(apiBaseUrl);

setAuthTokenGetter(() => useAuthStore.getState().accessToken);
setOrgIdGetter(() => useAuthStore.getState().selectedOrgId);

if (AUTH_DISABLED) {
  // Login bypass: seed the store with the fixed dev identity so components that
  // read user/org keep working. The backend ignores the org header in this mode
  // (requireOrg injects the same dev org), so this only drives the UI.
  const store = useAuthStore.getState();
  store.setProfile(DEV_USER, [DEV_MEMBERSHIP]);
  store.setSelectedOrgId(DEV_ORG_ID);
} else {
  // Bridge supabase auth state into the Zustand auth store. Calls are idempotent
  // and run before React renders, so AuthGuard reads a populated token from the
  // initial render where possible.
  supabase.auth.getSession().then(({ data }) => {
    useAuthStore.getState().setAccessToken(data.session?.access_token ?? null);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    const store = useAuthStore.getState();
    store.setAccessToken(session?.access_token ?? null);
    if (!session) {
      store.clear();
    }
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5_000,
    },
  },
});

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh', padding: 32,
          background: '#0d0d0f', color: '#f5f0eb', fontFamily: 'system-ui',
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠</div>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ fontSize: 14, color: 'rgba(245,240,235,0.5)', marginBottom: 24 }}>
            {this.state.error.message}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              padding: '10px 24px', borderRadius: 12, border: 'none',
              background: '#007aff', color: '#fff', fontSize: 14,
              cursor: 'pointer', fontWeight: 600,
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
