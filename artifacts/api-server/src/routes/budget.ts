import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, budgetTable } from "@workspace/db";
import {
  CreateBudgetItemBody,
  UpdateBudgetItemBody,
  UpdateBudgetItemParams,
  DeleteBudgetItemParams,
  ListBudgetItemsQueryParams,
  ListBudgetItemsResponse,
  UpdateBudgetItemResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function parseBudget(item: { amount: string | null; budgetAllocated?: string | null; [key: string]: unknown }) {
  return {
    ...item,
    amount: item.amount ? parseFloat(item.amount) : 0,
  };
}

router.get("/budget", async (req, res): Promise<void> => {
  const query = ListBudgetItemsQueryParams.safeParse(req.query);
  let items = await db.select().from(budgetTable).orderBy(budgetTable.createdAt);

  if (query.success && query.data.category) {
    items = items.filter(i => i.category === query.data.category);
  }

  res.json(ListBudgetItemsResponse.parse(items.map(parseBudget)));
});

router.post("/budget", async (req, res): Promise<void> => {
  const parsed = CreateBudgetItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [item] = await db.insert(budgetTable).values({
    ...parsed.data,
    amount: String(parsed.data.amount),
  }).returning();
  res.status(201).json(parseBudget(item));
});

router.patch("/budget/:id", async (req, res): Promise<void> => {
  const params = UpdateBudgetItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateBudgetItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== null && v !== undefined) {
      updateData[k] = k === "amount" ? String(v) : v;
    }
  }
  const [item] = await db.update(budgetTable).set(updateData).where(eq(budgetTable.id, params.data.id)).returning();
  if (!item) {
    res.status(404).json({ error: "Budget item not found" });
    return;
  }
  res.json(UpdateBudgetItemResponse.parse(parseBudget(item)));
});

router.delete("/budget/:id", async (req, res): Promise<void> => {
  const params = DeleteBudgetItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [item] = await db.delete(budgetTable).where(eq(budgetTable.id, params.data.id)).returning();
  if (!item) {
    res.status(404).json({ error: "Budget item not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
