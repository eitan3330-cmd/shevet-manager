import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const activityTracksTable = pgTable("activity_tracks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  gradeLevel: text("grade_level"),
  createdBy: text("created_by"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertActivityTrackSchema = createInsertSchema(activityTracksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertActivityTrack = z.infer<typeof insertActivityTrackSchema>;
export type ActivityTrack = typeof activityTracksTable.$inferSelect;
