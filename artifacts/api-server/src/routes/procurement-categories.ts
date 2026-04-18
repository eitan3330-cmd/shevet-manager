import { Router } from "express";
import { db } from "@workspace/db";
import { procurementCategoriesTable, procurementTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/procurement-categories", async (req, res) => {
  const categories = await db.select().from(procurementCategoriesTable).orderBy(desc(procurementCategoriesTable.createdAt));
  const allOrders = await db.select().from(procurementTable);

  const result = categories.map(cat => {
    const orders = allOrders.filter(o => o.categoryId === cat.id);
    const totalSpent = orders.reduce((s, o) => s + parseFloat(o.amount || "0"), 0);
    return {
      ...cat,
      totalBudget: cat.totalBudget ? parseFloat(cat.totalBudget) : null,
      orderCount: orders.length,
      totalSpent,
      orders,
    };
  });
  res.json(result);
});

router.post("/procurement-categories", async (req, res) => {
  const { name, description, budgetLineId, budgetLineCategory, totalBudget, status } = req.body;
  if (!name) return res.status(400).json({ error: "שם חובה" });
  const [cat] = await db.insert(procurementCategoriesTable).values({
    name, description, budgetLineId, budgetLineCategory,
    totalBudget: totalBudget ? String(totalBudget) : null,
    status: status || "open",
  }).returning();
  res.status(201).json({ ...cat, totalBudget: cat.totalBudget ? parseFloat(cat.totalBudget) : null });
});

router.put("/procurement-categories/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description, budgetLineId, budgetLineCategory, totalBudget, status } = req.body;
  const [cat] = await db.update(procurementCategoriesTable).set({
    name, description, budgetLineId, budgetLineCategory,
    totalBudget: totalBudget ? String(totalBudget) : null,
    status,
  }).where(eq(procurementCategoriesTable.id, id)).returning();
  res.json({ ...cat, totalBudget: cat.totalBudget ? parseFloat(cat.totalBudget) : null });
});

router.delete("/procurement-categories/:id", async (req, res) => {
  await db.update(procurementTable).set({ categoryId: null }).where(eq(procurementTable.categoryId, parseInt(req.params.id)));
  await db.delete(procurementCategoriesTable).where(eq(procurementCategoriesTable.id, parseInt(req.params.id)));
  res.sendStatus(204);
});

export default router;
