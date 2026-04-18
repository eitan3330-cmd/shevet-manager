import { Router } from "express";
import { db } from "@workspace/db";
import {
  eventTasksTable, eventParticipantsTable, eventBusesTable, eventMenuTable, scoutsTable,
  eventFormatsTable, eventEquipmentTable, eventBudgetItemsTable, eventScheduleTable,
  eventPortfolioTable, eventFlyerTable, eventStaffTable, tribeUsersTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

/* ---- Levenshtein distance helper ---- */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function normalizeName(s: string): string {
  return (s || "").trim().replace(/\s+/g, " ").toLowerCase();
}

/* ---- TASKS ---- */
router.get("/events/:id/tasks", async (req, res) => {
  const eventId = parseInt(req.params.id);
  const tasks = await db.select().from(eventTasksTable).where(eq(eventTasksTable.eventId, eventId)).orderBy(eventTasksTable.createdAt);
  res.json(tasks);
});
router.post("/events/:id/tasks", async (req, res) => {
  const eventId = parseInt(req.params.id);
  const { title, priority, assignee, notes, dueDate } = req.body;
  if (!title) return res.status(400).json({ error: "כותרת חובה" });
  const [task] = await db.insert(eventTasksTable).values({ eventId, title, priority: priority || "normal", assignee, notes, dueDate: dueDate ? new Date(dueDate) : null }).returning();
  res.status(201).json(task);
});
router.patch("/events/:id/tasks/:taskId", async (req, res) => {
  const taskId = parseInt(req.params.taskId);
  const { done, title, priority, assignee, notes } = req.body;
  const [task] = await db.update(eventTasksTable).set({ done, title, priority, assignee, notes }).where(eq(eventTasksTable.id, taskId)).returning();
  res.json(task);
});
router.delete("/events/:id/tasks/:taskId", async (req, res) => {
  await db.delete(eventTasksTable).where(eq(eventTasksTable.id, parseInt(req.params.taskId)));
  res.sendStatus(204);
});

/* ---- PARTICIPANTS ---- */
router.get("/events/:id/participants", async (req, res) => {
  const eventId = parseInt(req.params.id);
  const participants = await db
    .select({
      id: eventParticipantsTable.id,
      eventId: eventParticipantsTable.eventId,
      scoutId: eventParticipantsTable.scoutId,
      rawName: eventParticipantsTable.rawName,
      confirmed: eventParticipantsTable.confirmed,
      status: eventParticipantsTable.status,
      busId: eventParticipantsTable.busId,
      notes: eventParticipantsTable.notes,
      scoutName: scoutsTable.name,
      scoutLastName: scoutsTable.lastName,
      scoutGrade: scoutsTable.grade,
      scoutGizra: scoutsTable.gizra,
      scoutBattalion: scoutsTable.battalion,
      scoutPhone: scoutsTable.phone,
      scoutParentPhone: scoutsTable.parentPhone,
      scoutMedicalIssues: scoutsTable.medicalIssues,
      scoutFoodPreferences: scoutsTable.foodPreferences,
      scoutInstructorName: scoutsTable.instructorName,
    })
    .from(eventParticipantsTable)
    .leftJoin(scoutsTable, eq(eventParticipantsTable.scoutId, scoutsTable.id))
    .where(eq(eventParticipantsTable.eventId, eventId));
  res.json(participants);
});

router.post("/events/:id/participants/bulk-confirm", async (req, res) => {
  const eventId = parseInt(req.params.id);
  if (isNaN(eventId)) return res.status(400).json({ error: "מזהה מפעל לא תקין" });
  const { rows } = req.body as {
    rows: { scoutId?: number | null; rawName?: string | null; confirmed?: boolean }[];
  };
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: "rows חובה" });

  const existingScoutIds = new Set(
    (await db.select({ scoutId: eventParticipantsTable.scoutId })
      .from(eventParticipantsTable)
      .where(eq(eventParticipantsTable.eventId, eventId)))
      .map(r => r.scoutId).filter(Boolean)
  );

  let added = 0, skipped = 0, failed = 0;
  for (const row of rows) {
    const parsedScoutId = row.scoutId ? parseInt(String(row.scoutId)) : null;
    if (parsedScoutId && (isNaN(parsedScoutId) || existingScoutIds.has(parsedScoutId))) {
      skipped++;
      continue;
    }
    const isConfirmed = row.confirmed ?? (parsedScoutId ? true : false);
    try {
      await db.insert(eventParticipantsTable).values({
        eventId,
        scoutId: parsedScoutId,
        rawName: row.rawName || null,
        confirmed: isConfirmed,
        status: isConfirmed ? "confirmed" : "unconfirmed",
      });
      if (parsedScoutId) existingScoutIds.add(parsedScoutId);
      added++;
    } catch {
      failed++;
    }
  }
  res.json({ added, skipped, failed });
});

