import { Router } from "express";
import { db } from "@workspace/db";
import { tribeUsersTable, scoutsTable } from "@workspace/db";
import { eq, inArray, isNotNull, or, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";

const router = Router();
const SALT_ROUNDS = 10;

router.get("/users", async (_req, res) => {
  try {
    const users = await db.select({
      id: tribeUsersTable.id,
      name: tribeUsersTable.name,
      role: tribeUsersTable.role,
      battalion: tribeUsersTable.battalion,
      team: tribeUsersTable.team,
      grade: tribeUsersTable.grade,
      active: tribeUsersTable.active,
      hasPin: tribeUsersTable.pin,
      scoutId: tribeUsersTable.scoutId,
      createdAt: tribeUsersTable.createdAt,
    }).from(tribeUsersTable).where(eq(tribeUsersTable.active, true)).orderBy(tribeUsersTable.name);
    res.json(users.map(u => ({ ...u, hasPin: !!u.hasPin })));
  } catch {
    res.status(500).json({ error: "שגיאה בטעינת משתמשים" });
  }
});

router.post("/users", async (req, res) => {
  try {
    const { name, role, battalion } = req.body as { name?: string; role?: string; battalion?: string };
    if (!name || !role) return res.status(400).json({ error: "שם ותפקיד חובה" });
    const [user] = await db.insert(tribeUsersTable).values({ name, role, battalion: battalion || null, active: true }).returning();
    const { pin: _pin, ...safeUser } = user;
    res.status(201).json({ ...safeUser, hasPin: !!_pin });
  } catch {
    res.status(500).json({ error: "שגיאה ביצירת משתמש" });
  }
});

router.patch("/users/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, role, battalion, team, grade } = req.body as { name?: string; role?: string; battalion?: string; team?: string; grade?: string };
    const updates: Partial<typeof tribeUsersTable.$inferInsert> = {};
    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;
    if (battalion !== undefined) updates.battalion = battalion || null;
    if (team !== undefined) updates.team = team || null;
    if (grade !== undefined) updates.grade = grade || null;
    const [user] = await db.update(tribeUsersTable).set(updates).where(eq(tribeUsersTable.id, id)).returning();
    const { pin: _pin, ...safeUser } = user;
    res.json({ ...safeUser, hasPin: !!_pin });
  } catch {
    res.status(500).json({ error: "שגיאה בעדכון משתמש" });
  }
});

router.post("/users/rename-team", async (req, res) => {
  try {
    const { oldName, newName } = req.body as { oldName: string; newName: string };
    if (!oldName) return res.status(400).json({ error: "שם צוות ישן חסר" });
    const result = await db.update(tribeUsersTable)
      .set({ team: newName || null })
      .where(eq(tribeUsersTable.team, oldName));
    res.json({ updated: true });
  } catch {
    res.status(500).json({ error: "שגיאה בשינוי שם צוות" });
  }
});

router.post("/users/clear-team", async (req, res) => {
  try {
    const { teamName } = req.body as { teamName: string };
    if (!teamName) return res.status(400).json({ error: "שם צוות חסר" });
    const result = await db.update(tribeUsersTable)
      .set({ team: null })
      .where(eq(tribeUsersTable.team, teamName));
    res.json({ cleared: true });
  } catch {
    res.status(500).json({ error: "שגיאה במחיקת צוות" });
  }
});

router.post("/users/:id/pin", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { pin, currentPin } = req.body as { pin?: string; currentPin?: string };
    const [existing] = await db.select().from(tribeUsersTable).where(eq(tribeUsersTable.id, id));
    if (!existing) return res.status(404).json({ error: "משתמש לא נמצא" });
    if (existing.pin) {
      if (!currentPin) return res.status(403).json({ error: "PIN נוכחי שגוי" });
      const match = await bcrypt.compare(currentPin, existing.pin);
      if (!match) return res.status(403).json({ error: "PIN נוכחי שגוי" });
    }
    if (pin && !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: "PIN חייב להיות 4 ספרות" });
    }
    const hashed = pin ? await bcrypt.hash(pin, SALT_ROUNDS) : null;
    await db.update(tribeUsersTable).set({ pin: hashed }).where(eq(tribeUsersTable.id, id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "שגיאה בעדכון PIN" });
  }
});

