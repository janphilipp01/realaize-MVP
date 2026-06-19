import { pgTable, text, uuid, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizations } from "./tenancy";

export const marketLocations = pgTable(
  "market_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    locationKey: text("location_key").notNull(),  // stable client-side id like 'loc-berlin'
    city: text("city").notNull(),
    region: text("region").notNull(),
    submarket: text("submarket").notNull(),
    lastUpdated: text("last_updated").notNull(),  // YYYY-MM-DD
    benchmarks: jsonb("benchmarks").notNull().default([]),
    updateLog: jsonb("update_log").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("market_locations_org_idx").on(t.orgId),
    index("market_locations_key_idx").on(t.orgId, t.locationKey),
  ],
);

export const insertMarketLocationSchema = createInsertSchema(marketLocations).omit({ id: true, createdAt: true, updatedAt: true });
export const selectMarketLocationSchema = createSelectSchema(marketLocations);
export type InsertMarketLocation = z.infer<typeof insertMarketLocationSchema>;
export type MarketLocation = typeof marketLocations.$inferSelect;
