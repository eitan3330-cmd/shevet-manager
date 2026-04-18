import { Router } from "express";
import { db } from "@workspace/db";
import { tribeScheduleTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router = Router();

router.get("/schedule", async (req, res) => {
  const events = await db.select().from(tribeScheduleTable).orderBy(asc(tribeScheduleTable.date));
  res.json(events);
});

router.post("/schedule", async (req, res) => {
  const { title, description, date, endDate, type, responsiblePerson, location, gradeLevel, color, notes, isAllDay } = req.body;
  if (!title || !date) return res.status(400).json({ error: "כותרת ותאריך חובה" });
  const [event] = await db.insert(tribeScheduleTable).values({
    title, description: description || null,
    date: new Date(date),
    endDate: endDate ? new Date(endDate) : null,
    type: type || "event",
    responsiblePerson: responsiblePerson || null,
    location: location || null,
    gradeLevel: gradeLevel || null,
    color: color || "blue",
    notes: notes || null,
    isAllDay: isAllDay !== false,
  }).returning();
  res.status(201).json(event);
});

router.put("/schedule/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { title, description, date, endDate, type, responsiblePerson, location, gradeLevel, color, notes, isAllDay } = req.body;
  const updates: any = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (date !== undefined) updates.date = new Date(date);
  if (endDate !== undefined) updates.endDate = endDate ? new Date(endDate) : null;
  if (type !== undefined) updates.type = type;
  if (responsiblePerson !== undefined) updates.responsiblePerson = responsiblePerson;
  if (location !== undefined) updates.location = location;
  if (gradeLevel !== undefined) updates.gradeLevel = gradeLevel;
  if (color !== undefined) updates.color = color;
  if (notes !== undefined) updates.notes = notes;
  if (isAllDay !== undefined) updates.isAllDay = isAllDay;
  const [event] = await db.update(tribeScheduleTable).set(updates).where(eq(tribeScheduleTable.id, id)).returning();
  if (!event) return res.status(404).json({ error: "לא נמצא" });
  res.json(event);
});

router.delete("/schedule/:id", async (req, res) => {
  await db.delete(tribeScheduleTable).where(eq(tribeScheduleTable.id, parseInt(req.params.id)));
  res.sendStatus(204);
});

router.post("/schedule/import-bulk", async (req, res) => {
  const { rows } = req.body as { rows: any[] };
  if (!Array.isArray(rows)) return res.status(400).json({ error: "rows חסר" });

  const existing = await db.select().from(tribeScheduleTable);
  let added = 0, skipped = 0;
  const seenKeys = new Set<string>();

  for (const row of rows) {
    if (!row.title || !row.date) { skipped++; continue; }

    let parsedDate: Date;
    try {
      if (typeof row.date === "number") {
        parsedDate = new Date(Math.round((row.date - 25569) * 86400 * 1000));
      } else {
        parsedDate = new Date(row.date);
      }
      if (isNaN(parsedDate.getTime())) { skipped++; continue; }
    } catch { skipped++; continue; }

    const dayKey = `${row.title}|${parsedDate.toISOString().split("T")[0]}`;
    if (seenKeys.has(dayKey)) { skipped++; continue; }

    const isDup = existing.some(e =>
      e.title === row.title &&
      e.date && Math.abs(e.date.getTime() - parsedDate.getTime()) < 86400 * 1000
    );
    if (isDup) { skipped++; continue; }

    seenKeys.add(dayKey);

    let parsedEnd: Date | null = null;
    if (row.endDate) {
      try {
        parsedEnd = typeof row.endDate === "number"
          ? new Date(Math.round((row.endDate - 25569) * 86400 * 1000))
          : new Date(row.endDate);
        if (isNaN(parsedEnd.getTime())) parsedEnd = null;
      } catch { parsedEnd = null; }
    }

    await db.insert(tribeScheduleTable).values({
      title: row.title,
      date: parsedDate,
      endDate: parsedEnd,
      type: row.type || "event",
      gradeLevel: row.gradeLevel || null,
      location: row.location || null,
      responsiblePerson: row.responsiblePerson || null,
      description: row.description || null,
      color: row.color || "blue",
      notes: row.notes || null,
      isAllDay: true,
    });
    added++;
  }

  res.json({ added, skipped });
});

export default router;
