import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { scoutsTable } from "./scouts";
import { eventsTable } from "./events";
import { attendanceSessionsTable } from "./attendance-sessions";

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  scoutId: integer("scout_id").references(() => scoutsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id"),
  eventId: integer("event_id").references(() => eventsTable.id, { onDelete: "cascade" }),
  sessionId: integer("session_id").references(() => attendanceSessionsTable.id, { onDelete: "cascade" }),
  date: timestamp("date", { withTimezone: true }),
  status: text("status").notNull().default("present"),
  notes: text("notes"),
  isStaff: boolean("is_staff").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true, createdAt: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
