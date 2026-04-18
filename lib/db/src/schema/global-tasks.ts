import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const globalTasksTable = pgTable("global_tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  assignedTo: text("assigned_to"),
  assignedRole: text("assigned_role"),
  status: text("status").notNull().default("pending"),
  priority: text("priority").notNull().default("normal"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  createdBy: text("created_by"),
  eventId: integer("event_id"),
  done: boolean("done").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGlobalTaskSchema = createInsertSchema(globalTasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGlobalTask = z.infer<typeof insertGlobalTaskSchema>;
export type GlobalTask = typeof globalTasksTable.$inferSelect;
