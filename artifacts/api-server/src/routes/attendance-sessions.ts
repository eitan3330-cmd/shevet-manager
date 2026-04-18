import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, attendanceSessionsTable, attendanceTable, scoutsTable, tribeUsersTable } from "@workspace/db";

const router = Router();

const MANAGER_ROLES = ["marcaz_boger", "marcaz_tzair", "roshgad", "madrich"];
const MARKER_ROLES = ["marcaz_boger", "marcaz_tzair", "roshgad", "roshatz", "madrich"];

function getUserRole(req: any): string | null {
  return (req.headers["x-user-role"] as string) || null;
}

function requireManagerRole(req: any, res: any): boolean {
  const role = getUserRole(req);
  if (!role || !MANAGER_ROLES.includes(role)) {
    res.status(403).json({ error: "אין הרשאה — נדרש תפקיד מנהל (מרכז בוגר / מרכז צעיר / ראשגד)" });
    return false;
  }
  return true;
}

function requireMarkerRole(req: any, res: any): boolean {
  const role = getUserRole(req);
  if (!role || !MARKER_ROLES.includes(role)) {
    res.status(403).json({ error: "אין הרשאה לסמן נוכחות" });
    return false;
  }
  return true;
}

router.get("/attendance-sessions", async (req, res) => {
  const sessions = await db
    .select()
    .from(attendanceSessionsTable)
    .orderBy(desc(attendanceSessionsTable.date));

  const all = await db.select().from(attendanceTable);

  const sessionsWithCounts = sessions.map(s => {
    const sRecords = all.filter(r => r.sessionId === s.id);
    const scoutRecords = sRecords.filter(r => !r.isStaff);
    const staffRecords = sRecords.filter(r => r.isStaff);
    return {
      ...s,
      scoutCount: scoutRecords.filter(r => r.status === "present" || r.status === "late").length,
      scoutTotal: scoutRecords.length,
      staffCount: staffRecords.filter(r => r.status === "present" || r.status === "late").length,
      staffTotal: staffRecords.length,
    };
  });

  res.json(sessionsWithCounts);
});

/* Verification endpoint: shows per-session madrich reporting status */
router.get("/attendance-sessions/verification", async (req, res) => {
  if (!requireManagerRole(req, res)) return;
  const { battalion } = req.query as { battalion?: string };
  try {
    const sessions = await db.select().from(attendanceSessionsTable)
      .where(battalion ? eq(attendanceSessionsTable.battalion, battalion) : undefined as any)
      .orderBy(desc(attendanceSessionsTable.date));

    const scouts = await db.select({
      id: scoutsTable.id,
      name: scoutsTable.name,
      lastName: scoutsTable.lastName,
      instructorName: scoutsTable.instructorName,
      battalion: scoutsTable.battalion,
    }).from(scoutsTable);

    const allAttendance = await db.select({
      sessionId: attendanceTable.sessionId,
      scoutId: attendanceTable.scoutId,
      status: attendanceTable.status,
    }).from(attendanceTable).where(eq(attendanceTable.isStaff, false));

    const result = sessions.map(session => {
      const sessionScouts = scouts.filter(s =>
        !session.battalion || s.battalion === session.battalion
      );
      const sessionAttendance = allAttendance.filter(a => a.sessionId === session.id);
      const markedIds = new Set(sessionAttendance.map(a => a.scoutId));

      const byInstructor: Record<string, { total: number; marked: number; instructorName: string }> = {};
      for (const scout of sessionScouts) {
        const key = scout.instructorName || "ללא מדריך";
        if (!byInstructor[key]) byInstructor[key] = { total: 0, marked: 0, instructorName: key };
        byInstructor[key].total++;
        if (markedIds.has(scout.id)) byInstructor[key].marked++;
      }
      return {
        session,
        total: sessionScouts.length,
        marked: sessionAttendance.length,
        instructors: Object.values(byInstructor),
      };
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "שגיאה בטעינת נתוני בקרה" });
  }
});

