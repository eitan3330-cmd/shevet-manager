import { pgTable, text, serial, timestamp, integer, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventsTable } from "./events";
import { scoutsTable } from "./scouts";

export const eventParticipantsTable = pgTable("event_participants", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  scoutId: integer("scout_id").references(() => scoutsTable.id, { onDelete: "set null" }),
  rawName: text("raw_name"),
  confirmed: boolean("confirmed").notNull().default(false),
  status: text("status").notNull().default("unconfirmed"),
  busId: integer("bus_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("event_participants_event_scout_unique")
    .on(t.eventId, t.scoutId)
    .where(sql`${t.scoutId} IS NOT NULL`),
]);

export const insertEventParticipantSchema = createInsertSchema(eventParticipantsTable).omit({ id: true, createdAt: true });
export type InsertEventParticipant = z.infer<typeof insertEventParticipantSchema>;
export type EventParticipant = typeof eventParticipantsTable.$inferSelect;
