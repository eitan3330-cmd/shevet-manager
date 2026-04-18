import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const procurementCategoriesTable = pgTable("procurement_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  budgetLineId: integer("budget_line_id"),
  budgetLineCategory: text("budget_line_category"),
  totalBudget: numeric("total_budget", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProcurementCategorySchema = createInsertSchema(procurementCategoriesTable).omit({ id: true, createdAt: true });
export type InsertProcurementCategory = z.infer<typeof insertProcurementCategorySchema>;
export type ProcurementCategory = typeof procurementCategoriesTable.$inferSelect;
