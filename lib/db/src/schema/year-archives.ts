import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const yearArchivesTable = pgTable("year_archives", {
  id: serial("id").primaryKey(),
  yearLabel: text("year_label").notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }).notNull().defaultNow(),
  closedBy: text("closed_by"),
  scoutsData: jsonb("scouts_data"),
  eventsData: jsonb("events_data"),
  attendanceData: jsonb("attendance_data"),
  budgetData: jsonb("budget_data"),
  procurementData: jsonb("procurement_data"),
  staffData: jsonb("staff_data"),
  notes: text("notes"),
});

export const insertYearArchiveSchema = createInsertSchema(yearArchivesTable).omit({ id: true, closedAt: true });
export type InsertYearArchive = z.infer<typeof insertYearArchiveSchema>;
export type YearArchive = typeof yearArchivesTable.$inferSelect;