router.get("/attendance-sessions/all-records", async (req, res) => {
  if (!requireMarkerRole(req, res)) return;
  try {
    const records = await db
      .select({
        id: attendanceTable.id,
        scoutId: attendanceTable.scoutId,
        sessionId: attendanceTable.sessionId,
        status: attendanceTable.status,
        scoutName: scoutsTable.name,
        scoutLastName: scoutsTable.lastName,
        grade: scoutsTable.grade,
        battalion: scoutsTable.battalion,
        sessionTitle: attendanceSessionsTable.title,
        sessionDate: attendanceSessionsTable.date,
        sessionBattalion: attendanceSessionsTable.battalion,
        sessionGradeLevel: attendanceSessionsTable.gradeLevel,
      })
      .from(attendanceTable)
      .leftJoin(scoutsTable, eq(attendanceTable.scoutId, scoutsTable.id))
      .leftJoin(attendanceSessionsTable, eq(attendanceTable.sessionId, attendanceSessionsTable.id))
      .where(eq(attendanceTable.isStaff, false));
    res.json(records);
  } catch {
    res.status(500).json({ error: "שגיאה בטעינת נתוני נוכחות" });
  }
});

router.get("/attendance-sessions/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [session] = await db
    .select()
    .from(attendanceSessionsTable)
    .where(eq(attendanceSessionsTable.id, id));
  if (!session) return res.status(404).json({ error: "לא נמצא" });

  const scoutRecords = await db
    .select({
      id: attendanceTable.id,
      scoutId: attendanceTable.scoutId,
      status: attendanceTable.status,
      notes: attendanceTable.notes,
      scoutName: scoutsTable.name,
      scoutLastName: scoutsTable.lastName,
      grade: scoutsTable.grade,
      battalion: scoutsTable.battalion,
      instructorName: scoutsTable.instructorName,
    })
    .from(attendanceTable)
    .leftJoin(scoutsTable, eq(attendanceTable.scoutId, scoutsTable.id))
    .where(and(eq(attendanceTable.sessionId, id), eq(attendanceTable.isStaff, false)));

  const staffRecords = await db
    .select({
      id: attendanceTable.id,
      userId: attendanceTable.userId,
      status: attendanceTable.status,
      notes: attendanceTable.notes,
    })
    .from(attendanceTable)
    .where(and(eq(attendanceTable.sessionId, id), eq(attendanceTable.isStaff, true)));

  const users = await db.select().from(tribeUsersTable).where(eq(tribeUsersTable.active, true));

  const staffWithNames = staffRecords.map(r => ({
    ...r,
    userName: users.find(u => u.id === r.userId)?.name || null,
    userRole: users.find(u => u.id === r.userId)?.role || null,
  }));

  res.json({ session, records: scoutRecords, staffRecords: staffWithNames });
});

router.post("/attendance-sessions", async (req, res) => {
  if (!requireManagerRole(req, res)) return;
  const { title, date, type, battalion, gradeLevel, notes, createdBy } = req.body;
  if (!title || !date) return res.status(400).json({ error: "כותרת ותאריך חובה" });
  const [session] = await db.insert(attendanceSessionsTable).values({
    title,
    date: new Date(date),
    type: type || "regular",
    battalion: battalion || null,
    gradeLevel: gradeLevel || null,
    notes: notes || null,
    createdBy: createdBy || null,
    isLocked: false,
  }).returning();
  res.status(201).json(session);
});

router.patch("/attendance-sessions/:id", async (req, res) => {
  if (!requireManagerRole(req, res)) return;
  const id = parseInt(req.params.id);
  const { title, date, type, battalion, gradeLevel, notes, isLocked } = req.body;
  const [session] = await db.update(attendanceSessionsTable)
    .set({
      ...(title && { title }),
      ...(date && { date: new Date(date) }),
      ...(type && { type }),
      ...(battalion !== undefined && { battalion: battalion || null }),
      ...(gradeLevel !== undefined && { gradeLevel: gradeLevel || null }),
      ...(notes !== undefined && { notes: notes || null }),
      ...(isLocked !== undefined && { isLocked }),
    })
    .where(eq(attendanceSessionsTable.id, id))
    .returning();
  res.json(session);
});

router.delete("/attendance-sessions/:id", async (req, res) => {
  if (!requireManagerRole(req, res)) return;
  const id = parseInt(req.params.id);
  await db.delete(attendanceSessionsTable).where(eq(attendanceSessionsTable.id, id));
  res.sendStatus(204);
});

router.post("/attendance-sessions/:id/lock", async (req, res) => {
  if (!requireManagerRole(req, res)) return;
  const id = parseInt(req.params.id);
  const { isLocked } = req.body as { isLocked: boolean };
  const [session] = await db.update(attendanceSessionsTable)
    .set({ isLocked: !!isLocked })
    .where(eq(attendanceSessionsTable.id, id))
    .returning();
  res.json(session);
});

