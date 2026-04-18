import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventsTable } from "./events";
import { tribeUsersTable } from "./tribe-users";

export const eventStaffTable = pgTable("event_staff", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => tribeUsersTable.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("שכבגיסט"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventStaffSchema = createInsertSchema(eventStaffTable).omit({ id: true, createdAt: true });
export type InsertEventStaff = z.infer<typeof insertEventStaffSchema>;
export type EventStaff = typeof eventStaffTable.$inferSelect;
