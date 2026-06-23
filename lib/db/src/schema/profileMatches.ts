import { pgTable, pgEnum, text, uuid, timestamp, boolean, doublePrecision, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizations } from "./tenancy";
import { candidateDeals } from "./candidateDeals";
import { acquisitionProfiles } from "./acquisitionProfiles";

// n:m candidate × profile · the matcher is the sole writer · UI reads only.

export const benchmarkConfidenceEnum = pgEnum("benchmark_confidence", [
  "submarket",
  "city_fallback",
]);

export const matchSignalEnum = pgEnum("match_signal", [
  "green",
  "amber",
  "none",
]);

export const profileMatches = pgTable(
  "profile_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id").notNull().references(() => candidateDeals.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id").notNull().references(() => acquisitionProfiles.id, { onDelete: "cascade" }),
    benchmarkAsOf: text("benchmark_as_of").notNull(),       // quarter label, e.g. 2026-Q2
    benchmarkConfidence: benchmarkConfidenceEnum("benchmark_confidence").notNull(),
    // Test A · €/m²
    askingPricePerSqm: doublePrecision("asking_price_per_sqm").notNull(),
    benchmarkPricePerSqm: doublePrecision("benchmark_price_per_sqm"),
    discountPricePct: doublePrecision("discount_price_pct").notNull(),
    // Test B · Faktor / yield
    annualErv: doublePrecision("annual_erv"),
    impliedFactor: doublePrecision("implied_factor").notNull(),
    impliedGrossYield: doublePrecision("implied_gross_yield").notNull(),
    benchmarkFactor: doublePrecision("benchmark_factor"),
    discountFactorPct: doublePrecision("discount_factor_pct"),
    passA: boolean("pass_a").notNull(),
    passB: boolean("pass_b").notNull(),
    signal: matchSignalEnum("signal").notNull(),
    matchedAt: timestamp("matched_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("profile_matches_org_idx").on(t.orgId),
    index("profile_matches_candidate_idx").on(t.candidateId),
    index("profile_matches_profile_idx").on(t.profileId),
    index("profile_matches_signal_idx").on(t.orgId, t.signal),
    // One match row per candidate × profile — re-running the matcher upserts.
    unique("profile_matches_pair_uq").on(t.candidateId, t.profileId),
  ],
);

export const insertProfileMatchSchema = createInsertSchema(profileMatches).omit({ id: true, matchedAt: true });
export const selectProfileMatchSchema = createSelectSchema(profileMatches);
export type InsertProfileMatch = z.infer<typeof insertProfileMatchSchema>;
export type ProfileMatch = typeof profileMatches.$inferSelect;