router.post("/events/:id/participants/import-excel", async (req, res) => {
  const eventId = parseInt(req.params.id);
  if (isNaN(eventId)) return res.status(400).json({ error: "מזהה מפעל לא תקין" });
  const { names } = req.body as { names: { firstName: string; lastName: string }[] };
  if (!Array.isArray(names)) return res.status(400).json({ error: "names array חסר" });
  const validNames = names.filter(n => n && (String(n.firstName || "").trim() || String(n.lastName || "").trim()))
    .slice(0, 1000);
  if (validNames.length === 0) return res.status(400).json({ error: "לא נמצאו שמות תקינים" });

  const allScouts = await db.select().from(scoutsTable);
  const existingParticipants = await db
    .select({ scoutId: eventParticipantsTable.scoutId })
    .from(eventParticipantsTable)
    .where(eq(eventParticipantsTable.eventId, eventId));
  const existingScoutIds = new Set(existingParticipants.map(p => p.scoutId).filter(Boolean));

  const results = validNames.map(({ firstName, lastName }) => {
    const fullName = normalizeName(`${firstName} ${lastName}`);
    const firstN = normalizeName(firstName);
    const lastN = normalizeName(lastName);

    let bestMatch: typeof allScouts[0] | null = null;
    let bestDist = Infinity;
    let matchType: "exact" | "fuzzy" | "none" = "none";

    for (const scout of allScouts) {
      const sFirst = normalizeName(scout.name);
      const sLast = normalizeName(scout.lastName || "");
      const sFull = `${sFirst} ${sLast}`.trim();
      const sFullAlt = `${sLast} ${sFirst}`.trim();

      if ((sFirst === firstN && sLast === lastN) || sFull === fullName || sFullAlt === fullName) {
        bestMatch = scout;
        bestDist = 0;
        matchType = "exact";
        break;
      }

      const dist = Math.min(
        levenshtein(fullName, sFull),
        levenshtein(fullName, sFullAlt),
        levenshtein(firstN, sFirst) + levenshtein(lastN, sLast),
      );
      if (dist < bestDist) {
        bestDist = dist;
        bestMatch = scout;
      }
    }

    if (matchType !== "exact" && bestMatch && bestDist <= 2) {
      matchType = "fuzzy";
    } else if (matchType !== "exact") {
      matchType = "none";
    }

    const isMatched = matchType === "exact" || matchType === "fuzzy";
    return {
      firstName,
      lastName,
      matchType,
      distance: bestDist === Infinity ? null : bestDist,
      alreadyAdded: isMatched && bestMatch ? existingScoutIds.has(bestMatch.id) : false,
      scout: isMatched && bestMatch ? {
        id: bestMatch.id,
        name: bestMatch.name,
        lastName: bestMatch.lastName,
        grade: bestMatch.grade,
        battalion: bestMatch.battalion,
        phone: bestMatch.phone,
        parentPhone: bestMatch.parentPhone,
        medicalIssues: bestMatch.medicalIssues,
        foodPreferences: bestMatch.foodPreferences,
        gizra: bestMatch.gizra,
        instructorName: bestMatch.instructorName,
      } : null,
    };
  });

  res.json(results);
});

