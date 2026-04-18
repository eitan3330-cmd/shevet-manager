import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const attendanceSessionsTable = pgTable("attendance_sessions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  date: timestamp("date", { withTimezone: true }).notNull(),
  type: text("type").notNull().default("regular"),
  battalion: text("battalion"),
  gradeLevel: text("grade_level"),
  notes: text("notes"),
  createdBy: text("created_by"),
  isLocked: boolean("is_locked").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAttendanceSessionSchema = createInsertSchema(attendanceSessionsTable).omit({ id: true, createdAt: true });
export type InsertAttendanceSession = z.infer<typeof insertAttendanceSessionSchema>;
export type AttendanceSession = typeof attendanceSessionsTable.$inferSelect;