router.post("/attendance-sessions/:id/mark", async (req, res) => {
  if (!requireMarkerRole(req, res)) return;
  const sessionId = parseInt(req.params.id);
  const { scoutId, status, notes } = req.body;
  if (!scoutId || !status) return res.status(400).json({ error: "scoutId ו-status חובה" });

  const [session] = await db.select().from(attendanceSessionsTable).where(eq(attendanceSessionsTable.id, sessionId));
  if (!session) return res.status(404).json({ error: "לא נמצא" });
  if (session.isLocked) return res.status(403).json({ error: "המפגש נעול" });

  const scoutIdInt = parseInt(scoutId);
  if (status === "clear") {
    await db.delete(attendanceTable)
      .where(and(eq(attendanceTable.sessionId, sessionId), eq(attendanceTable.scoutId, scoutIdInt)));
    return res.json({ cleared: true });
  }

  const existing = await db.select().from(attendanceTable)
    .where(and(
      eq(attendanceTable.sessionId, sessionId),
      eq(attendanceTable.scoutId, scoutIdInt),
      eq(attendanceTable.isStaff, false),
    ));

  let record;
  if (existing.length > 0) {
    [record] = await db.update(attendanceTable)
      .set({ status, notes: notes || null })
      .where(eq(attendanceTable.id, existing[0].id))
      .returning();
  } else {
    [record] = await db.insert(attendanceTable).values({
      scoutId: scoutIdInt,
      sessionId,
      date: session?.date || new Date(),
      status,
      notes: notes || null,
      isStaff: false,
    }).returning();
  }
  res.status(201).json(record);
});

router.post("/attendance-sessions/:id/mark-staff", async (req, res) => {
  if (!requireMarkerRole(req, res)) return;
  const sessionId = parseInt(req.params.id);
  const { userId, status, notes } = req.body;
  if (!userId || !status) return res.status(400).json({ error: "userId ו-status חובה" });

  const [session] = await db.select().from(attendanceSessionsTable).where(eq(attendanceSessionsTable.id, sessionId));
  if (!session) return res.status(404).json({ error: "לא נמצא" });
  if (session.isLocked) return res.status(403).json({ error: "המפגש נעול" });

  const userIdInt = parseInt(userId);

  if (status === "clear") {
    await db.delete(attendanceTable)
      .where(and(
        eq(attendanceTable.sessionId, sessionId),
        eq(attendanceTable.userId, userIdInt),
        eq(attendanceTable.isStaff, true),
      ));
    return res.json({ cleared: true });
  }

  const existing = await db.select().from(attendanceTable)
    .where(and(
      eq(attendanceTable.sessionId, sessionId),
      eq(attendanceTable.userId, userIdInt),
      eq(attendanceTable.isStaff, true),
    ));

  let record;
  if (existing.length > 0) {
    [record] = await db.update(attendanceTable)
      .set({ status, notes: notes || null })
      .where(eq(attendanceTable.id, existing[0].id))
      .returning();
  } else {
    [record] = await db.insert(attendanceTable).values({
      sessionId,
      userId: userIdInt,
      date: session.date,
      status,
      notes: notes || null,
      isStaff: true,
    }).returning();
  }
  res.status(201).json(record);
});

router.post("/attendance-sessions/:id/mark-bulk", async (req, res) => {
  if (!requireMarkerRole(req, res)) return;
  const sessionId = parseInt(req.params.id);
  const { marks } = req.body as { marks: { scoutId: number; status: string; notes?: string }[] };
  if (!Array.isArray(marks)) return res.status(400).json({ error: "marks array required" });

  const [session] = await db.select().from(attendanceSessionsTable).where(eq(attendanceSessionsTable.id, sessionId));
  if (!session) return res.status(404).json({ error: "לא נמצא" });
  if (session.isLocked) return res.status(403).json({ error: "המפגש נעול" });

  const existing = await db.select().from(attendanceTable)
    .where(and(eq(attendanceTable.sessionId, sessionId), eq(attendanceTable.isStaff, false)));
  let updated = 0, added = 0;

  for (const m of marks) {
    const record = existing.find(r => r.scoutId === m.scoutId);
    if (m.status === "clear") {
      if (record) await db.delete(attendanceTable).where(eq(attendanceTable.id, record.id));
      continue;
    }
    if (record) {
      await db.update(attendanceTable).set({ status: m.status, notes: m.notes || null }).where(eq(attendanceTable.id, record.id));
      updated++;
    } else {
      await db.insert(attendanceTable).values({ scoutId: m.scoutId, sessionId, date: session.date, status: m.status, notes: m.notes || null, isStaff: false });
      added++;
    }
  }
  res.json({ updated, added });
});

export default router;
