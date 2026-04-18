import { Router } from "express";
import { db } from "@workspace/db";
import { eventDeadlinesTable, eventsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router = Router();

const EDITOR_ROLES = ["marcaz_boger", "marcaz_tzair", "roshatz", "roshgad"];

function getRole(req: any): string | null {
  return (req.headers["x-user-role"] as string) || null;
}

function canEdit(req: any): boolean {
  const role = getRole(req);
  return !!role && EDITOR_ROLES.includes(role);
}

router.get("/event-deadlines", async (_req, res) => {
  const deadlines = await db
    .select({
      id: eventDeadlinesTable.id,
      eventId: eventDeadlinesTable.eventId,
      title: eventDeadlinesTable.title,
      date: eventDeadlinesTable.date,
      responsiblePerson: eventDeadlinesTable.responsiblePerson,
      completed: eventDeadlinesTable.completed,
      notes: eventDeadlinesTable.notes,
      createdAt: eventDeadlinesTable.createdAt,
      eventName: eventsTable.name,
    })
    .from(eventDeadlinesTable)
    .leftJoin(eventsTable, eq(eventDeadlinesTable.eventId, eventsTable.id))
    .orderBy(asc(eventDeadlinesTable.date));
  res.json(deadlines);
});

router.get("/events/:eventId/deadlines", async (req, res) => {
  const eventId = parseInt(req.params.eventId);
  if (isNaN(eventId)) return res.status(400).json({ error: "מזהה אירוע לא תקין" });
  const deadlines = await db
    .select()
    .from(eventDeadlinesTable)
    .where(eq(eventDeadlinesTable.eventId, eventId))
    .orderBy(asc(eventDeadlinesTable.date));
  res.json(deadlines);
});

router.post("/events/:eventId/deadlines", async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ error: "אין הרשאה" });
  const eventId = parseInt(req.params.eventId);
  if (isNaN(eventId)) return res.status(400).json({ error: "מזהה אירוע לא תקין" });
  const { title, date, responsiblePerson, notes } = req.body;
  if (!title || !date) return res.status(400).json({ error: "כותרת ותאריך חובה" });
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) return res.status(400).json({ error: "תאריך לא תקין" });
  const [deadline] = await db.insert(eventDeadlinesTable).values({
    eventId,
    title,
    date: parsedDate,
    responsiblePerson: responsiblePerson || null,
    notes: notes || null,
  }).returning();
  res.status(201).json(deadline);
});

router.put("/event-deadlines/:id", async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ error: "אין הרשאה" });
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "מזהה לא תקין" });
  const { title, date, responsiblePerson, completed, notes } = req.body;
  const updates: any = {};
  if (title !== undefined) updates.title = title;
  if (date !== undefined) {
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) return res.status(400).json({ error: "תאריך לא תקין" });
    updates.date = parsedDate;
  }
  if (responsiblePerson !== undefined) updates.responsiblePerson = responsiblePerson;
  if (completed !== undefined) updates.completed = completed;
  if (notes !== undefined) updates.notes = notes;
  const [deadline] = await db.update(eventDeadlinesTable).set(updates).where(eq(eventDeadlinesTable.id, id)).returning();
  if (!deadline) return res.status(404).json({ error: "לא נמצא" });
  res.json(deadline);
});

router.delete("/event-deadlines/:id", async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ error: "אין הרשאה" });
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "מזהה לא תקין" });
  await db.delete(eventDeadlinesTable).where(eq(eventDeadlinesTable.id, id));
  res.sendStatus(204);
});

export default router;
