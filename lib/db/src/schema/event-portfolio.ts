import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventPortfolioTable = pgTable("event_portfolio", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  title: text("title").notNull(),
  type: text("type").notNull().default("note"),
  content: text("content"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventPortfolioSchema = createInsertSchema(eventPortfolioTable).omit({ id: true, createdAt: true });
export type InsertEventPortfolio = z.infer<typeof insertEventPortfolioSchema>;
export type EventPortfolio = typeof eventPortfolioTable.$inferSelect;
