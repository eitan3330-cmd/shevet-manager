import { Router } from "express";
import { db } from "@workspace/db";
import { nextYearAssignmentsTable, scoutsTable, tribeUsersTable } from "@workspace/db";
import { eq, and, ilike } from "drizzle-orm";

const router = Router();

function requireManagerRole(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  const role = req.headers["x-user-role"];
  if (role !== "marcaz_boger") {
    return res.status(403).json({ error: "רק מרכז בוגר יכול לבצע פעולה זו" });
  }
  next();
}

router.get("/next-year-assignments", async (req, res) => {
  try {
    const { year } = req.query as { year?: string };
    const rows = year
      ? await db.select().from(nextYearAssignmentsTable).where(eq(nextYearAssignmentsTable.yearLabel, year))
      : await db.select().from(nextYearAssignmentsTable);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "שגיאה בטעינת שיבוצים" });
  }
});

async function checkNotLocked(yearLabel: string, res: import("express").Response): Promise<boolean> {
  const [row] = await db.select({ locked: nextYearAssignmentsTable.locked })
    .from(nextYearAssignmentsTable)
    .where(eq(nextYearAssignmentsTable.yearLabel, yearLabel))
    .limit(1);
  if (row?.locked) {
    res.status(403).json({ error: "התכנון נעול — לא ניתן לערוך" });
    return true;
  }
  return false;
}

router.post("/next-year-assignments", requireManagerRole, async (req, res) => {
  try {
    const { scoutId, proposedRole, proposedBattalion, notes, yearLabel } = req.body as {
      scoutId?: number; proposedRole?: string; proposedBattalion?: string; notes?: string; yearLabel?: string;
    };
    if (!scoutId || !yearLabel) return res.status(400).json({ error: "חסרים שדות חובה" });

    if (await checkNotLocked(yearLabel, res)) return;

    const [existing] = await db.select().from(nextYearAssignmentsTable).where(
      and(eq(nextYearAssignmentsTable.scoutId, scoutId), eq(nextYearAssignmentsTable.yearLabel, yearLabel))
    );

    if (existing) {
      const [updated] = await db.update(nextYearAssignmentsTable)
        .set({
          proposedRole: proposedRole || "lo_meshubach",
          proposedBattalion: proposedBattalion || null,
          notes: notes || null,
        })
        .where(eq(nextYearAssignmentsTable.id, existing.id))
        .returning();
      return res.json(updated);
    }

    const [assignment] = await db.insert(nextYearAssignmentsTable)
      .values({
        scoutId,
        proposedRole: proposedRole || "lo_meshubach",
        proposedBattalion: proposedBattalion || null,
        notes: notes || null,
        yearLabel,
      })
      .returning();
    res.status(201).json(assignment);
  } catch {
    res.status(500).json({ error: "שגיאה בשמירת שיבוץ" });
  }
});

router.put("/next-year-assignments/:id", requireManagerRole, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db.select().from(nextYearAssignmentsTable).where(eq(nextYearAssignmentsTable.id, id));
    if (!row) return res.status(404).json({ error: "שיבוץ לא נמצא" });
    if (await checkNotLocked(row.yearLabel, res)) return;

    const { proposedRole, proposedBattalion, notes } = req.body as {
      proposedRole?: string; proposedBattalion?: string; notes?: string;
    };
    const updates: Partial<typeof nextYearAssignmentsTable.$inferInsert> = {};
    if (proposedRole !== undefined) updates.proposedRole = proposedRole;
    if (proposedBattalion !== undefined) updates.proposedBattalion = proposedBattalion || null;
    if (notes !== undefined) updates.notes = notes || null;

    const [updated] = await db.update(nextYearAssignmentsTable)
      .set(updates)
      .where(eq(nextYearAssignmentsTable.id, id))
      .returning();
    res.json(updated);
  } catch {
    res.status(500).json({ error: "שגיאה בעדכון שיבוץ" });
  }
});

router.delete("/next-year-assignments/:id", requireManagerRole, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db.select().from(nextYearAssignmentsTable).where(eq(nextYearAssignmentsTable.id, id));
    if (!row) return res.status(404).json({ error: "שיבוץ לא נמצא" });
    if (await checkNotLocked(row.yearLabel, res)) return;

    await db.delete(nextYearAssignmentsTable).where(eq(nextYearAssignmentsTable.id, id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "שגיאה במחיקת שיבוץ" });
  }
});

router.post("/next-year-assignments/lock", requireManagerRole, async (req, res) => {
  try {
    const { yearLabel, locked } = req.body as { yearLabel?: string; locked?: boolean };
    if (!yearLabel) return res.status(400).json({ error: "חסר תווית שנה" });
    await db.update(nextYearAssignmentsTable)
      .set({ locked: locked !== false })
      .where(eq(nextYearAssignmentsTable.yearLabel, yearLabel));
    res.json({ success: true, locked: locked !== false });
  } catch {
    res.status(500).json({ error: "שגיאה בנעילה" });
  }
});

