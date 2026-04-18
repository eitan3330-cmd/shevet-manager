import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventTasksTable = pgTable("event_tasks", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  title: text("title").notNull(),
  done: boolean("done").notNull().default(false),
  priority: text("priority").notNull().default("normal"),
  assignee: text("assignee"),
  assignedToUserId: integer("assigned_to_user_id"),
  notes: text("notes"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventTaskSchema = createInsertSchema(eventTasksTable).omit({ id: true, createdAt: true });
export type InsertEventTask = z.infer<typeof insertEventTaskSchema>;
export type EventTask = typeof eventTasksTable.$inferSelect;
