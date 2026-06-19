import { pgTable, text, uuid, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizations } from "./tenancy";

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    subcategory: text("subcategory"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    company: text("company"),
    position: text("position"),
    email: text("email"),
    phone: text("phone"),
    mobile: text("mobile"),
    address: text("address"),
    city: text("city"),
    website: text("website"),
    notes: text("notes"),
    // JSON arrays stored as text — simple, no need for jsonb here
    linkedObjectIds: text("linked_object_ids"), // JSON: string[]
    tags: text("tags"),                         // JSON: string[]
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("contacts_org_idx").on(t.orgId),
    index("contacts_category_idx").on(t.category),
  ],
);

export const insertContactSchema = createInsertSchema(contacts).omit({ id: true, createdAt: true, updatedAt: true });
export const selectContactSchema = createSelectSchema(contacts);
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;
