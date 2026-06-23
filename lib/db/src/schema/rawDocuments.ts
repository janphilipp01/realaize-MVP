import { pgTable, pgEnum, text, uuid, timestamp, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizations } from "./tenancy";

// Original payloads · audit trail · re-extractable.

export const rawDocumentKindEnum = pgEnum("raw_document_kind", [
  "email_html",
  "email_attachment",
  "crawl_html",
  "manual_pdf",
]);

export const rawDocumentStatusEnum = pgEnum("raw_document_status", [
  "pending_extraction",
  "extracted",
  "review_queue",
]);

export const rawDocuments = pgTable(
  "raw_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    kind: rawDocumentKindEnum("kind").notNull(),
    contentHash: text("content_hash").notNull(),       // idempotent ingest
    storagePath: text("storage_path"),                 // Supabase Storage URL
    sourceRef: text("source_ref"),                     // listing URL or message-id
    rawPayload: text("raw_payload"),                   // inline body / html when not stored
    extractionStatus: rawDocumentStatusEnum("extraction_status").notNull().default("pending_extraction"),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("raw_documents_org_idx").on(t.orgId),
    index("raw_documents_status_idx").on(t.orgId, t.extractionStatus),
    // Content hash unique per org → re-played input does not create a new row.
    unique("raw_documents_hash_uq").on(t.orgId, t.contentHash),
  ],
);

export const insertRawDocumentSchema = createInsertSchema(rawDocuments).omit({ id: true, createdAt: true });
export const selectRawDocumentSchema = createSelectSchema(rawDocuments);
export type InsertRawDocument = z.infer<typeof insertRawDocumentSchema>;
export type RawDocument = typeof rawDocuments.$inferSelect;