router.post("/events/:id/participants", async (req, res) => {
  const eventId = parseInt(req.params.id);
  if (isNaN(eventId)) return res.status(400).json({ error: "מזהה מפעל לא תקין" });
  const { scoutId, rawName, confirmed, status, busId, notes } = req.body;
  if (!scoutId && !rawName) return res.status(400).json({ error: "חניך או שם גולמי חובה" });
  const parsedScoutId = scoutId !== undefined && scoutId !== null ? parseInt(scoutId) : null;
  if (parsedScoutId !== null && isNaN(parsedScoutId)) return res.status(400).json({ error: "מזהה חניך לא תקין" });

  if (parsedScoutId) {
    const [dup] = await db
      .select({ id: eventParticipantsTable.id })
      .from(eventParticipantsTable)
      .where(and(eq(eventParticipantsTable.eventId, eventId), eq(eventParticipantsTable.scoutId, parsedScoutId)))
      .limit(1);
    if (dup) return res.status(409).json({ error: "חניך זה כבר ברשימת המשתתפים" });
  }

  const isConfirmed = confirmed ?? (parsedScoutId ? true : false);
  const [p] = await db.insert(eventParticipantsTable).values({
    eventId,
    scoutId: parsedScoutId,
    rawName: rawName || null,
    confirmed: isConfirmed,
    status: status || (isConfirmed ? "confirmed" : "unconfirmed"),
    busId: busId || null,
    notes: notes || null,
  }).returning();
  res.status(201).json(p);
});

router.patch("/events/:id/participants/:pid", async (req, res) => {
  const eventId = parseInt(req.params.id);
  const pid = parseInt(req.params.pid);
  if (isNaN(eventId) || isNaN(pid)) return res.status(400).json({ error: "מזהה לא תקין" });
  const { scoutId, rawName, confirmed, status, busId, notes } = req.body;

  if (scoutId) {
    const parsedScoutId = parseInt(scoutId);
    if (isNaN(parsedScoutId)) return res.status(400).json({ error: "מזהה חניך לא תקין" });
    const [dup] = await db
      .select({ id: eventParticipantsTable.id })
      .from(eventParticipantsTable)
      .where(and(eq(eventParticipantsTable.eventId, eventId), eq(eventParticipantsTable.scoutId, parsedScoutId)))
      .limit(1);
    if (dup && dup.id !== pid) return res.status(409).json({ error: "חניך זה כבר ברשימת המשתתפים" });
  }

  const updates: Record<string, unknown> = {};
  if (scoutId !== undefined) updates.scoutId = scoutId ? parseInt(scoutId) : null;
  if (rawName !== undefined) updates.rawName = rawName || null;
  if (confirmed !== undefined) {
    updates.confirmed = confirmed;
    if (status === undefined) {
      updates.status = confirmed ? "confirmed" : "unconfirmed";
    }
  }
  if (status !== undefined) updates.status = status;
  if (busId !== undefined) updates.busId = busId || null;
  if (notes !== undefined) updates.notes = notes || null;
  const [p] = await db
    .update(eventParticipantsTable)
    .set(updates)
    .where(and(eq(eventParticipantsTable.id, pid), eq(eventParticipantsTable.eventId, eventId)))
    .returning();
  if (!p) return res.status(404).json({ error: "לא נמצא" });
  res.json(p);
});

router.delete("/events/:id/participants/:pid", async (req, res) => {
  const eventId = parseInt(req.params.id);
  const pid = parseInt(req.params.pid);
  await db
    .delete(eventParticipantsTable)
    .where(and(eq(eventParticipantsTable.id, pid), eq(eventParticipantsTable.eventId, eventId)));
  res.sendStatus(204);
});

/* ---- BUSES ---- */
router.get("/events/:id/buses", async (req, res) => {
  const eventId = parseInt(req.params.id);
  const buses = await db.select().from(eventBusesTable).where(eq(eventBusesTable.eventId, eventId)).orderBy(eventBusesTable.createdAt);
  res.json(buses);
});
router.post("/events/:id/buses", async (req, res) => {
  const eventId = parseInt(req.params.id);
  const { name, capacity, driverName, departureTime, meetingPoint, notes } = req.body;
  if (!name) return res.status(400).json({ error: "שם אוטובוס חובה" });
  const [bus] = await db.insert(eventBusesTable).values({ eventId, name, capacity, driverName, departureTime, meetingPoint, notes }).returning();
  res.status(201).json(bus);
});
router.patch("/events/:id/buses/:busId", async (req, res) => {
  const busId = parseInt(req.params.busId);
  const [bus] = await db.update(eventBusesTable).set(req.body).where(eq(eventBusesTable.id, busId)).returning();
  res.json(bus);
});
router.delete("/events/:id/buses/:busId", async (req, res) => {
  await db.delete(eventBusesTable).where(eq(eventBusesTable.id, parseInt(req.params.busId)));
  res.sendStatus(204);
});

