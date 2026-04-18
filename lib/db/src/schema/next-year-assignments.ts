import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { scoutsTable } from "./scouts";

export const nextYearAssignmentsTable = pgTable("next_year_assignments", {
  id: serial("id").primaryKey(),
  scoutId: integer("scout_id").notNull().references(() => scoutsTable.id),
  proposedRole: text("proposed_role").notNull().default("lo_meshubach"),
  proposedBattalion: text("proposed_battalion"),
  notes: text("notes"),
  yearLabel: text("year_label").notNull(),
  locked: boolean("locked").default(false),
  approvedBy: text("approved_by"),
  releaseDate: timestamp("release_date", { withTimezone: true }),
  released: boolean("released").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNextYearAssignmentSchema = createInsertSchema(nextYearAssignmentsTable).omit({ id: true, createdAt: true });
export type InsertNextYearAssignment = z.infer<typeof insertNextYearAssignmentSchema>;
export type NextYearAssignment = typeof nextYearAssignmentsTable.$inferSelect;
