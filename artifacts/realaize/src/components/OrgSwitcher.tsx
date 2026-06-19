import { useAuthStore } from "../store/useAuthStore";

/**
 * Minimal dropdown that shows the user's orgs and lets them switch the
 * acting org. Styled inline so it can drop into any header without depending
 * on the project's design system. Will be redesigned during Phase 2 polish.
 */
export default function OrgSwitcher() {
  const memberships = useAuthStore((s) => s.memberships);
  const selectedOrgId = useAuthStore((s) => s.selectedOrgId);
  const setSelectedOrgId = useAuthStore((s) => s.setSelectedOrgId);

  if (memberships.length === 0) return null;
  if (memberships.length === 1) {
    return (
      <span style={{ fontSize: 12, color: "rgba(245,240,235,0.6)" }}>
        {memberships[0]!.name}
      </span>
    );
  }

  return (
    <select
      value={selectedOrgId ?? ""}
      onChange={(e) => setSelectedOrgId(e.target.value || null)}
      style={{
        background: "rgba(245,240,235,0.05)",
        color: "#f5f0eb",
        border: "1px solid rgba(245,240,235,0.15)",
        borderRadius: 8,
        padding: "4px 8px",
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      {memberships.map((m) => (
        <option key={m.id} value={m.id} style={{ background: "#1a1a1d", color: "#f5f0eb" }}>
          {m.name} ({m.role})
        </option>
      ))}
    </select>
  );
}