/* ---- AUTO-ASSIGN BUSES ---- */
router.post("/events/:id/buses/auto-assign", async (req, res) => {
  const userRole = req.headers["x-user-role"] as string;
  const editRoles = ["marcaz_boger", "marcaz_tzair", "roshatz", "roshgad"];
  if (!editRoles.includes(userRole)) {
    return res.status(403).json({ error: "אין הרשאה לשיבוץ אוטומטי" });
  }
  try {
    const eventId = parseInt(req.params.id);
    const { busCapacity = 50, reserveForBogrim = 4 } = req.body;
    const cap = Math.max(10, Math.min(80, busCapacity));
    const reserveSpots = Math.max(0, Math.min(cap - 1, reserveForBogrim));
    const effectiveCap = Math.max(1, cap - reserveSpots);

    const allParticipants = await db
      .select({
        id: eventParticipantsTable.id,
        scoutId: eventParticipantsTable.scoutId,
        scoutGrade: scoutsTable.grade,
        scoutBattalion: scoutsTable.battalion,
        scoutGizra: scoutsTable.gizra,
        scoutName: scoutsTable.name,
        scoutLastName: scoutsTable.lastName,
      })
      .from(eventParticipantsTable)
      .leftJoin(scoutsTable, eq(eventParticipantsTable.scoutId, scoutsTable.id))
      .where(eq(eventParticipantsTable.eventId, eventId));

    if (allParticipants.length === 0) {
      return res.status(400).json({ error: "אין משתתפים לשיבוץ" });
    }

    const gradeGroups = new Map<string, typeof allParticipants>();
    for (const p of allParticipants) {
      const grade = p.scoutGrade || "ללא שכבה";
      if (!gradeGroups.has(grade)) gradeGroups.set(grade, []);
      gradeGroups.get(grade)!.push(p);
    }

    const busAssignments: { busNumber: number; participants: typeof allParticipants; grade: string; battalions: string[] }[] = [];
    let busNumber = 1;

    const GRADE_ORDER = ["ד", "ה", "ו", "ז", "ח", "ט", "י", "יא", "יב", "ללא שכבה"];

    for (const grade of GRADE_ORDER) {
      const gradeParticipants = gradeGroups.get(grade);
      if (!gradeParticipants || gradeParticipants.length === 0) continue;

      const battalionGroups = new Map<string, typeof allParticipants>();
      for (const p of gradeParticipants) {
        const bat = p.scoutBattalion || "ללא גדוד";
        if (!battalionGroups.has(bat)) battalionGroups.set(bat, []);
        battalionGroups.get(bat)!.push(p);
      }

      const sortedBattalions = [...battalionGroups.entries()].sort((a, b) => b[1].length - a[1].length);

      let currentBus: typeof allParticipants = [];
      let currentBattalions: string[] = [];

      for (const [batName, batParticipants] of sortedBattalions) {
        if (currentBus.length + batParticipants.length <= effectiveCap) {
          currentBus.push(...batParticipants);
          if (batName !== "ללא גדוד") currentBattalions.push(batName);
        } else {
          if (currentBus.length > 0) {
            busAssignments.push({ busNumber: busNumber++, participants: currentBus, grade, battalions: currentBattalions });
          }
          if (batParticipants.length <= effectiveCap) {
            currentBus = [...batParticipants];
            currentBattalions = batName !== "ללא גדוד" ? [batName] : [];
          } else {
            for (let i = 0; i < batParticipants.length; i += effectiveCap) {
              const chunk = batParticipants.slice(i, i + effectiveCap);
              busAssignments.push({ busNumber: busNumber++, participants: chunk, grade, battalions: batName !== "ללא גדוד" ? [batName] : [] });
            }
            currentBus = [];
            currentBattalions = [];
          }
        }
      }
      if (currentBus.length > 0) {
        busAssignments.push({ busNumber: busNumber++, participants: currentBus, grade, battalions: currentBattalions });
      }
    }

    await db.delete(eventBusesTable).where(eq(eventBusesTable.eventId, eventId));

    for (const bus of busAssignments) {
      const batLabel = bus.battalions.length > 0 ? ` - ${bus.battalions.join(", ")}` : "";
      const [createdBus] = await db.insert(eventBusesTable).values({
        eventId,
        name: `אוטובוס ${bus.busNumber}`,
        capacity: cap,
        notes: `שכבה ${bus.grade}${batLabel}`,
      }).returning();

      for (const p of bus.participants) {
        await db.update(eventParticipantsTable)
          .set({ busId: createdBus.id })
          .where(eq(eventParticipantsTable.id, p.id));
      }
    }

    const createdBuses = await db.select().from(eventBusesTable).where(eq(eventBusesTable.eventId, eventId)).orderBy(eventBusesTable.createdAt);
    res.json({ buses: createdBuses, totalBuses: busAssignments.length, totalAssigned: allParticipants.length });
  } catch (err: any) {
    console.error("Auto-assign buses error:", err);
    res.status(500).json({ error: "שגיאה בשיבוץ אוטומטי" });
  }
});

