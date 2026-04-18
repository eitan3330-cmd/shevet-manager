import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tribeUsersTable = pgTable("tribe_users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  battalion: text("battalion"),
  team: text("team"),
  grade: text("grade"),
  pin: text("pin"),
  active: boolean("active").notNull().default(true),
  scoutId: integer("scout_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTribeUserSchema = createInsertSchema(tribeUsersTable).omit({ id: true, createdAt: true });
export type InsertTribeUser = z.infer<typeof insertTribeUserSchema>;
export type TribeUser = typeof tribeUsersTable.$inferSelect;
