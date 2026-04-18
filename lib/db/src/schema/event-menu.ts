import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventMenuTable = pgTable("event_menu", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  dayNumber: integer("day_number").notNull().default(1),
  mealType: text("meal_type").notNull(),
  description: text("description").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventMenuSchema = createInsertSchema(eventMenuTable).omit({ id: true, createdAt: true });
export type InsertEventMenu = z.infer<typeof insertEventMenuSchema>;
export type EventMenu = typeof eventMenuTable.$inferSelect;