/* ---- MENU ---- */
router.get("/events/:id/menu", async (req, res) => {
  const eventId = parseInt(req.params.id);
  const menu = await db.select().from(eventMenuTable).where(eq(eventMenuTable.eventId, eventId)).orderBy(eventMenuTable.dayNumber, eventMenuTable.createdAt);
  res.json(menu);
});
router.post("/events/:id/menu", async (req, res) => {
  const eventId = parseInt(req.params.id);
  const { dayNumber, mealType, description, notes } = req.body;
  if (!mealType || !description) return res.status(400).json({ error: "סוג ארוחה ותיאור חובה" });
  const [item] = await db.insert(eventMenuTable).values({ eventId, dayNumber: dayNumber || 1, mealType, description, notes }).returning();
  res.status(201).json(item);
});
router.patch("/events/:id/menu/:menuId", async (req, res) => {
  const menuId = parseInt(req.params.menuId);
  const [item] = await db.update(eventMenuTable).set(req.body).where(eq(eventMenuTable.id, menuId)).returning();
  res.json(item);
});
router.delete("/events/:id/menu/:menuId", async (req, res) => {
  await db.delete(eventMenuTable).where(eq(eventMenuTable.id, parseInt(req.params.menuId)));
  res.sendStatus(204);
});

/* ---- FORMATS ---- */
router.get("/events/:id/formats", async (req, res) => {
  const eventId = parseInt(req.params.id);
  const rows = await db.select().from(eventFormatsTable).where(eq(eventFormatsTable.eventId, eventId)).orderBy(eventFormatsTable.createdAt);
  res.json(rows);
});
router.post("/events/:id/formats", async (req, res) => {
  const eventId = parseInt(req.params.id);
  const { title, category, description, duration, responsible, notes } = req.body;
  if (!title) return res.status(400).json({ error: "כותרת חובה" });
  const [row] = await db.insert(eventFormatsTable).values({ eventId, title, category: category || "general", description, duration, responsible, notes }).returning();
  res.status(201).json(row);
});
router.patch("/events/:id/formats/:fid", async (req, res) => {
  const [row] = await db.update(eventFormatsTable).set(req.body).where(eq(eventFormatsTable.id, parseInt(req.params.fid))).returning();
  res.json(row);
});
router.delete("/events/:id/formats/:fid", async (req, res) => {
  await db.delete(eventFormatsTable).where(eq(eventFormatsTable.id, parseInt(req.params.fid)));
  res.sendStatus(204);
});

/* ---- EQUIPMENT ---- */
router.get("/events/:id/equipment", async (req, res) => {
  const eventId = parseInt(req.params.id);
  const rows = await db.select().from(eventEquipmentTable).where(eq(eventEquipmentTable.eventId, eventId)).orderBy(eventEquipmentTable.category, eventEquipmentTable.createdAt);
  res.json(rows);
});
router.post("/events/:id/equipment", async (req, res) => {
  const eventId = parseInt(req.params.id);
  const { name, quantity, category, responsible, notes } = req.body;
  if (!name) return res.status(400).json({ error: "שם פריט חובה" });
  const [row] = await db.insert(eventEquipmentTable).values({ eventId, name, quantity: quantity || 1, category: category || "general", responsible, notes }).returning();
  res.status(201).json(row);
});
router.patch("/events/:id/equipment/:eid", async (req, res) => {
  const [row] = await db.update(eventEquipmentTable).set(req.body).where(eq(eventEquipmentTable.id, parseInt(req.params.eid))).returning();
  res.json(row);
});
router.delete("/events/:id/equipment/:eid", async (req, res) => {
  await db.delete(eventEquipmentTable).where(eq(eventEquipmentTable.id, parseInt(req.params.eid)));
  res.sendStatus(204);
});

