import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Role = "admin" | "editor" | "viewer";

export interface AuthUser {
  id: string;
  authId: string;
  email: string;
  displayName: string | null;
}

export interface OrgMembership {
  id: string;
  name: string;
  slug: string;
  role: Role;
}

export interface AuthState {
  // Set by main.tsx onAuthStateChange — the JWT used for API calls.
  accessToken: string | null;
  // Hydrated from /api/me after sign-in.
  user: AuthUser | null;
  memberships: OrgMembership[];
  // Currently-acting org. Persisted across reloads so the user lands back
  // in the same context.
  selectedOrgId: string | null;
  setAccessToken: (token: string | null) => void;
  setProfile: (user: AuthUser, memberships: OrgMembership[]) => void;
  setSelectedOrgId: (id: string | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      memberships: [],
      selectedOrgId: null,
      setAccessToken: (token) => set({ accessToken: token }),
      setProfile: (user, memberships) => {
        set((state) => {
          // If the persisted org id is no longer valid, fall back to the first.
          const valid = memberships.find((m) => m.id === state.selectedOrgId);
          const next = valid ? state.selectedOrgId : memberships[0]?.id ?? null;
          return { user, memberships, selectedOrgId: next };
        });
      },
      setSelectedOrgId: (id) => set({ selectedOrgId: id }),
      clear: () =>
        set({ accessToken: null, user: null, memberships: [], selectedOrgId: null }),
    }),
    {
      name: "realaize-auth",
      storage: createJSONStorage(() => localStorage),
      // Don't persist the access token — Supabase manages its own session
      // refresh; we re-derive the token on every page load.
      partialize: (state) => ({ selectedOrgId: state.selectedOrgId }),
    },
  ),
);
