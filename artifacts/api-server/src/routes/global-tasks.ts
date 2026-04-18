import { Router } from "express";
import { db } from "@workspace/db";
import { globalTasksTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/global-tasks", async (req, res) => {
  const { assignedTo, role } = req.query as { assignedTo?: string; role?: string };
  let tasks = await db.select().from(globalTasksTable).orderBy(desc(globalTasksTable.createdAt));
  if (assignedTo) tasks = tasks.filter(t => t.assignedTo === assignedTo);
  if (role) tasks = tasks.filter(t => t.assignedRole === role);
  res.json(tasks);
});

router.post("/global-tasks", async (req, res) => {
  const { title, description, assignedTo, assignedRole, priority, dueDate, createdBy, eventId, notes } = req.body;
  if (!title) return res.status(400).json({ error: "כותרת חובה" });
  const [task] = await db.insert(globalTasksTable).values({
    title, description, assignedTo, assignedRole,
    priority: priority || "normal",
    dueDate: dueDate ? new Date(dueDate) : null,
    createdBy, eventId, notes, status: "pending",
  }).returning();
  res.status(201).json(task);
});

router.patch("/global-tasks/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { done, status, title, description, assignedTo, assignedRole, priority, dueDate, notes } = req.body;
  const updates: any = { updatedAt: new Date() };
  if (done !== undefined) updates.done = done;
  if (status !== undefined) updates.status = status;
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (assignedTo !== undefined) updates.assignedTo = assignedTo;
  if (assignedRole !== undefined) updates.assignedRole = assignedRole;
  if (priority !== undefined) updates.priority = priority;
  if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;
  if (notes !== undefined) updates.notes = notes;
  const [task] = await db.update(globalTasksTable).set(updates).where(eq(globalTasksTable.id, id)).returning();
  res.json(task);
});

router.delete("/global-tasks/:id", async (req, res) => {
  await db.delete(globalTasksTable).where(eq(globalTasksTable.id, parseInt(req.params.id)));
  res.sendStatus(204);
});

export default router;
