import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventFlyerTable = pgTable("event_flyer", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().unique(),
  headline: text("headline"),
  subtitle: text("subtitle"),
  dateText: text("date_text"),
  locationText: text("location_text"),
  targetAudience: text("target_audience"),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  additionalInfo: text("additional_info"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventFlyerSchema = createInsertSchema(eventFlyerTable).omit({ id: true, updatedAt: true });
export type InsertEventFlyer = z.infer<typeof insertEventFlyerSchema>;
export type EventFlyer = typeof eventFlyerTable.$inferSelect;
