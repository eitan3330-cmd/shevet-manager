import { Router } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db, attendanceTable, scoutsTable } from "@workspace/db";

const router = Router();

router.get("/attendance", async (req, res) => {
  const { date, scoutId, eventId } = req.query as Record<string, string>;

  let records = await db
    .select({
      id: attendanceTable.id,
      scoutId: attendanceTable.scoutId,
      eventId: attendanceTable.eventId,
      status: attendanceTable.status,
      notes: attendanceTable.notes,
      date: attendanceTable.date,
      createdAt: attendanceTable.createdAt,
      scoutName: scoutsTable.name,
    })
    .from(attendanceTable)
    .leftJoin(scoutsTable, eq(attendanceTable.scoutId, scoutsTable.id));

  if (date) {
    const d = new Date(date);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    records = records.filter(r => r.date && new Date(r.date) >= start && new Date(r.date) < end);
  }
  if (scoutId) records = records.filter(r => r.scoutId === parseInt(scoutId));
  if (eventId) records = records.filter(r => r.eventId === parseInt(eventId));

  res.json(records);
});

router.post("/attendance", async (req, res) => {
  const { scoutId, date, status, eventId, notes } = req.body;
  if (!scoutId || !status) return res.status(400).json({ error: "scoutId ו-status חובה" });

  if (status === "clear") {
    if (date) {
      const d = new Date(date);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      const existing = await db.select().from(attendanceTable).where(eq(attendanceTable.scoutId, parseInt(scoutId)));
      const toDelete = existing.filter(r => r.date && new Date(r.date) >= start && new Date(r.date) < end);
      for (const r of toDelete) await db.delete(attendanceTable).where(eq(attendanceTable.id, r.id));
    }
    return res.json({ cleared: true });
  }

  const d = date ? new Date(date) : new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

  const existing = await db.select().from(attendanceTable).where(eq(attendanceTable.scoutId, parseInt(scoutId)));
  const dayRecord = existing.find(r => r.date && new Date(r.date) >= start && new Date(r.date) < end);

  let record;
  if (dayRecord) {
    [record] = await db.update(attendanceTable).set({ status, notes: notes || null }).where(eq(attendanceTable.id, dayRecord.id)).returning();
  } else {
    [record] = await db.insert(attendanceTable).values({
      scoutId: parseInt(scoutId),
      eventId: eventId ? parseInt(eventId) : null,
      date: d,
      status,
      notes: notes || null,
    }).returning();
  }
  res.status(201).json(record);
});

router.delete("/attendance/:id", async (req, res) => {
  await db.delete(attendanceTable).where(eq(attendanceTable.id, parseInt(req.params.id)));
  res.sendStatus(204);
});

export default router;
