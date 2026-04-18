import { Router } from "express";
import { db } from "@workspace/db";
import { activitiesTable, activityTracksTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/activity-tracks", async (req, res) => {
  const tracks = await db.select().from(activityTracksTable).orderBy(desc(activityTracksTable.createdAt));
  res.json(tracks);
});

router.post("/activity-tracks", async (req, res) => {
  const { title, description, gradeLevel, createdBy, status } = req.body;
  if (!title) return res.status(400).json({ error: "כותרת חובה" });
  const [track] = await db.insert(activityTracksTable).values({
    title, description: description || null, gradeLevel: gradeLevel || null,
    createdBy: createdBy || null, status: status || "active",
  }).returning();
  res.status(201).json(track);
});

router.put("/activity-tracks/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { title, description, gradeLevel, status } = req.body;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (gradeLevel !== undefined) updates.gradeLevel = gradeLevel;
  if (status !== undefined) updates.status = status;
  const [track] = await db.update(activityTracksTable).set(updates).where(eq(activityTracksTable.id, id)).returning();
  res.json(track);
});

router.delete("/activity-tracks/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.update(activitiesTable).set({ trackId: null }).where(eq(activitiesTable.trackId, id));
  await db.delete(activityTracksTable).where(eq(activityTracksTable.id, id));
  res.sendStatus(204);
});

router.get("/activities", async (req, res) => {
  const activities = await db.select().from(activitiesTable).orderBy(desc(activitiesTable.createdAt));
  res.json(activities);
});

router.get("/activities/:id", async (req, res) => {
  const [activity] = await db.select().from(activitiesTable).where(eq(activitiesTable.id, parseInt(req.params.id)));
  if (!activity) return res.status(404).json({ error: "לא נמצא" });
  res.json(activity);
});

router.post("/activities", async (req, res) => {
  const {
    title, date, gradeLevel, activityType, description, goals, materials, duration,
    submittedBy, assignedTo, assignedBy, fileUrl, fileName, fileData, trackId,
  } = req.body;
  if (!title) return res.status(400).json({ error: "כותרת חובה" });
  const [activity] = await db.insert(activitiesTable).values({
    title, gradeLevel, activityType: activityType || "peula",
    description, goals, materials, duration, submittedBy,
    assignedTo: assignedTo || null,
    assignedBy: assignedBy || null,
    fileUrl: fileUrl || null, fileName: fileName || null, fileData: fileData || null,
    date: date ? new Date(date) : null,
    trackId: trackId || null,
    status: "draft",
  }).returning();
  res.status(201).json(activity);
});

router.put("/activities/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const {
    title, date, gradeLevel, activityType, description, goals, materials, duration,
    status, feedback, feedbackBy, feedbackAt, submittedBy,
    assignedTo, assignedBy, reviewedBy, reviewedAt, reviewNotes,
    fileUrl, fileName, fileData, trackId,
  } = req.body;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (title !== undefined) updates.title = title;
  if (gradeLevel !== undefined) updates.gradeLevel = gradeLevel;
  if (activityType !== undefined) updates.activityType = activityType;
  if (description !== undefined) updates.description = description;
  if (goals !== undefined) updates.goals = goals;
  if (materials !== undefined) updates.materials = materials;
  if (duration !== undefined) updates.duration = duration;
  if (status !== undefined) updates.status = status;
  if (feedback !== undefined) updates.feedback = feedback;
  if (feedbackBy !== undefined) updates.feedbackBy = feedbackBy;
  if (feedbackAt !== undefined) updates.feedbackAt = feedbackAt ? new Date(feedbackAt) : null;
  if (submittedBy !== undefined) updates.submittedBy = submittedBy;
  if (assignedTo !== undefined) updates.assignedTo = assignedTo;
  if (assignedBy !== undefined) updates.assignedBy = assignedBy;
  if (reviewedBy !== undefined) updates.reviewedBy = reviewedBy;
  if (reviewedAt !== undefined) updates.reviewedAt = reviewedAt ? new Date(reviewedAt) : null;
  if (reviewNotes !== undefined) updates.reviewNotes = reviewNotes;
  if (fileUrl !== undefined) updates.fileUrl = fileUrl;
  if (fileName !== undefined) updates.fileName = fileName;
  if (fileData !== undefined) updates.fileData = fileData;
  if (date !== undefined) updates.date = date ? new Date(date) : null;
  if (trackId !== undefined) updates.trackId = trackId;

  const [activity] = await db.update(activitiesTable).set(updates).where(eq(activitiesTable.id, id)).returning();
  res.json(activity);
});

router.delete("/activities/:id", async (req, res) => {
  await db.delete(activitiesTable).where(eq(activitiesTable.id, parseInt(req.params.id)));
  res.sendStatus(204);
});

export default router;