// Admin-only PIN reset (no current PIN required) — marcaz_boger only
router.post("/users/:id/pin/admin-reset", async (req, res) => {
  try {
    const requesterRole = req.headers["x-user-role"] as string;
    if (requesterRole !== "marcaz_boger") return res.status(403).json({ error: "אין הרשאה" });
    const id = parseInt(req.params.id);
    const { pin } = req.body as { pin?: string };
    if (pin && !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: "PIN חייב להיות 4 ספרות" });
    }
    const hashed = pin ? await bcrypt.hash(pin, SALT_ROUNDS) : null;
    const [existing] = await db.select().from(tribeUsersTable).where(eq(tribeUsersTable.id, id));
    if (!existing) return res.status(404).json({ error: "משתמש לא נמצא" });
    await db.update(tribeUsersTable).set({ pin: hashed }).where(eq(tribeUsersTable.id, id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "שגיאה באיפוס PIN" });
  }
});

router.post("/users/login", async (req, res) => {
  try {
    const { id, pin } = req.body as { id?: number; pin?: string };
    if (!id) return res.status(400).json({ error: "חסר מזהה משתמש" });
    const [user] = await db.select().from(tribeUsersTable).where(eq(tribeUsersTable.id, id));
    if (!user || !user.active) return res.status(404).json({ error: "משתמש לא נמצא" });
    if (user.pin) {
      if (!pin) return res.status(401).json({ error: "נדרש PIN" });
      const match = await bcrypt.compare(pin, user.pin);
      if (!match) return res.status(401).json({ error: "PIN שגוי" });
    }
    const { pin: _pin, ...safeUser } = user;
    res.json({ ...safeUser, hasPin: !!_pin });
  } catch {
    res.status(500).json({ error: "שגיאה בכניסה" });
  }
});

// Verify PIN for a specific user (used by the login form)
router.post("/users/:id/verify-pin", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { pin } = req.body as { pin?: string };
    if (!pin) return res.status(400).json({ error: "חסר PIN" });
    const [user] = await db.select().from(tribeUsersTable).where(eq(tribeUsersTable.id, id));
    if (!user || !user.active) return res.status(404).json({ error: "משתמש לא נמצא" });
    if (!user.pin) return res.json({ success: true });
    const match = await bcrypt.compare(pin, user.pin);
    if (!match) return res.status(401).json({ success: false, error: "PIN שגוי" });
    const { pin: _pin, ...safeUser } = user;
    res.json({ success: true, user: { ...safeUser, hasPin: true } });
  } catch {
    res.status(500).json({ error: "שגיאה באימות PIN" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(tribeUsersTable).set({ active: false }).where(eq(tribeUsersTable.id, id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "שגיאה במחיקת משתמש" });
  }
});

// Sync scouts in grades י-יא-יב to tribe_users (marcaz_boger only)
router.post("/users/sync-paelim", async (req, res) => {
  try {
    const requesterRole = req.headers["x-user-role"] as string;
    if (requesterRole !== "marcaz_boger") return res.status(403).json({ error: "אין הרשאה" });

    const PAELIM_GRADES = ["י", "יא", "יב"];

    // Fetch all scouts in those grades
    const scouts = await db.select().from(scoutsTable).where(
      inArray(scoutsTable.grade, PAELIM_GRADES)
    );

    // Fetch all existing tribe_users that have a scoutId
    const existingLinked = await db.select().from(tribeUsersTable).where(
      isNotNull(tribeUsersTable.scoutId)
    );
    const existingByScoutId = new Map(existingLinked.map(u => [u.scoutId!, u]));

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const scout of scouts) {
      const fullName = [scout.name, scout.lastName].filter(Boolean).join(" ");
      const role = scout.role === "madrich" ? "madrich" : "pael";
      const battalion = scout.gizra;

      const existing = existingByScoutId.get(scout.id);
      if (existing) {
        // Reactivate if deactivated and update details
        if (!existing.active || existing.name !== fullName || existing.role !== role || existing.battalion !== battalion) {
          await db.update(tribeUsersTable)
            .set({ name: fullName, role, battalion, active: true })
            .where(eq(tribeUsersTable.id, existing.id));
          updated++;
        } else {
          skipped++;
        }
      } else {
        await db.insert(tribeUsersTable).values({
          name: fullName,
          role,
          battalion,
          scoutId: scout.id,
          active: true,
        });
        created++;
      }
    }

    res.json({ success: true, created, updated, skipped, total: scouts.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "שגיאה בסנכרון פעילים" });
  }
});

