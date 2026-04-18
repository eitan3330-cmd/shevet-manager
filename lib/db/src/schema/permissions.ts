import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const permissionsTable = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(),
  section: text("section").notNull(),
  feature: text("feature"),
  canAccess: boolean("can_access").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPermissionSchema = createInsertSchema(permissionsTable).omit({ id: true, createdAt: true });
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type Permission = typeof permissionsTable.$inferSelect;
