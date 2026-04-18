import { Router } from "express";
import { eq, asc } from "drizzle-orm";
import { db, scoutsTable } from "@workspace/db";

const router = Router();

router.get("/scouts", async (req, res) => {
  const { gizra, role, battalion, instructorName } = req.query as Record<string, string>;
  let scouts = await db.select().from(scoutsTable).orderBy(asc(scoutsTable.name));
  if (gizra) scouts = scouts.filter(s => s.gizra === gizra);
  if (role) scouts = scouts.filter(s => s.role === role);
  if (battalion) scouts = scouts.filter(s => s.battalion === battalion);
  if (instructorName) scouts = scouts.filter(s => s.instructorName === instructorName);
  res.json(scouts);
});

router.post("/scouts", async (req, res) => {
  const { name, lastName, phone, parentPhone, battalion, instructorName, grade, gradeLevel, tribeRole, role, birthDate, foodPreferences, medicalIssues, notes } = req.body;
  if (!name) return res.status(400).json({ error: "שם חובה" });
  const [scout] = await db.insert(scoutsTable).values({
    name, lastName: lastName || null, phone: phone || null, parentPhone: parentPhone || null,
    gizra: null, battalion: battalion || null, instructorName: instructorName || null,
    grade: grade || null, gradeLevel: gradeLevel || null, tribeRole: tribeRole || null,
    role: role || "chanich", birthDate: birthDate || null, foodPreferences: foodPreferences || null,
    medicalIssues: medicalIssues || null, notes: notes || null,
  }).returning();
  res.status(201).json(scout);
});

router.get("/scouts/:id", async (req, res) => {
  const [scout] = await db.select().from(scoutsTable).where(eq(scoutsTable.id, parseInt(req.params.id)));
  if (!scout) return res.status(404).json({ error: "לא נמצא" });
  res.json(scout);
});

router.patch("/scouts/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, lastName, phone, parentPhone, gizra, battalion, instructorName, grade, gradeLevel, tribeRole, role, birthDate, foodPreferences, medicalIssues, notes } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (lastName !== undefined) updates.lastName = lastName;
  if (phone !== undefined) updates.phone = phone;
  if (parentPhone !== undefined) updates.parentPhone = parentPhone;
  if (gizra !== undefined) updates.gizra = gizra;
  if (battalion !== undefined) updates.battalion = battalion;
  if (instructorName !== undefined) updates.instructorName = instructorName;
  if (grade !== undefined) updates.grade = grade;
  if (gradeLevel !== undefined) updates.gradeLevel = gradeLevel;
  if (tribeRole !== undefined) updates.tribeRole = tribeRole;
  if (role !== undefined) updates.role = role;
  if (birthDate !== undefined) updates.birthDate = birthDate;
  if (foodPreferences !== undefined) updates.foodPreferences = foodPreferences;
  if (medicalIssues !== undefined) updates.medicalIssues = medicalIssues;
  if (notes !== undefined) updates.notes = notes;
  const [scout] = await db.update(scoutsTable).set(updates).where(eq(scoutsTable.id, id)).returning();
  if (!scout) return res.status(404).json({ error: "לא נמצא" });
  res.json(scout);
});

router.delete("/scouts/:id", async (req, res) => {
  await db.delete(scoutsTable).where(eq(scoutsTable.id, parseInt(req.params.id)));
  res.sendStatus(204);
});

