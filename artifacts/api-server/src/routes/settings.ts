import { Router } from "express";
import { db } from "@workspace/db";
import { appSettingsTable } from "@workspace/db";

const router = Router();

const SETTING_KEYS = ["planningLocked", "executionLocked"];

router.get("/settings", async (_req, res) => {
  try {
    const rows = await db.select().from(appSettingsTable);
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    res.json(result);
  } catch {
    res.status(500).json({ error: "שגיאה בטעינת הגדרות" });
  }
});

router.post("/settings", async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || !SETTING_KEYS.includes(key)) {
      return res.status(400).json({ error: "מפתח לא חוקי" });
    }
    await db.insert(appSettingsTable)
      .values({ key, value: String(value) })
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: String(value), updatedAt: new Date() } });
    res.json({ success: true, key, value });
  } catch {
    res.status(500).json({ error: "שגיאה בשמירת הגדרה" });
  }
});

export default router;
