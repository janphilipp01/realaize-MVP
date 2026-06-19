import { pgTable, text, uuid, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { organizations } from "./tenancy";

// Hybrid schema: stable id + orgId, everything else lives as a JSONB document.
// This matches the deeply-nested mock data (units, debt, covenants, cashFlows,
// documents, capex, propertyData …) without requiring 8 sub-tables.
export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("assets_org_idx").on(t.orgId)],
);

export const selectAssetSchema = createSelectSchema(assets);
export type AssetRow = typeof assets.$inferSelect;
