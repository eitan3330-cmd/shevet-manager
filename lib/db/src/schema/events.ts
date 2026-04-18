import { pgTable, text, serial, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("hadracha"),
  status: text("status").notNull().default("upcoming"),
  eventType: text("event_type").default("mifaal"),
  date: timestamp("date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  location: text("location"),
  responsiblePerson: text("responsible_person"),
  participantsCount: integer("participants_count"),
  budgetAllocated: numeric("budget_allocated", { precision: 12, scale: 2 }),
  actualCost: numeric("actual_cost", { precision: 12, scale: 2 }),
  transportNeeded: text("transport_needed"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({ id: true, createdAt: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
