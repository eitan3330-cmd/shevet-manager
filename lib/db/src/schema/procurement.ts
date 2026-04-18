import { pgTable, text, serial, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const procurementTable = pgTable("procurement_orders", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  supplier: text("supplier"),
  contactPhone: text("contact_phone"),
  status: text("status").notNull().default("pending"),
  orderType: text("order_type").notNull().default("order"),
  categoryId: integer("category_id"),
  eventId: integer("event_id"),
  requestedBy: text("requested_by"),
  approvedBy: text("approved_by"),
  itemsDetail: text("items_detail"),
  quoteNotes: text("quote_notes"),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileData: text("file_data"),
  budgetLineId: integer("budget_line_id"),
  quoteFileData: text("quote_file_data"),
  quoteFileName: text("quote_file_name"),
  orderFileData: text("order_file_data"),
  orderFileName: text("order_file_name"),
  invoiceFileData: text("invoice_file_data"),
  invoiceFileName: text("invoice_file_name"),
  expectedDelivery: timestamp("expected_delivery", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProcurementSchema = createInsertSchema(procurementTable).omit({ id: true, createdAt: true });
export type InsertProcurementOrder = z.infer<typeof insertProcurementSchema>;
export type ProcurementOrder = typeof procurementTable.$inferSelect;
