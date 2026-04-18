import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventScheduleTable = pgTable("event_schedule", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  dayNumber: integer("day_number").notNull().default(1),
  startTime: text("start_time").notNull(),
  endTime: text("end_time"),
  title: text("title").notNull(),
  location: text("location"),
  responsible: text("responsible"),
  notes: text("notes"),
  category: text("category").notNull().default("activity"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventScheduleSchema = createInsertSchema(eventScheduleTable).omit({ id: true, createdAt: true });
export type InsertEventSchedule = z.infer<typeof insertEventScheduleSchema>;
export type EventSchedule = typeof eventScheduleTable.$inferSelect;
