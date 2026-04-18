import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, procurementTable } from "@workspace/db";

const router = Router();

function parseOrder(order: typeof procurementTable.$inferSelect) {
  return { ...order, amount: order.amount ? parseFloat(order.amount) : 0 };
}

router.get("/procurement", async (req, res) => {
  const { status, categoryId } = req.query as { status?: string; categoryId?: string };
  let orders = await db.select().from(procurementTable).orderBy(desc(procurementTable.createdAt));
  if (status) orders = orders.filter(o => o.status === status);
  if (categoryId) orders = orders.filter(o => o.categoryId === parseInt(categoryId));
  res.json(orders.map(parseOrder));
});

router.post("/procurement", async (req, res) => {
  const payload = req.body.data || req.body;
  if (!payload.title) return res.status(400).json({ error: "כותרת חובה" });
  const [order] = await db.insert(procurementTable).values({
    title: payload.title,
    description: payload.description || null,
    amount: String(payload.amount || "0"),
    supplier: payload.supplier || null,
    contactPhone: payload.contactPhone || null,
    status: payload.status || "pending",
    orderType: payload.orderType || "order",
    categoryId: payload.categoryId ? parseInt(String(payload.categoryId)) : null,
    eventId: payload.eventId || null,
    requestedBy: payload.requestedBy || null,
    approvedBy: payload.approvedBy || null,
    itemsDetail: payload.itemsDetail || null,
    quoteNotes: payload.quoteNotes || null,
    fileUrl: payload.fileUrl || null,
    fileName: payload.fileName || null,
    fileData: payload.fileData || null,
    budgetLineId: payload.budgetLineId ? parseInt(String(payload.budgetLineId)) : null,
    quoteFileData: payload.quoteFileData || null,
    quoteFileName: payload.quoteFileName || null,
    orderFileData: payload.orderFileData || null,
    orderFileName: payload.orderFileName || null,
    invoiceFileData: payload.invoiceFileData || null,
    invoiceFileName: payload.invoiceFileName || null,
    expectedDelivery: payload.expectedDelivery ? new Date(payload.expectedDelivery) : null,
  }).returning();
  res.status(201).json(parseOrder(order));
});

router.put("/procurement/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const b = req.body;
  const updates: Partial<typeof procurementTable.$inferInsert> = {};
  if (b.title !== undefined) updates.title = b.title;
  if (b.description !== undefined) updates.description = b.description;
  if (b.amount !== undefined) updates.amount = String(b.amount);
  if (b.supplier !== undefined) updates.supplier = b.supplier;
  if (b.contactPhone !== undefined) updates.contactPhone = b.contactPhone;
  if (b.status !== undefined) updates.status = b.status;
  if (b.orderType !== undefined) updates.orderType = b.orderType;
  if (b.categoryId !== undefined) updates.categoryId = b.categoryId ? parseInt(String(b.categoryId)) : null;
  if (b.requestedBy !== undefined) updates.requestedBy = b.requestedBy;
  if (b.approvedBy !== undefined) updates.approvedBy = b.approvedBy;
  if (b.itemsDetail !== undefined) updates.itemsDetail = b.itemsDetail;
  if (b.quoteNotes !== undefined) updates.quoteNotes = b.quoteNotes;
  if (b.fileUrl !== undefined) updates.fileUrl = b.fileUrl;
  if (b.fileName !== undefined) updates.fileName = b.fileName;
  if (b.fileData !== undefined) updates.fileData = b.fileData;
  if (b.budgetLineId !== undefined) updates.budgetLineId = b.budgetLineId ? parseInt(String(b.budgetLineId)) : null;
  if (b.quoteFileData !== undefined) updates.quoteFileData = b.quoteFileData;
  if (b.quoteFileName !== undefined) updates.quoteFileName = b.quoteFileName;
  if (b.orderFileData !== undefined) updates.orderFileData = b.orderFileData;
  if (b.orderFileName !== undefined) updates.orderFileName = b.orderFileName;
  if (b.invoiceFileData !== undefined) updates.invoiceFileData = b.invoiceFileData;
  if (b.invoiceFileName !== undefined) updates.invoiceFileName = b.invoiceFileName;
  if (b.expectedDelivery !== undefined) updates.expectedDelivery = b.expectedDelivery ? new Date(b.expectedDelivery) : null;
  const [order] = await db.update(procurementTable).set(updates).where(eq(procurementTable.id, id)).returning();
  if (!order) return res.status(404).json({ error: "לא נמצא" });
  res.json(parseOrder(order));
});

router.patch("/procurement/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(req.body)) {
    if (v !== null && v !== undefined) {
      updates[k] = k === "amount" ? String(v) : v;
    }
  }
  const [order] = await db.update(procurementTable).set(updates).where(eq(procurementTable.id, id)).returning();
  if (!order) return res.status(404).json({ error: "לא נמצא" });
  res.json(parseOrder(order));
});

router.delete("/procurement/:id", async (req, res) => {
  await db.delete(procurementTable).where(eq(procurementTable.id, parseInt(req.params.id)));
  res.sendStatus(204);
});

export default router;
