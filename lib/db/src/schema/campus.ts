import { pgTable, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const applicationsTable = pgTable("campus_applications", {
  id: text("id").primaryKey(),
  university: text("university").notNull(),
  institutionType: text("institution_type"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  location: text("location").notNull().default(""),
  status: text("status").notNull().default("Pending"),
  isReference: boolean("is_reference").notNull().default(false),
  isDemo: boolean("is_demo").notNull().default(false),
  screeningData: text("screening_data"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertApplicationSchema = createInsertSchema(applicationsTable).omit({ createdAt: true });
export type ApplicationRow = typeof applicationsTable.$inferSelect;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;

export const applicationFilesTable = pgTable("campus_application_files", {
  id: text("id").primaryKey(),
  applicationId: text("application_id").notNull().references(() => applicationsTable.id),
  name: text("name").notNull(),
  size: integer("size").notNull(),
  objectPath: text("object_path").notNull(),
  category: text("category").notNull().default("received"),
  pages: integer("pages").notNull().default(1),
  quality: text("quality").notNull().default("Received · awaiting screening"),
  extractedText: text("extracted_text").notNull().default(""),
});
export const insertApplicationFileSchema = createInsertSchema(applicationFilesTable);
export type ApplicationFileRow = typeof applicationFilesTable.$inferSelect;

export const evidenceRequestsTable = pgTable("campus_evidence_requests", {
  id: text("id").primaryKey(),
  applicationId: text("application_id").notNull().references(() => applicationsTable.id),
  reviewer: text("reviewer").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertEvidenceRequestSchema = createInsertSchema(evidenceRequestsTable).omit({ createdAt: true });