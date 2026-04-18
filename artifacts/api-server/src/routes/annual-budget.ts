import { Router } from "express";
import { db } from "@workspace/db";
import { annualBudgetTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/annual-budget", async (_req, res) => {
  try {
    const [budget] = await db.select().from(annualBudgetTable).orderBy(desc(annualBudgetTable.createdAt)).limit(1);
    res.json(budget || null);
  } catch {
    res.status(500).json({ error: "שגיאה בטעינת תקציב שנתי" });
  }
});

router.post("/annual-budget", async (req, res) => {
  try {
    const { yearLabel, totalBudget, notes } = req.body;
    if (!yearLabel || totalBudget === undefined) return res.status(400).json({ error: "שנה ותקציב חובה" });
    const [budget] = await db.insert(annualBudgetTable).values({
      yearLabel,
      totalBudget: String(totalBudget),
      notes: notes || null,
    }).returning();
    res.status(201).json(budget);
  } catch {
    res.status(500).json({ error: "שגיאה ביצירת תקציב שנתי" });
  }
});

router.put("/annual-budget/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { yearLabel, totalBudget, notes } = req.body;
    const [budget] = await db.update(annualBudgetTable)
      .set({
        yearLabel,
        totalBudget: String(totalBudget),
        notes: notes || null,
        updatedAt: new Date(),
      })
      .where(eq(annualBudgetTable.id, id))
      .returning();
    res.json(budget);
  } catch {
    res.status(500).json({ error: "שגיאה בעדכון תקציב שנתי" });
  }
});

export default router;