/* ---- EVENT BUDGET ---- */
router.get("/events/:id/budget-items", async (req, res) => {
  const eventId = parseInt(req.params.id);
  const rows = await db.select().from(eventBudgetItemsTable).where(eq(eventBudgetItemsTable.eventId, eventId)).orderBy(eventBudgetItemsTable.createdAt);
  res.json(rows);
});
router.post("/events/:id/budget-items", async (req, res) => {
  const eventId = parseInt(req.params.id);
  const { type, category, description, plannedAmount, actualAmount, notes } = req.body;
  if (!description) return res.status(400).json({ error: "תיאור חובה" });
  const [row] = await db.insert(eventBudgetItemsTable).values({
    eventId, type: type || "expense", category: category || "general", description,
    plannedAmount: plannedAmount || "0", actualAmount: actualAmount || "0", notes,
  }).returning();
  res.status(201).json(row);
});
router.patch("/events/:id/budget-items/:bid", async (req, res) => {
  const [row] = await db.update(eventBudgetItemsTable).set(req.body).where(eq(eventBudgetItemsTable.id, parseInt(req.params.bid))).returning();
  res.json(row);
});
router.delete("/events/:id/budget-items/:bid", async (req, res) => {
  await db.delete(eventBudgetItemsTable).where(eq(eventBudgetItemsTable.id, parseInt(req.params.bid)));
  res.sendStatus(204);
});

/* ---- SCHEDULE (לוז) ---- */
router.get("/events/:id/schedule", async (req, res) => {
  const eventId = parseInt(req.params.id);
  const rows = await db.select().from(eventScheduleTable).where(eq(eventScheduleTable.eventId, eventId)).orderBy(eventScheduleTable.dayNumber, eventScheduleTable.startTime);
  res.json(rows);
});
router.post("/events/:id/schedule", async (req, res) => {
  const eventId = parseInt(req.params.id);
  const { dayNumber, startTime, endTime, title, location, responsible, notes, category } = req.body;
  if (!startTime || !title) return res.status(400).json({ error: "שעה וכותרת חובה" });
  const [row] = await db.insert(eventScheduleTable).values({
    eventId, dayNumber: dayNumber || 1, startTime, endTime, title, location, responsible, notes, category: category || "activity",
  }).returning();
  res.status(201).json(row);
});
router.patch("/events/:id/schedule/:sid", async (req, res) => {
  const [row] = await db.update(eventScheduleTable).set(req.body).where(eq(eventScheduleTable.id, parseInt(req.params.sid))).returning();
  res.json(row);
});
router.delete("/events/:id/schedule/:sid", async (req, res) => {
  await db.delete(eventScheduleTable).where(eq(eventScheduleTable.id, parseInt(req.params.sid)));
  res.sendStatus(204);
});

/* ---- PORTFOLIO (תיק) ---- */
router.get("/events/:id/portfolio", async (req, res) => {
  const eventId = parseInt(req.params.id);
  const rows = await db.select().from(eventPortfolioTable).where(eq(eventPortfolioTable.eventId, eventId)).orderBy(eventPortfolioTable.createdAt);
  res.json(rows);
});
router.post("/events/:id/portfolio", async (req, res) => {
  const eventId = parseInt(req.params.id);
  const { title, type, content, imageUrl } = req.body;
  if (!title) return res.status(400).json({ error: "כותרת חובה" });
  const [row] = await db.insert(eventPortfolioTable).values({ eventId, title, type: type || "note", content, imageUrl }).returning();
  res.status(201).json(row);
});
router.patch("/events/:id/portfolio/:pid", async (req, res) => {
  const [row] = await db.update(eventPortfolioTable).set(req.body).where(eq(eventPortfolioTable.id, parseInt(req.params.pid))).returning();
  res.json(row);
});
router.delete("/events/:id/portfolio/:pid", async (req, res) => {
  await db.delete(eventPortfolioTable).where(eq(eventPortfolioTable.id, parseInt(req.params.pid)));
  res.sendStatus(204);
});

