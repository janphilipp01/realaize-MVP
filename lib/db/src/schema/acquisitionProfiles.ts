import { pgTable, pgEnum, text, uuid, timestamp, boolean, doublePrecision, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizations } from "./tenancy";

// Deal Sourcing & Screening · Module 07
// See concept: realaize · Deal Sourcing & Screening Pipeline.

export const screeningModeEnum = pgEnum("screening_mode", [
  "discount_to_market",
  "absolute_yield_threshold",
]);

// Active mandate definitions · editable in the Deal Radar UI.
export const acquisitionProfiles = pgTable(
  "acquisition_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    screeningMode: screeningModeEnum("screening_mode").notNull(),
    cities: text("cities").array().notNull().default([]),
    submarkets: text("submarkets").array().notNull().default([]),
    assetClasses: text("asset_classes").array().notNull().default([]),
    priceMin: doublePrecision("price_min").notNull(),
    priceMax: doublePrecision("price_max").notNull(),
    areaMin: doublePrecision("area_min").notNull(),
    areaMax: doublePrecision("area_max").notNull(),
    // Used in both modes (as a floor / sanity check in core+).
    minDiscountPricePct: doublePrecision("min_discount_price_pct").notNull().default(0),
    // value-add mode only.
    minDiscountFactorPct: doublePrecision("min_discount_factor_pct"),
    // core+ mode only.
    minGrossYieldPct: doublePrecision("min_gross_yield_pct"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("acquisition_profiles_org_idx").on(t.orgId),
    index("acquisition_profiles_active_idx").on(t.orgId, t.active),
  ],
);

export const insertAcquisitionProfileSchema = createInsertSchema(acquisitionProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export const selectAcquisitionProfileSchema = createSelectSchema(acquisitionProfiles);
export type InsertAcquisitionProfile = z.infer<typeof insertAcquisitionProfileSchema>;
export type AcquisitionProfile = typeof acquisitionProfiles.$inferSelect;
