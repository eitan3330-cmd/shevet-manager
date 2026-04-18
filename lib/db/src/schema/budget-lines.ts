import { pgTable, text, serial, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const budgetLinesTable = pgTable("budget_lines", {
  id: serial("id").primaryKey(),
  yearLabel: text("year_label").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  accountCode: text("account_code"),
  allocatedAmount: numeric("allocated_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  updatedBudget: numeric("updated_budget", { precision: 12, scale: 2 }),
  spentAmount: numeric("spent_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  openOrders: numeric("open_orders", { precision: 12, scale: 2 }),
  totalExecution: numeric("total_execution", { precision: 12, scale: 2 }),
  lastYearAmount: numeric("last_year_amount", { precision: 12, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBudgetLineSchema = createInsertSchema(budgetLinesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBudgetLine = z.infer<typeof insertBudgetLineSchema>;
export type BudgetLine = typeof budgetLinesTable.$inferSelect;
