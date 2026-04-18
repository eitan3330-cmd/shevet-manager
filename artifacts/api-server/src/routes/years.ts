import { Router } from "express";
import { db } from "@workspace/db";
import { yearArchivesTable, scoutsTable, eventsTable, attendanceTable, budgetTable, procurementTable, tribeUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/years", async (_req, res) => {
  try {
    const archives = await db.select({
      id: yearArchivesTable.id,
      yearLabel: yearArchivesTable.yearLabel,
      closedAt: yearArchivesTable.closedAt,
      closedBy: yearArchivesTable.closedBy,
      notes: yearArchivesTable.notes,
    }).from(yearArchivesTable).orderBy(yearArchivesTable.closedAt);
    res.json(archives);
  } catch {
    res.status(500).json({ error: "שגיאה בטעינת ארכיון השנים" });
  }
});

router.get("/years/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [archive] = await db.select().from(yearArchivesTable).where(eq(yearArchivesTable.id, id));
    if (!archive) return res.status(404).json({ error: "ארכיון לא נמצא" });
    res.json(archive);
  } catch {
    res.status(500).json({ error: "שגיאה בטעינת הארכיון" });
  }
});

router.post("/years/close", async (req, res) => {
  try {
    const { yearLabel, closedBy, notes, highlights } = req.body;

    if (!yearLabel) {
      return res.status(400).json({ error: "חובה לציין שם השנה" });
    }

    const [scouts, events, attendance, budget, procurement, users] = await Promise.all([
      db.select().from(scoutsTable),
      db.select().from(eventsTable),
      db.select().from(attendanceTable),
      db.select().from(budgetTable),
      db.select().from(procurementTable),
      db.select().from(tribeUsersTable).where(eq(tribeUsersTable.active, true)),
    ]);

    const archiveNotes = [
      notes || "",
      highlights ? `\n\n✨ נקודות בולטות:\n${highlights}` : "",
    ].filter(Boolean).join("");

    const [archive] = await db.insert(yearArchivesTable).values({
      yearLabel,
      closedBy: closedBy || null,
      notes: archiveNotes || null,
      scoutsData: scouts,
      eventsData: events,
      attendanceData: attendance,
      budgetData: budget,
      procurementData: procurement,
      staffData: users,
    }).returning();

    // Reset users (deactivate all) so new ones can be added for next year
    await db.update(tribeUsersTable).set({ active: false });

    res.status(201).json({
      success: true,
      archive,
      usersReset: users.length,
      summary: {
        scouts: scouts.length,
        events: events.length,
        attendance: attendance.length,
        budget: budget.length,
        procurement: procurement.length,
        staff: users.length,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "שגיאה בסגירת השנה" });
  }
});

export default router;