router.post("/next-year-assignments/approve", requireManagerRole, async (req, res) => {
  try {
    const { yearLabel, approvedBy, releaseDate } = req.body as { yearLabel?: string; approvedBy?: string; releaseDate?: string };
    if (!yearLabel) return res.status(400).json({ error: "חסר תווית שנה" });
    await db.update(nextYearAssignmentsTable)
      .set({
        locked: true,
        approvedBy: approvedBy || null,
        releaseDate: releaseDate ? new Date(releaseDate) : null,
      })
      .where(eq(nextYearAssignmentsTable.yearLabel, yearLabel));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "שגיאה באישור" });
  }
});

router.post("/next-year-assignments/release", requireManagerRole, async (req, res) => {
  try {
    const { yearLabel } = req.body as { yearLabel?: string };
    if (!yearLabel) return res.status(400).json({ error: "חסר תווית שנה" });
    await db.update(nextYearAssignmentsTable)
      .set({ released: true })
      .where(eq(nextYearAssignmentsTable.yearLabel, yearLabel));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "שגיאה בשחרור" });
  }
});

router.post("/next-year-assignments/activate", requireManagerRole, async (req, res) => {
  try {
    const { yearLabel } = req.body as { yearLabel?: string };
    if (!yearLabel) return res.status(400).json({ error: "חסר תווית שנה" });

    const assignments = await db.select().from(nextYearAssignmentsTable)
      .where(eq(nextYearAssignmentsTable.yearLabel, yearLabel));

    if (assignments.length === 0) return res.status(400).json({ error: "אין שיבוצים לשנה זו" });
    const first = assignments[0];
    if (!first.locked) return res.status(403).json({ error: "התכנון חייב להיות נעול לפני הפעלה" });
    if (!first.approvedBy) return res.status(403).json({ error: "התכנון חייב להיות מאושר לפני הפעלה" });
    if (!first.released) return res.status(403).json({ error: "התכנון חייב להיות משוחרר לפני הפעלה" });

    const madrichList = assignments.filter(a => a.proposedRole === "madrich");
    const paelList = assignments.filter(a => a.proposedRole === "pael");

    let madrichCount = 0;
    let paelCount = 0;

    for (const a of madrichList) {
      const [scout] = await db.select().from(scoutsTable).where(eq(scoutsTable.id, a.scoutId));
      if (!scout) continue;

      const fullName = [scout.name, scout.lastName].filter(Boolean).join(" ");
      const assignedBattalion = a.proposedBattalion || scout.battalion || null;

      await db.update(scoutsTable)
        .set({
          role: "madrich",
          tribeRole: "madrich",
          ...(a.proposedBattalion ? { battalion: a.proposedBattalion } : {}),
        })
        .where(eq(scoutsTable.id, a.scoutId));

      const [existing] = await db.select().from(tribeUsersTable)
        .where(and(ilike(tribeUsersTable.name, fullName), eq(tribeUsersTable.role, "madrich")));

      if (existing) {
        await db.update(tribeUsersTable)
          .set({ battalion: assignedBattalion, active: true })
          .where(eq(tribeUsersTable.id, existing.id));
      } else {
        await db.insert(tribeUsersTable).values({
          name: fullName,
          role: "madrich",
          battalion: assignedBattalion,
          active: true,
        });
      }

      madrichCount++;
    }

    for (const a of paelList) {
      const [scout] = await db.select().from(scoutsTable).where(eq(scoutsTable.id, a.scoutId));
      if (!scout) continue;

      const fullName = [scout.name, scout.lastName].filter(Boolean).join(" ");

      await db.update(scoutsTable)
        .set({ role: "pael", tribeRole: "pael" })
        .where(eq(scoutsTable.id, a.scoutId));

      const [existing] = await db.select().from(tribeUsersTable)
        .where(and(ilike(tribeUsersTable.name, fullName), eq(tribeUsersTable.role, "pael")));

      if (existing) {
        await db.update(tribeUsersTable)
          .set({ battalion: a.proposedBattalion || scout.battalion || null, active: true })
          .where(eq(tribeUsersTable.id, existing.id));
      } else {
        await db.insert(tribeUsersTable).values({
          name: fullName,
          role: "pael",
          battalion: a.proposedBattalion || scout.battalion || null,
          active: true,
        });
      }

      paelCount++;
    }

    res.json({
      success: true,
      madrichim: madrichCount,
      paelim: paelCount,
      total: assignments.length,
    });
  } catch {
    res.status(500).json({ error: "שגיאה בהפעלת שיבוץ" });
  }
});

export default router;
