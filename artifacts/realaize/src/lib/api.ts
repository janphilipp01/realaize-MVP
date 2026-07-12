// Thin wrappers over the api-server endpoints introduced in Phase 1 / Batch 2.
// These will be replaced by Orval-generated hooks in Phase 4 once the OpenAPI
// spec covers them — keeping them hand-written here lets Phase 1 ship without
// regenerating the full client.

import type { AuthUser, OrgMembership } from "@/store/useAuthStore";

const baseUrl: string = import.meta.env["VITE_API_BASE_URL"] ?? "";

interface FetchOpts {
  token: string;
  orgId?: string | null;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
}

async function apiFetch<T>(path: string, opts: FetchOpts): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.token}`,
  };
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (opts.orgId) {
    headers["X-Org-Id"] = opts.orgId;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method: opts.method ?? "GET",
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface MeResponse {
  user: AuthUser;
  memberships: OrgMembership[];
}

export interface BootstrapResponse {
  user: AuthUser;
  memberships: OrgMembership[];
  created: boolean;
}

export function fetchMe(token: string): Promise<MeResponse> {
  return apiFetch<MeResponse>("/api/me", { token });
}

export function bootstrap(token: string, orgName?: string): Promise<BootstrapResponse> {
  return apiFetch<BootstrapResponse>("/api/bootstrap", {
    token,
    method: "POST",
    body: orgName ? { orgName } : {},
  });
}
