import { Router, type IRouter } from "express";
import { db, scoutsTable, eventsTable, attendanceTable, budgetTable, procurementTable } from "@workspace/db";
import {
  GetDashboardStatsResponse,
  GetBudgetSummaryResponse,
  GetAttendanceSummaryResponse,
} from "@workspace/api-zod";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/stats/dashboard", async (req, res): Promise<void> => {
  const scouts = await db.select().from(scoutsTable);
  const events = await db.select().from(eventsTable);
  const budgetItems = await db.select().from(budgetTable);
  const procOrders = await db.select().from(procurementTable);

  const totalBudget = budgetItems
    .filter(i => i.type === "income")
    .reduce((s, i) => s + parseFloat(i.amount ?? "0"), 0);

  const totalExpenses = budgetItems
    .filter(i => i.type === "expense")
    .reduce((s, i) => s + parseFloat(i.amount ?? "0"), 0);

  const upcomingEvents = events.filter(e => e.status === "upcoming").length;
  const pendingOrders = procOrders.filter(o => o.status === "pending").length;

  const recentActivity = [
    ...events.slice(-3).map(e => ({
      type: "event",
      message: `מפעל "${e.name}" נוסף`,
      timestamp: e.createdAt.toISOString(),
    })),
    ...scouts.slice(-2).map(s => ({
      type: "scout",
      message: `חניך "${s.name}" נוסף`,
      timestamp: s.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);

  res.json(GetDashboardStatsResponse.parse({
    totalScouts: scouts.length,
    totalEvents: events.length,
    upcomingEvents,
    totalBudget,
    totalExpenses,
    pendingOrders,
    recentActivity,
  }));
});

router.get("/stats/budget-summary", async (req, res): Promise<void> => {
  const items = await db.select().from(budgetTable);

  const totalIncome = items.filter(i => i.type === "income").reduce((s, i) => s + parseFloat(i.amount ?? "0"), 0);
  const totalExpenses = items.filter(i => i.type === "expense").reduce((s, i) => s + parseFloat(i.amount ?? "0"), 0);

  const categoryMap: Record<string, number> = {};
  for (const item of items) {
    const cat = item.category ?? "אחר";
    categoryMap[cat] = (categoryMap[cat] ?? 0) + parseFloat(item.amount ?? "0");
  }

  const byCategory = Object.entries(categoryMap).map(([category, amount]) => ({ category, amount }));

  res.json(GetBudgetSummaryResponse.parse({
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    byCategory,
  }));
});

router.get("/stats/attendance-summary", async (req, res): Promise<void> => {
  const events = await db.select().from(eventsTable);
  const allAttendance = await db.select().from(attendanceTable);

  const summary = events.map(event => {
    const records = allAttendance.filter(a => a.eventId === event.id);
    return {
      eventId: event.id,
      eventName: event.name,
      totalRegistered: records.length,
      present: records.filter(r => r.status === "present").length,
      absent: records.filter(r => r.status === "absent").length,
      late: records.filter(r => r.status === "late").length,
      excused: records.filter(r => r.status === "excused").length,
    };
  });

  res.json(GetAttendanceSummaryResponse.parse(summary));
});

export default router;
