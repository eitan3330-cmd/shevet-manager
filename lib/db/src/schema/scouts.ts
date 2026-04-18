import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const scoutsTable = pgTable("scouts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  lastName: text("last_name"),
  phone: text("phone"),
  parentPhone: text("parent_phone"),
  gizra: text("gizra").notNull(),
  battalion: text("battalion"),
  instructorName: text("instructor_name"),
  grade: text("grade"),
  gradeLevel: text("grade_level"),
  school: text("school"),
  tribeRole: text("tribe_role"),
  role: text("role").notNull().default("chanich"),
  birthDate: text("birth_date"),
  foodPreferences: text("food_preferences"),
  medicalIssues: text("medical_issues"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertScoutSchema = createInsertSchema(scoutsTable).omit({ id: true, createdAt: true });
export type InsertScout = z.infer<typeof insertScoutSchema>;
export type Scout = typeof scoutsTable.$inferSelect;
