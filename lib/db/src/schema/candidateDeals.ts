import { pgTable, pgEnum, text, uuid, timestamp, boolean, doublePrecision, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizations } from "./tenancy";
import { rawDocuments } from "./rawDocuments";

// One row per extracted opportunity · full provenance · status lifecycle.

export const sourceChannelEnum = pgEnum("source_channel", [
  "platform_immoscout",
  "platform_immowelt",
  "broker_crawl",
  "inbox",
  "manual_upload",
]);

// Screening asset classes — extends the Market Intelligence set with mixed_use.
export const candidateAssetClassEnum = pgEnum("candidate_asset_class", [
  "residential",
  "mixed_use",
  "office",
  "retail",
  "logistics",
]);

export const candidateStatusEnum = pgEnum("candidate_status", [
  "pending_extraction",
  "new",
  "matched",
  "unmatched",
  "shortlisted",
  "rejected",
  "promoted",
  "inactive",
]);

export const candidateDeals = pgTable(
  "candidate_deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    sourceChannel: sourceChannelEnum("source_channel").notNull(),
    sourceRef: text("source_ref").notNull(),               // listing URL or message-id
    sourceLabel: text("source_label"),                     // human label, e.g. "Aengevelt"
    rawDocumentId: uuid("raw_document_id").references(() => rawDocuments.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    address: text("address").notNull(),
    city: text("city").notNull(),
    submarket: text("submarket"),
    lat: doublePrecision("lat"),
    lon: doublePrecision("lon"),
    assetClass: candidateAssetClassEnum("asset_class").notNull(),
    askingPrice: doublePrecision("asking_price").notNull(),
    areaSqm: doublePrecision("area_sqm").notNull(),
    currentRentPa: doublePrecision("current_rent_pa"),     // ERV-delta tag · informational
    yearBuilt: integer("year_built"),
    vacancyState: text("vacancy_state"),
    numUnits: integer("num_units"),
    description: text("description"),
    extractionConfidence: jsonb("extraction_confidence").notNull().default({}), // per-field scores
    dedupHash: text("dedup_hash").notNull(),               // normalised address + price-band
    status: candidateStatusEnum("status").notNull().default("new"),
    listingActive: boolean("listing_active").notNull().default(true),
    rejectReason: text("reject_reason"),
    reviewNote: text("review_note"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("candidate_deals_org_idx").on(t.orgId),
    index("candidate_deals_status_idx").on(t.orgId, t.status),
    index("candidate_deals_dedup_idx").on(t.orgId, t.dedupHash),
  ],
);

export const insertCandidateDealSchema = createInsertSchema(candidateDeals).omit({ id: true, createdAt: true, updatedAt: true });
export const selectCandidateDealSchema = createSelectSchema(candidateDeals);
export type InsertCandidateDeal = z.infer<typeof insertCandidateDealSchema>;
export type CandidateDeal = typeof candidateDeals.$inferSelect;
