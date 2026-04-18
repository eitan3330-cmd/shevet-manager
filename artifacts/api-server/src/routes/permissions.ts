import { Router } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { db, permissionsTable } from "@workspace/db";

const ROLES = ["marcaz_tzair", "roshatz", "roshgad"];
const SECTIONS = ["hadracha", "logistics"];

const SECTION_FEATURES: Record<string, string[]> = {
  hadracha: ["scouts", "attendance", "activities"],
  logistics: ["events", "budget", "procurement"],
};

async function seedDefaultPermissions() {
  const existing = await db.select().from(permissionsTable);
  if (existing.length > 0) return;

  const defaults: any[] = [];
  for (const role of ROLES) {
    for (const section of SECTIONS) {
      defaults.push({ role, section, feature: null, canAccess: true });
      for (const feature of SECTION_FEATURES[section] || []) {
        defaults.push({ role, section, feature, canAccess: true });
      }
    }
  }
  await db.insert(permissionsTable).values(defaults);
}

const router = Router();

router.get("/permissions", async (req, res) => {
  await seedDefaultPermissions();
  const perms = await db.select().from(permissionsTable).orderBy(permissionsTable.role);
  res.json(perms);
});

router.post("/permissions", async (req, res) => {
  const { role, section, feature, canAccess } = req.body;
  if (!role || !section || typeof canAccess !== "boolean") return res.status(400).json({ error: "role, section, canAccess חובה" });

  const existing = await db.select().from(permissionsTable)
    .where(and(eq(permissionsTable.role, role), eq(permissionsTable.section, section)));

  const targetFeature = feature || null;
  const match = existing.find(p => p.feature === targetFeature);

  if (match) {
    await db.update(permissionsTable).set({ canAccess }).where(eq(permissionsTable.id, match.id));
  } else {
    await db.insert(permissionsTable).values({ role, section, feature: targetFeature, canAccess });
  }

  const updated = await db.select().from(permissionsTable).orderBy(permissionsTable.role);
  res.json(updated);
});

export default router;
