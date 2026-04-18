import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const activitiesTable = pgTable("activities", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  date: timestamp("date", { withTimezone: true }),
  gradeLevel: text("grade_level"),
  activityType: text("activity_type").notNull().default("peula"),
  description: text("description"),
  goals: text("goals"),
  materials: text("materials"),
  duration: text("duration"),
  status: text("status").notNull().default("draft"),
  submittedBy: text("submitted_by"),
  assignedTo: text("assigned_to"),
  assignedBy: text("assigned_by"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewNotes: text("review_notes"),
  feedback: text("feedback"),
  feedbackBy: text("feedback_by"),
  feedbackAt: timestamp("feedback_at", { withTimezone: true }),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileData: text("file_data"),
  trackId: integer("track_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertActivitySchema = createInsertSchema(activitiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activitiesTable.$inferSelect;
