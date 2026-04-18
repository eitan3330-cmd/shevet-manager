import { Router } from "express";
import { db } from "@workspace/db";
import { budgetLinesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function formatLine(l: typeof budgetLinesTable.$inferSelect) {
  return {
    ...l,
    allocatedAmount: parseFloat(l.allocatedAmount),
    updatedBudget: l.updatedBudget ? parseFloat(l.updatedBudget) : null,
    spentAmount: parseFloat(l.spentAmount),
    openOrders: l.openOrders ? parseFloat(l.openOrders) : null,
    totalExecution: l.totalExecution ? parseFloat(l.totalExecution) : null,
    lastYearAmount: l.lastYearAmount ? parseFloat(l.lastYearAmount) : null,
  };
}

router.get("/budget-lines", async (req, res) => {
  const { year } = req.query;
  let lines = await db.select().from(budgetLinesTable).orderBy(budgetLinesTable.category);
  if (year) lines = lines.filter(l => l.yearLabel === year);
  res.json(lines.map(formatLine));
});

router.post("/budget-lines", async (req, res) => {
  const { yearLabel, category, description, accountCode, allocatedAmount, updatedBudget, spentAmount, openOrders, totalExecution, lastYearAmount, notes } = req.body;
  if (!yearLabel || !category) return res.status(400).json({ error: "שנה וקטגוריה חובה" });
  const [line] = await db.insert(budgetLinesTable).values({
    yearLabel, category, description, accountCode: accountCode || null, notes,
    allocatedAmount: String(allocatedAmount || 0),
    updatedBudget: updatedBudget != null ? String(updatedBudget) : null,
    spentAmount: String(spentAmount || 0),
    openOrders: openOrders != null ? String(openOrders) : null,
    totalExecution: totalExecution != null ? String(totalExecution) : null,
    lastYearAmount: lastYearAmount != null ? String(lastYearAmount) : null,
  }).returning();
  res.status(201).json(formatLine(line));
});

router.put("/budget-lines/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { yearLabel, category, description, accountCode, allocatedAmount, updatedBudget, spentAmount, openOrders, totalExecution, lastYearAmount, notes } = req.body;
  const [line] = await db.update(budgetLinesTable).set({
    yearLabel, category, description, accountCode: accountCode || null, notes,
    allocatedAmount: String(allocatedAmount || 0),
    updatedBudget: updatedBudget != null ? String(updatedBudget) : null,
    spentAmount: String(spentAmount || 0),
    openOrders: openOrders != null ? String(openOrders) : null,
    totalExecution: totalExecution != null ? String(totalExecution) : null,
    lastYearAmount: lastYearAmount != null ? String(lastYearAmount) : null,
    updatedAt: new Date(),
  }).where(eq(budgetLinesTable.id, id)).returning();
  res.json(formatLine(line));
});

router.delete("/budget-lines/:id", async (req, res) => {
  await db.delete(budgetLinesTable).where(eq(budgetLinesTable.id, parseInt(req.params.id)));
  res.sendStatus(204);
});

router.post("/budget-lines/import-bulk", async (req, res) => {
  const { rows, yearLabel } = req.body as { rows: any[]; yearLabel: string };
  if (!Array.isArray(rows)) return res.status(400).json({ error: "rows חסר" });

  const year = yearLabel || (new Date().getFullYear() + "-" + (new Date().getFullYear() + 1));
  let added = 0, skipped = 0;

  for (const row of rows) {
    if (!row.category) { skipped++; continue; }

    await db.insert(budgetLinesTable).values({
      yearLabel: year,
      category: row.category,
      description: row.description || null,
      accountCode: row.accountCode || null,
      allocatedAmount: String(parseFloat(row.allocatedAmount) || 0),
      updatedBudget: row.updatedBudget != null ? String(parseFloat(row.updatedBudget)) : null,
      spentAmount: String(parseFloat(row.spentAmount) || 0),
      openOrders: row.openOrders != null ? String(parseFloat(row.openOrders)) : null,
      totalExecution: row.totalExecution != null ? String(parseFloat(row.totalExecution)) : null,
      lastYearAmount: row.lastYearAmount ? String(parseFloat(row.lastYearAmount)) : null,
      notes: row.notes || null,
    });
    added++;
  }

  res.json({ added, skipped });
});

router.delete("/budget-lines/clear-all", async (req, res) => {
  const { yearLabel } = req.body;
  if (yearLabel) {
    await db.delete(budgetLinesTable).where(eq(budgetLinesTable.yearLabel, yearLabel));
  } else {
    await db.delete(budgetLinesTable);
  }
  res.json({ ok: true });
});

export default router;
