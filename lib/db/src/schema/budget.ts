import { pgTable, text, serial, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const budgetTable = pgTable("budget_items", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  type: text("type").notNull().default("expense"),
  category: text("category"),
  eventId: integer("event_id"),
  date: timestamp("date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBudgetSchema = createInsertSchema(budgetTable).omit({ id: true, createdAt: true });
export type InsertBudgetItem = z.infer<typeof insertBudgetSchema>;
export type BudgetItem = typeof budgetTable.$inferSelect;
