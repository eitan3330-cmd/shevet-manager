import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tribeScheduleTable = pgTable("tribe_schedule", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  date: timestamp("date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  type: text("type").notNull().default("event"),
  responsiblePerson: text("responsible_person"),
  location: text("location"),
  gradeLevel: text("grade_level"),
  color: text("color").default("blue"),
  notes: text("notes"),
  isAllDay: boolean("is_all_day").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTribeScheduleSchema = createInsertSchema(tribeScheduleTable).omit({ id: true, createdAt: true });
export type InsertTribeSchedule = z.infer<typeof insertTribeScheduleSchema>;
export type TribeSchedule = typeof tribeScheduleTable.$inferSelect;
