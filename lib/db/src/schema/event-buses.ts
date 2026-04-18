import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventBusesTable = pgTable("event_buses", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  name: text("name").notNull(),
  capacity: integer("capacity"),
  driverName: text("driver_name"),
  departureTime: text("departure_time"),
  meetingPoint: text("meeting_point"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventBusSchema = createInsertSchema(eventBusesTable).omit({ id: true, createdAt: true });
export type InsertEventBus = z.infer<typeof insertEventBusSchema>;
export type EventBus = typeof eventBusesTable.$inferSelect;