router.post("/scouts/import-bulk", async (req, res) => {
  const { rows } = req.body as { rows: any[] };
  if (!Array.isArray(rows)) return res.status(400).json({ error: "rows חסר" });

  const existing = await db.select().from(scoutsTable);
  let added = 0, updated = 0, skipped = 0;
  const seenPhones = new Set<string>();
  const seenNames = new Set<string>();

  for (const row of rows) {
    if (!row.name) { skipped++; continue; }

    const nameKey = `${row.name}|${row.lastName || ""}`;
    if (row.phone && seenPhones.has(row.phone)) { skipped++; continue; }
    if (!row.phone && seenNames.has(nameKey)) { skipped++; continue; }
    if (row.phone) seenPhones.add(row.phone);
    seenNames.add(nameKey);

    const match = existing.find(s =>
      (row.phone && s.phone && s.phone === row.phone) ||
      (s.name === row.name && (s.lastName || "") === (row.lastName || ""))
    );

    const gradeLevel = row.grade ? ({ "ד": "חניכים", "ה": "חניכים", "ו": "חניכים", "ז": "חניכים בכירים", "ח": "חניכים בכירים", "ט": "שכבה ט", "י": "פעילים", "יא": "פעילים", "יב": "פעילים" }[row.grade] || null) : null;

    const payload = {
      name: row.name, lastName: row.lastName || null, phone: row.phone || null,
      gizra: row.gizra || "", battalion: row.battalion || null, instructorName: row.instructorName || null,
      grade: row.grade || null, gradeLevel, role: "chanich",
      school: row.school || null,
      foodPreferences: row.foodPreferences || null, medicalIssues: row.medicalIssues || null, notes: row.notes || null,
    };

    try {
      if (match) {
        await db.update(scoutsTable).set(payload).where(eq(scoutsTable.id, match.id));
        updated++;
      } else {
        await db.insert(scoutsTable).values({ ...payload, parentPhone: null, tribeRole: null });
        added++;
      }
    } catch (err) {
      console.error(`Failed to import scout ${row.name} ${row.lastName || ""}:`, err);
      skipped++;
    }
  }

  res.json({ added, updated, skipped });
});

/**
 * POST /api/scouts/merge-details
 * Updates only specific detail fields (foodPreferences, medicalIssues, notes, phone, birthDate)
 * on EXISTING scouts matched by name. Never creates new scouts.
 * Tries: exact name+lastName match → first-name-only match → skip.
 */
router.post("/scouts/merge-details", async (req, res) => {
  const { rows } = req.body as { rows: any[] };
  if (!Array.isArray(rows)) return res.status(400).json({ error: "rows חסר" });

  const existing = await db.select().from(scoutsTable);

  function normalize(s: string | null | undefined) {
    return (s || "").trim().replace(/\s+/g, " ").toLowerCase();
  }

  let updated = 0, notFound = 0;
  const updatedNames: string[] = [];
  const notFoundNames: string[] = [];

  for (const row of rows) {
    if (!row.name) continue;

    const rowFirstName = normalize(row.name);
    const rowLastName = normalize(row.lastName);

    // 1. Exact first+last match
    let match = existing.find(s =>
      normalize(s.name) === rowFirstName && normalize(s.lastName) === rowLastName
    );

    // 2. First-name only match (if last name not provided in file)
    if (!match && !rowLastName) {
      const candidates = existing.filter(s => normalize(s.name) === rowFirstName);
      if (candidates.length === 1) match = candidates[0];
    }

    // 3. Full name in single field (e.g. "דוד כהן" matched against name+lastName)
    if (!match && row.name.includes(" ")) {
      const parts = row.name.trim().split(/\s+/);
      const fn = normalize(parts[0]);
      const ln = normalize(parts.slice(1).join(" "));
      match = existing.find(s => normalize(s.name) === fn && normalize(s.lastName) === ln);
    }

    if (!match) {
      notFound++;
      notFoundNames.push([row.name, row.lastName].filter(Boolean).join(" "));
      continue;
    }

    // Build partial update — only override non-empty values
    const updates: Record<string, unknown> = {};
    if (row.foodPreferences !== undefined && row.foodPreferences !== "") updates.foodPreferences = row.foodPreferences;
    if (row.medicalIssues !== undefined && row.medicalIssues !== "") updates.medicalIssues = row.medicalIssues;
    if (row.notes !== undefined && row.notes !== "") updates.notes = row.notes;
    if (row.phone !== undefined && row.phone !== "") updates.phone = row.phone;
    if (row.parentPhone !== undefined && row.parentPhone !== "") updates.parentPhone = row.parentPhone;
    if (row.birthDate !== undefined && row.birthDate !== "") updates.birthDate = row.birthDate;
    if (row.grade !== undefined && row.grade !== "") updates.grade = row.grade;
    if (row.battalion !== undefined && row.battalion !== "") updates.battalion = row.battalion;
    if (row.instructorName !== undefined && row.instructorName !== "") updates.instructorName = row.instructorName;
    if (row.school !== undefined && row.school !== "") updates.school = row.school;

    if (Object.keys(updates).length > 0) {
      await db.update(scoutsTable).set(updates).where(eq(scoutsTable.id, match.id));
      updated++;
      updatedNames.push(`${match.name} ${match.lastName || ""}`.trim());
    }
  }

  res.json({ updated, notFound, notFoundNames: notFoundNames.slice(0, 20) });
});

export default router;