/* ---- FLYER (פלייר) ---- */
router.get("/events/:id/flyer", async (req, res) => {
  const eventId = parseInt(req.params.id);
  const rows = await db.select().from(eventFlyerTable).where(eq(eventFlyerTable.eventId, eventId));
  res.json(rows[0] || null);
});
router.put("/events/:id/flyer", async (req, res) => {
  const eventId = parseInt(req.params.id);
  const { headline, subtitle, dateText, locationText, targetAudience, contactName, contactPhone, additionalInfo } = req.body;
  const existing = await db.select().from(eventFlyerTable).where(eq(eventFlyerTable.eventId, eventId));
  if (existing.length > 0) {
    const [row] = await db.update(eventFlyerTable).set({ headline, subtitle, dateText, locationText, targetAudience, contactName, contactPhone, additionalInfo, updatedAt: new Date() })
      .where(eq(eventFlyerTable.eventId, eventId)).returning();
    res.json(row);
  } else {
    const [row] = await db.insert(eventFlyerTable).values({ eventId, headline, subtitle, dateText, locationText, targetAudience, contactName, contactPhone, additionalInfo }).returning();
    res.status(201).json(row);
  }
});

/* ---- EVENT STAFF (שכבגיסטים) ---- */
const STAFF_EDITOR_ROLES = ["marcaz_boger", "marcaz_tzair", "roshatz", "roshgad"];

function canEditStaff(req: any): boolean {
  const role = (req.headers["x-user-role"] as string) || "";
  return STAFF_EDITOR_ROLES.includes(role);
}

router.get("/events/:id/staff", async (req, res) => {
  const eventId = parseInt(req.params.id);
  const staff = await db
    .select({
      id: eventStaffTable.id,
      eventId: eventStaffTable.eventId,
      userId: eventStaffTable.userId,
      role: eventStaffTable.role,
      notes: eventStaffTable.notes,
      createdAt: eventStaffTable.createdAt,
      userName: tribeUsersTable.name,
      userRole: tribeUsersTable.role,
      userGrade: tribeUsersTable.grade,
      userTeam: tribeUsersTable.team,
    })
    .from(eventStaffTable)
    .leftJoin(tribeUsersTable, eq(eventStaffTable.userId, tribeUsersTable.id))
    .where(eq(eventStaffTable.eventId, eventId))
    .orderBy(eventStaffTable.createdAt);
  res.json(staff);
});

router.post("/events/:id/staff", async (req, res) => {
  if (!canEditStaff(req)) return res.status(403).json({ error: "אין הרשאה" });
  const eventId = parseInt(req.params.id);
  const { userId, role, notes } = req.body;
  if (!userId) return res.status(400).json({ error: "חובה לבחור משתמש" });
  const existing = await db.select().from(eventStaffTable)
    .where(and(eq(eventStaffTable.eventId, eventId), eq(eventStaffTable.userId, parseInt(userId))));
  if (existing.length > 0) return res.status(400).json({ error: "המשתמש כבר משובץ למפעל" });
  const [staff] = await db.insert(eventStaffTable).values({
    eventId,
    userId: parseInt(userId),
    role: role || "שכבגיסט",
    notes: notes || null,
  }).returning();
  res.status(201).json(staff);
});

router.put("/events/:id/staff/:staffId", async (req, res) => {
  if (!canEditStaff(req)) return res.status(403).json({ error: "אין הרשאה" });
  const staffId = parseInt(req.params.staffId);
  const { role, notes } = req.body;
  const updates: any = {};
  if (role !== undefined) updates.role = role;
  if (notes !== undefined) updates.notes = notes;
  const [staff] = await db.update(eventStaffTable).set(updates).where(eq(eventStaffTable.id, staffId)).returning();
  if (!staff) return res.status(404).json({ error: "לא נמצא" });
  res.json(staff);
});

router.delete("/events/:id/staff/:staffId", async (req, res) => {
  if (!canEditStaff(req)) return res.status(403).json({ error: "אין הרשאה" });
  await db.delete(eventStaffTable).where(eq(eventStaffTable.id, parseInt(req.params.staffId)));
  res.sendStatus(204);
});

router.get("/events/my-staff-events/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId);
  const staffEntries = await db.select({ eventId: eventStaffTable.eventId })
    .from(eventStaffTable)
    .where(eq(eventStaffTable.userId, userId));
  res.json(staffEntries.map(s => s.eventId));
});

export default router;