router.post("/users/sync-staff-to-scouts", async (req, res) => {
  try {
    const allUsers = await db.select().from(tribeUsersTable).where(eq(tribeUsersTable.active, true));
    const allScouts = await db.select().from(scoutsTable);

    const paelim = allUsers.filter(u => u.role === "pael");
    const roshatzUsers = allUsers.filter(u => u.role === "roshatz");
    const roshgadUsers = allUsers.filter(u => u.role === "roshgad");
    const madrichim = allUsers.filter(u => u.role === "madrich");

    const scoutsByName = new Map<string, typeof allScouts[0]>();
    allScouts.forEach(s => {
      const key = s.name.trim();
      scoutsByName.set(key, s);
      if (s.lastName) {
        scoutsByName.set(`${s.name.trim()} ${s.lastName.trim()}`, s);
      }
    });

    let scoutsCreated = 0;
    let scoutsLinked = 0;
    let usersUpdated = 0;

    const PAELIM_GRADES = ["י", "יא", "יב"];

    for (const pael of paelim) {
      const nameKey = pael.name.trim();
      const existingScout = scoutsByName.get(nameKey);

      if (existingScout && PAELIM_GRADES.includes(existingScout.grade || "")) {
        if (!pael.scoutId || pael.scoutId !== existingScout.id) {
          await db.update(tribeUsersTable)
            .set({ scoutId: existingScout.id })
            .where(eq(tribeUsersTable.id, pael.id));
          scoutsLinked++;
        }
        if (pael.team && existingScout.gizra !== pael.team) {
          await db.update(scoutsTable)
            .set({ gizra: pael.team, role: "pael" })
            .where(eq(scoutsTable.id, existingScout.id));
        }
      } else if (!pael.scoutId) {
        const nameParts = pael.name.trim().split(" ");
        const firstName = nameParts[0] || pael.name;
        const lastName = nameParts.slice(1).join(" ") || null;
        const [newScout] = await db.insert(scoutsTable).values({
          name: firstName,
          lastName,
          gizra: pael.team || "",
          grade: pael.grade || "י",
          role: "pael",
          battalion: pael.battalion || null,
        }).returning();
        await db.update(tribeUsersTable)
          .set({ scoutId: newScout.id })
          .where(eq(tribeUsersTable.id, pael.id));
        scoutsCreated++;
        scoutsLinked++;
        scoutsByName.set(pael.name.trim(), newScout);
      }
    }

    const teamToRoshatz = new Map<string, string[]>();
    for (const rtz of roshatzUsers) {
      const rtzBn = (rtz.battalion || "").trim();
      if (!rtzBn) continue;

      let matchedTeam: string | null = null;

      const paelTeams = [...new Set(paelim.map(p => p.team).filter((t): t is string => Boolean(t)))];
      for (const pt of paelTeams) {
        const ptNorm = pt.replace(/['"״׳\s+]/g, "").toLowerCase();
        const bnNorm = rtzBn.replace(/['"״׳\s+]/g, "").toLowerCase();
        if (ptNorm === bnNorm || ptNorm.includes(bnNorm) || bnNorm.includes(ptNorm)) {
          matchedTeam = pt;
          break;
        }
      }

      if (matchedTeam && rtz.team !== matchedTeam) {
        await db.update(tribeUsersTable)
          .set({ team: matchedTeam })
          .where(eq(tribeUsersTable.id, rtz.id));
        usersUpdated++;
      }

      if (matchedTeam) {
        if (!teamToRoshatz.has(matchedTeam)) teamToRoshatz.set(matchedTeam, []);
        teamToRoshatz.get(matchedTeam)!.push(rtz.name);
      }
    }

    for (const madrich of madrichim) {
      if (madrich.scoutId) continue;
      const nameKey = madrich.name.trim();
      const existingScout = scoutsByName.get(nameKey);
      if (existingScout) {
        await db.update(tribeUsersTable)
          .set({ scoutId: existingScout.id })
          .where(eq(tribeUsersTable.id, madrich.id));
        scoutsLinked++;
        if (madrich.battalion && existingScout.instructorName !== madrich.name) {
          await db.update(scoutsTable)
            .set({ role: "madrich" })
            .where(eq(scoutsTable.id, existingScout.id));
        }
      }
    }

    for (const roshgad of roshgadUsers) {
      if (roshgad.scoutId) continue;
      const nameKey = roshgad.name.trim();
      const existingScout = scoutsByName.get(nameKey);
      if (existingScout) {
        await db.update(tribeUsersTable)
          .set({ scoutId: existingScout.id })
          .where(eq(tribeUsersTable.id, roshgad.id));
        scoutsLinked++;
      }
    }

    res.json({
      success: true,
      scoutsCreated,
      scoutsLinked,
      usersUpdated,
      teamMapping: Object.fromEntries(teamToRoshatz),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "שגיאה בסנכרון עץ שיבוצים עם חניכים" });
  }
});

router.delete("/users", async (_req, res) => {
  try {
    await db.update(tribeUsersTable).set({ active: false });
    res.json({ success: true, message: "כל המשתמשים אופסו" });
  } catch {
    res.status(500).json({ error: "שגיאה באיפוס משתמשים" });
  }
});

router.post("/users/import-bulk", async (req, res) => {
  try {
    const { rows } = req.body as { rows: { name: string; role: string; battalion?: string }[] };
    if (!Array.isArray(rows)) return res.status(400).json({ error: "rows חסר" });
    let added = 0, skipped = 0;
    for (const row of rows) {
      if (!row.name || !row.role) { skipped++; continue; }
      const existing = await db.select().from(tribeUsersTable)
        .where(eq(tribeUsersTable.name, row.name));
      if (existing.length > 0) { skipped++; continue; }
      await db.insert(tribeUsersTable).values({
        name: row.name.trim(),
        role: row.role.trim(),
        battalion: row.battalion?.trim() || null,
        active: true,
      });
      added++;
    }
    res.json({ success: true, added, skipped });
  } catch {
    res.status(500).json({ error: "שגיאה בייבוא משתמשים" });
  }
});

// Comprehensive assignments import — creates/updates users and syncs with scouts
router.post("/users/import-assignments", async (req, res) => {
  try {
    const { rows, clearRoles } = req.body as {
      rows: { name: string; role: string; battalion?: string; team?: string; grade?: string; lastName?: string }[];
      clearRoles?: string[];
    };
    if (!Array.isArray(rows)) return res.status(400).json({ error: "rows חסר" });

    let cleared = 0;
    if (Array.isArray(clearRoles) && clearRoles.length > 0) {
      const result = await db.update(tribeUsersTable)
        .set({ active: false })
        .where(inArray(tribeUsersTable.role, clearRoles))
        .returning({ id: tribeUsersTable.id });
      cleared = result.length;
    }

    let created = 0, updated = 0, skipped = 0;

    for (const row of rows) {
      if (!row.name || !row.role) { skipped++; continue; }
      const fullName = [row.name.trim(), row.lastName?.trim()].filter(Boolean).join(" ");
      const role = row.role.trim();
      const battalion = row.battalion?.trim() || null;
      const team = row.team?.trim() || null;
      const grade = row.grade?.trim() || null;

      const existing = await db.select().from(tribeUsersTable)
        .where(eq(tribeUsersTable.name, fullName));

      if (existing.length > 0) {
        const u = existing[0];
        if (!u.active || u.role !== role || u.battalion !== battalion || u.team !== team || u.grade !== grade) {
          await db.update(tribeUsersTable)
            .set({ role, battalion, team, grade, active: true })
            .where(eq(tribeUsersTable.id, u.id));
          updated++;
        } else {
          skipped++;
        }
      } else {
        const scoutMatches = await db.select().from(scoutsTable)
          .where(eq(scoutsTable.name, row.name.trim()));
        const scoutId = scoutMatches.length === 1 ? scoutMatches[0].id : null;

        await db.insert(tribeUsersTable).values({
          name: fullName,
          role,
          battalion,
          team,
          grade,
          scoutId,
          active: true,
        });
        created++;
      }
    }

    res.json({ success: true, created, updated, skipped, cleared, total: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "שגיאה בייבוא שיבוצים" });
  }
});

// Rename a battalion across scouts + tribe_users
router.post("/users/rename-battalion", async (req, res) => {
  try {
    const { oldName, newName } = req.body as { oldName?: string; newName?: string };
    if (!oldName || !newName) return res.status(400).json({ error: "oldName ו-newName חובה" });

    const scoutsUpdated = await db.update(scoutsTable)
      .set({ battalion: newName })
      .where(eq(scoutsTable.battalion, oldName))
      .returning({ id: scoutsTable.id });

    const usersUpdated = await db.update(tribeUsersTable)
      .set({ battalion: newName })
      .where(eq(tribeUsersTable.battalion, oldName))
      .returning({ id: tribeUsersTable.id });

    res.json({ success: true, scoutsUpdated: scoutsUpdated.length, usersUpdated: usersUpdated.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "שגיאה בשינוי שם גדוד" });
  }
});

export default router;
