import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventBudgetItemsTable = pgTable("event_budget_items", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  type: text("type").notNull().default("expense"),
  category: text("category").notNull().default("general"),
  description: text("description").notNull(),
  plannedAmount: numeric("planned_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  actualAmount: numeric("actual_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventBudgetItemSchema = createInsertSchema(eventBudgetItemsTable).omit({ id: true, createdAt: true });
export type InsertEventBudgetItem = z.infer<typeof insertEventBudgetItemSchema>;
export type EventBudgetItem = typeof eventBudgetItemsTable.$inferSelect;
