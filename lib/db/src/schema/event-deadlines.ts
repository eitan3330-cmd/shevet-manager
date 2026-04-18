import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventsTable } from "./events";

export const eventDeadlinesTable = pgTable("event_deadlines", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  date: timestamp("date", { withTimezone: true }).notNull(),
  responsiblePerson: text("responsible_person"),
  completed: boolean("completed").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventDeadlineSchema = createInsertSchema(eventDeadlinesTable).omit({ id: true, createdAt: true });
export type InsertEventDeadline = z.infer<typeof insertEventDeadlineSchema>;
export type EventDeadline = typeof eventDeadlinesTable.$inferSelect;
