import { pgTable, text, serial, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const annualBudgetTable = pgTable("annual_budget", {
  id: serial("id").primaryKey(),
  yearLabel: text("year_label").notNull(),
  totalBudget: numeric("total_budget", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAnnualBudgetSchema = createInsertSchema(annualBudgetTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAnnualBudget = z.infer<typeof insertAnnualBudgetSchema>;
export type AnnualBudget = typeof annualBudgetTable.$inferSelect;
