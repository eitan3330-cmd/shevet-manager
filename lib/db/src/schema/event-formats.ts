import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventFormatsTable = pgTable("event_formats", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull().default("general"),
  description: text("description"),
  duration: text("duration"),
  responsible: text("responsible"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventFormatSchema = createInsertSchema(eventFormatsTable).omit({ id: true, createdAt: true });
export type InsertEventFormat = z.infer<typeof insertEventFormatSchema>;
export type EventFormat = typeof eventFormatsTable.$inferSelect;
