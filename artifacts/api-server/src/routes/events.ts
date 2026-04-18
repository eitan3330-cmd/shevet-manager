import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, eventsTable } from "@workspace/db";
import {
  CreateEventBody,
  UpdateEventBody,
  GetEventParams,
  UpdateEventParams,
  DeleteEventParams,
  ListEventsQueryParams,
  ListEventsResponse,
  GetEventResponse,
  UpdateEventResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/events", async (req, res): Promise<void> => {
  const query = ListEventsQueryParams.safeParse(req.query);
  let events = await db.select().from(eventsTable).orderBy(eventsTable.createdAt);

  if (query.success && query.data.category) {
    events = events.filter(e => e.category === query.data.category);
  }
  if (query.success && query.data.status) {
    events = events.filter(e => e.status === query.data.status);
  }

  res.json(ListEventsResponse.parse(events.map(e => ({
    ...e,
    budgetAllocated: e.budgetAllocated ? parseFloat(e.budgetAllocated) : null,
    actualCost: (e as any).actualCost ? parseFloat((e as any).actualCost) : null,
  }))));
});

router.post("/events", async (req, res): Promise<void> => {
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [event] = await db.insert(eventsTable).values({
    ...parsed.data,
    budgetAllocated: parsed.data.budgetAllocated != null ? String(parsed.data.budgetAllocated) : null,
    actualCost: (parsed.data as any).actualCost != null ? String((parsed.data as any).actualCost) : null,
  }).returning();
  res.status(201).json(GetEventResponse.parse({
    ...event,
    budgetAllocated: event.budgetAllocated ? parseFloat(event.budgetAllocated) : null,
    actualCost: (event as any).actualCost ? parseFloat((event as any).actualCost) : null,
  }));
});

router.get("/events/:id", async (req, res): Promise<void> => {
  const params = GetEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, params.data.id));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  res.json(GetEventResponse.parse({
    ...event,
    budgetAllocated: event.budgetAllocated ? parseFloat(event.budgetAllocated) : null,
    actualCost: (event as any).actualCost ? parseFloat((event as any).actualCost) : null,
  }));
});

router.patch("/events/:id", async (req, res): Promise<void> => {
  const params = UpdateEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const numericFields = ["budgetAllocated", "actualCost"];
  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== null && v !== undefined) {
      updateData[k] = numericFields.includes(k) ? String(v) : v;
    }
  }
  const [event] = await db.update(eventsTable).set(updateData).where(eq(eventsTable.id, params.data.id)).returning();
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  res.json(UpdateEventResponse.parse({
    ...event,
    budgetAllocated: event.budgetAllocated ? parseFloat(event.budgetAllocated) : null,
    actualCost: (event as any).actualCost ? parseFloat((event as any).actualCost) : null,
  }));
});

router.delete("/events/:id", async (req, res): Promise<void> => {
  const params = DeleteEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [event] = await db.delete(eventsTable).where(eq(eventsTable.id, params.data.id)).returning();
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
