import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventEquipmentTable = pgTable("event_equipment", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  category: text("category").notNull().default("general"),
  responsible: text("responsible"),
  checked: boolean("checked").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventEquipmentSchema = createInsertSchema(eventEquipmentTable).omit({ id: true, createdAt: true });
export type InsertEventEquipment = z.infer<typeof insertEventEquipmentSchema>;
export type EventEquipment = typeof eventEquipmentTable.$inferSelect;
