import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check, X, Minus, Search, Users, Plus, ChevronRight,
  ClipboardList, Lock, Unlock, UserCheck, BarChart2, Flag, GraduationCap, Download, Trash2, Clock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useAppSettings } from "@/lib/api-hooks";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const STATUS_MAP = {
  present: { label: "נוכח", activeColor: "bg-green-500 text-white border-green-500", color: "text-green-600 border-green-200 hover:bg-green-50", icon: Check },
  absent: { label: "נעדר", activeColor: "bg-red-500 text-white border-red-500", color: "text-red-600 border-red-200 hover:bg-red-50", icon: X },
};

const ROLE_LABELS: Record<string, string> = {
  marcaz_boger: "מרכז בוגר",
  marcaz_tzair: "מרכז צעיר",
  roshatz: "ראשצ",
  roshgad: "ראשגד",
  madrich: "מדריך",
  pael: "פעיל",
};

type Session = {
  id: number;
  title: string;
  date: string;
  type: string;
  battalion?: string;
  gradeLevel?: string;
  notes?: string;
  createdBy?: string;
  isLocked: boolean;
  scoutCount?: number;
  scoutTotal?: number;
  staffCount?: number;
  staffTotal?: number;
};

type AttendanceRecord = {
  id: number;
  scoutId: number;
  scoutName: string;
  scoutLastName?: string;
  grade?: string;
  battalion?: string;
  instructorName?: string;
  status: string;
  notes?: string;
};

type StaffRecord = {
  id: number;
  userId: number;
  userName?: string;
  userRole?: string;
  status: string;
  notes?: string;
};

type TribeUser = {
  id: number;
  name: string;
  role: string;
  active: boolean;
  battalion?: string;
};

type ReportRecord = {
  id: number;
  scoutId: number | null;
  sessionId: number | null;
  status: string;
  scoutName: string | null;
  scoutLastName: string | null;
  grade: string | null;
  battalion: string | null;
  sessionTitle: string | null;
  sessionDate: string | null;
  sessionBattalion: string | null;
  sessionGradeLevel: string | null;
};

function rateColor(rate: number) {
  if (rate >= 0.8) return "text-green-600";
  if (rate >= 0.6) return "text-amber-600";
  return "text-red-600";
}

function rateBg(rate: number) {
  if (rate >= 0.8) return "bg-green-50 border-green-200";
  if (rate >= 0.6) return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}

function RateBar({ rate }: { rate: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-muted rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${rate >= 0.8 ? "bg-green-500" : rate >= 0.6 ? "bg-amber-500" : "bg-red-500"}`}
          style={{ width: `${Math.round(rate * 100)}%` }}
        />
      </div>
      <span className={`text-xs font-semibold w-10 text-left ${rateColor(rate)}`}>{Math.round(rate * 100)}%</span>
    </div>
  );
}

function exportCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (v: string | number | null | undefined) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const content = [headers, ...rows].map(r => r.map(escape).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function periodDateRange(period: string, customFrom: string, customTo: string): { from: Date | null; to: Date | null } {
  const now = new Date();
  if (period === "week") {
    const from = new Date(now); from.setDate(from.getDate() - 7);
    return { from, to: now };
  }
  if (period === "month") {
    const from = new Date(now); from.setDate(from.getDate() - 30);
    return { from, to: now };
  }
  if (period === "custom") {
    return {
      from: customFrom ? new Date(customFrom) : null,
      to: customTo ? new Date(customTo) : null,
    };
  }
  return { from: null, to: null };
}

function ActivityList({ onSelect }: { onSelect: (s: Session) => void }) {
  const [newOpen, setNewOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { role } = useAuth();

  const myBattalion = user?.battalion || null;
  const isMadrich = role === "madrich";
  const isRoshgad = role === "roshgad";
  const isMarcazTzair = role === "marcaz_tzair";
  const isMarcazBoger = role === "marcaz_boger";
  const canCreate = ["marcaz_boger", "marcaz_tzair", "roshgad", "madrich"].includes(role || "");
  const canManageAll = isMarcazBoger || isMarcazTzair;
  const canDelete = canManageAll || isRoshgad;

  const [form, setForm] = useState({
    title: "",
    date: new Date().toISOString().split("T")[0],
    time: "",
  });

  const { data: sessions = [], isLoading } = useQuery<Session[]>({
    queryKey: ["attendance-sessions"],
    queryFn: () => fetch(`${API_BASE}/api/attendance-sessions`).then(r => r.json()),
  });

  const createSession = useMutation({
    mutationFn: (data: any) => fetch(`${API_BASE}/api/attendance-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-User-Role": role || "" },
      body: JSON.stringify({ ...data, createdBy: user?.name }),
    }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-sessions"] });
      setNewOpen(false);
      setForm({ title: "", date: new Date().toISOString().split("T")[0], time: "" });
      toast({ title: "הפעולה נוצרה" });
    },
  });

  const deleteSession = useMutation({
    mutationFn: (id: number) => fetch(`${API_BASE}/api/attendance-sessions/${id}`, {
      method: "DELETE",
      headers: { "X-User-Role": role || "" },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-sessions"] });
      toast({ title: "הפעולה נמחקה" });
    },
  });

  const lockSession = useMutation({
    mutationFn: ({ id, isLocked }: { id: number; isLocked: boolean }) =>
      fetch(`${API_BASE}/api/attendance-sessions/${id}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Role": role || "" },
        body: JSON.stringify({ isLocked }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-sessions"] });
    },
  });

  const allSessionsRaw = Array.isArray(sessions) ? sessions : [];

  const visibleSessions = allSessionsRaw.filter(s => {
    if (isMadrich && myBattalion) {
      if (s.battalion && s.battalion !== myBattalion) return false;
    }
    if (isRoshgad && myBattalion) {
      if (s.battalion && s.battalion !== myBattalion) return false;
    }
    return true;
  });

  const handleCreate = () => {
    let dateStr = form.date;
    if (form.time) {
      dateStr = `${form.date}T${form.time}`;
    }
    createSession.mutate({
      title: form.title,
      date: dateStr,
      type: "regular",
      battalion: (isMadrich || isRoshgad) ? (myBattalion || "") : "",
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold">פעולות</h2>
          <p className="text-muted-foreground">רישום נוכחות לפעולות</p>
        </div>
        {canCreate && (
          <Button onClick={() => setNewOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> פעולה חדשה
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="border rounded-xl overflow-hidden bg-card divide-y divide-border/40">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="w-10 h-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64" />
              </div>
            </div>
          ))}
        </div>
      ) : visibleSessions.length === 0 ? (
        <div className="text-center py-20 border rounded-xl text-muted-foreground">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{canCreate ? "אין פעולות עדיין — צור פעולה ראשונה" : "אין פעולות פתוחות"}</p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden divide-y divide-border/40 bg-card">
          {visibleSessions.map(s => (
            <div key={s.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/10 transition-colors group ${s.isLocked ? "opacity-70" : ""}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${s.isLocked ? "bg-muted" : "bg-primary/10"}`}>
                {s.isLocked ? <Lock className="w-4 h-4 text-muted-foreground" /> : <ClipboardList className="w-5 h-5 text-primary" />}
              </div>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelect(s)}>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{s.title}</p>
                  {s.isLocked && (
                    <span className="text-xs bg-muted text-muted-foreground rounded px-1.5 py-0.5">נעול</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(s.date).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}
                  {s.date.includes("T") && !s.date.endsWith("T00:00:00") && (
                    <> · {new Date(s.date).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</>
                  )}
                  {s.battalion && ` · ${s.battalion}`}
                </p>
                {(s.scoutTotal !== undefined && s.scoutTotal > 0) && (
                  <p className="text-xs text-green-600 mt-0.5">
                    {s.scoutCount}/{s.scoutTotal} חניכים נוכחים
                    {s.staffTotal !== undefined && s.staffTotal > 0 && ` · ${s.staffCount}/${s.staffTotal} צוות`}
                  </p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground cursor-pointer opacity-0 group-hover:opacity-100" onClick={() => onSelect(s)} />
              {canManageAll && (
                <button
                  onClick={() => lockSession.mutate({ id: s.id, isLocked: !s.isLocked })}
                  title={s.isLocked ? "פתח פעולה" : "נעל פעולה"}
                  className="w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                  {s.isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => { if (confirm("למחוק פעולה זו?")) deleteSession.mutate(s.id); }}
                  className="w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>פעולה חדשה</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">שם הפעולה</label>
              <Input placeholder="למשל: פעולת שישי" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">תאריך</label>
                <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">שעה (אופציונלי)</label>
                <Input type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} />
              </div>
            </div>
            <Button className="w-full" onClick={handleCreate} disabled={!form.title || !form.date || createSession.isPending}>
              צור פעולה
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MarkingPage({
  session,
  onBack,
}: {
  session: Session;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"scouts" | "staff">("scouts");
  const [search, setSearch] = useState("");
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const isMadrich = role === "madrich";
  const isRoshgad = role === "roshgad";
  const isMarcazTzair = role === "marcaz_tzair";
  const isMarcazBoger = role === "marcaz_boger";
  const canLock = isMarcazBoger || isMarcazTzair;
  const myBattalion = user?.battalion || null;

  const { data: scouts = [] } = useQuery<any[]>({
    queryKey: ["scouts-raw"],
    queryFn: () => fetch(`${API_BASE}/api/scouts`).then(r => r.json()),
  });

  const { data: tribeUsers = [] } = useQuery<TribeUser[]>({
    queryKey: ["tribe-users"],
    queryFn: () => fetch(`${API_BASE}/api/users`).then(r => r.json()),
  });

  const { data: sessionData, isLoading } = useQuery<{ session: Session; records: AttendanceRecord[]; staffRecords: StaffRecord[] }>({
    queryKey: ["attendance-session-detail", session.id],
    queryFn: () => fetch(`${API_BASE}/api/attendance-sessions/${session.id}`).then(r => r.json()),
  });

  const currentSession = sessionData?.session || session;
  const records = sessionData?.records || [];
  const staffRecords = sessionData?.staffRecords || [];

  const markAttendance = useMutation({
    mutationFn: ({ scoutId, status }: { scoutId: number; status: string }) =>
      fetch(`${API_BASE}/api/attendance-sessions/${session.id}/mark`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Role": role || "" },
        body: JSON.stringify({ scoutId, status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance-session-detail", session.id] }),
    onError: () => toast({ title: "שגיאה בסימון", variant: "destructive" }),
  });

  const markStaff = useMutation({
    mutationFn: ({ userId, status }: { userId: number; status: string }) =>
      fetch(`${API_BASE}/api/attendance-sessions/${session.id}/mark-staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Role": role || "" },
        body: JSON.stringify({ userId, status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance-session-detail", session.id] }),
    onError: () => toast({ title: "שגיאה בסימון", variant: "destructive" }),
  });

  const getScoutStatus = (id: number) => records.find(r => r.scoutId === id)?.status || null;
  const getStaffStatus = (id: number) => staffRecords.find(r => r.userId === id)?.status || null;

  const filtered = scouts.filter((s: any) => {
    const name = `${s.name} ${s.lastName || ""}`;
    const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase());

    if (isMadrich && myBattalion) {
      return matchSearch && s.battalion === myBattalion;
    }
    if (isRoshgad && myBattalion) {
      return matchSearch && s.battalion === myBattalion;
    }
    if (isMarcazTzair) {
      if (currentSession.gradeLevel) {
        return matchSearch && s.grade === currentSession.gradeLevel;
      }
      return matchSearch;
    }
    return matchSearch;
  });

  const filteredStaff = tribeUsers.filter(u => {
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase());
    if (isRoshgad && myBattalion) {
      return matchSearch && u.battalion === myBattalion;
    }
    return matchSearch;
  });

  const stats = {
    present: filtered.filter((s: any) => getScoutStatus(s.id) === "present").length,
    absent: filtered.filter((s: any) => getScoutStatus(s.id) === "absent").length,
    unmarked: filtered.filter((s: any) => !getScoutStatus(s.id)).length,
  };

  const staffStats = {
    present: filteredStaff.filter(u => getStaffStatus(u.id) === "present").length,
    absent: filteredStaff.filter(u => getStaffStatus(u.id) === "absent").length,
    unmarked: filteredStaff.filter(u => !getStaffStatus(u.id)).length,
  };

  const handleExportCSV = () => {
    const rows = filtered.map((s: any) => [
      `${s.name}${s.lastName ? " " + s.lastName : ""}`,
      s.grade || "",
      s.battalion || "",
      s.instructorName || "",
      STATUS_MAP[getScoutStatus(s.id) as keyof typeof STATUS_MAP]?.label || "לא סומן",
    ]);
    exportCSV(
      `נוכחות-${session.title}-${session.date.split("T")[0]}.csv`,
      ["שם", "כיתה", "גדוד", "מדריך", "סטטוס"],
      rows,
    );
    toast({ title: "הקובץ הורד בהצלחה" });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm transition-colors shrink-0">
          <ChevronRight className="w-4 h-4 rotate-180" />
          חזרה
        </button>
        <div className="h-4 w-px bg-border shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold leading-tight">{session.title}</h2>
            {currentSession.isLocked && (
              <span className="flex items-center gap-1 text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                <Lock className="w-3 h-3" /> נעול
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            {new Date(session.date).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}
            {session.date.includes("T") && !session.date.endsWith("T00:00:00") && (
              <> · {new Date(session.date).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</>
            )}
            {session.battalion && ` · ${session.battalion}`}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={handleExportCSV} className="gap-1.5 shrink-0">
          <Download className="w-3.5 h-3.5" /> ייצוא CSV
        </Button>
      </div>

      <div className="flex gap-1 border-b">
        <button
          onClick={() => { setActiveTab("scouts"); setSearch(""); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === "scouts" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <Users className="w-4 h-4" /> חניכים
        </button>
        <button
          onClick={() => { setActiveTab("staff"); setSearch(""); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === "staff" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <UserCheck className="w-4 h-4" /> צוות
        </button>
      </div>

      {activeTab === "scouts" && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "נוכחים", value: stats.present, color: "text-green-600" },
              { label: "נעדרים", value: stats.absent, color: "text-red-600" },
              { label: "לא סומן", value: stats.unmarked, color: "text-muted-foreground" },
            ].map(s => (
              <div key={s.label} className="border rounded-xl p-3 text-center bg-card">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          {filtered.length > 0 && (
            <div className="bg-muted/30 border rounded-xl p-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>כולל {filtered.length} חניכים</span>
                <span className="font-semibold text-green-600">{stats.present} נוכחים</span>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                <div className="bg-green-500 transition-all" style={{ width: `${(stats.present / filtered.length) * 100}%` }} />
                <div className="bg-red-500 transition-all" style={{ width: `${(stats.absent / filtered.length) * 100}%` }} />
              </div>
            </div>
          )}

          <div className="relative">
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input className="pr-9 h-9" placeholder="חיפוש חניך..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {isLoading ? (
            <div className="border rounded-xl overflow-hidden bg-card divide-y divide-border/40">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border rounded-xl">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">לא נמצאו חניכים</p>
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden bg-card">
              <div className="divide-y divide-border/40">
                {filtered.map((scout: any) => {
                  const status = getScoutStatus(scout.id);
                  return (
                    <div key={scout.id}
                      className={`flex items-center justify-between px-4 py-3 transition-colors ${status === "present" ? "bg-green-50/40" : status === "absent" ? "bg-red-50/40" : status === "late" ? "bg-amber-50/40" : "hover:bg-muted/10"}`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{scout.name}{scout.lastName ? ` ${scout.lastName}` : ""}</p>
                        <p className="text-xs text-muted-foreground flex gap-2">
                          {scout.grade && <span>כיתה {scout.grade}</span>}
                          {scout.battalion && <span>• {scout.battalion}</span>}
                          {scout.instructorName && <span>• {scout.instructorName}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {Object.entries(STATUS_MAP).map(([key, cfg]) => {
                          const Icon = cfg.icon;
                          const isActive = status === key;
                          return (
                            <button key={key}
                              disabled={currentSession.isLocked}
                              onClick={() => markAttendance.mutate({ scoutId: scout.id, status: isActive ? "clear" : key })}
                              className={`h-9 px-3 rounded-lg border text-sm font-medium flex items-center gap-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${isActive ? cfg.activeColor : cfg.color + " bg-transparent"}`}>
                              <Icon className="w-4 h-4" />
                              <span className="hidden sm:inline">{cfg.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "staff" && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "נוכחים", value: staffStats.present, color: "text-green-600" },
              { label: "נעדרים", value: staffStats.absent, color: "text-red-600" },
              { label: "לא סומן", value: staffStats.unmarked, color: "text-muted-foreground" },
            ].map(s => (
              <div key={s.label} className="border rounded-xl p-3 text-center bg-card">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input className="pr-9 h-9" placeholder="חיפוש איש צוות..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {isLoading ? (
            <div className="border rounded-xl overflow-hidden bg-card divide-y divide-border/40">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-32" /></div>
                </div>
              ))}
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border rounded-xl">
              <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">אין אנשי צוות — הוסף משתמשים תחילה</p>
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden bg-card">
              <div className="divide-y divide-border/40">
                {filteredStaff.map(staffMember => {
                  const status = getStaffStatus(staffMember.id);
                  return (
                    <div key={staffMember.id}
                      className={`flex items-center justify-between px-4 py-3 transition-colors ${status === "present" ? "bg-green-50/40" : status === "absent" ? "bg-red-50/40" : status === "late" ? "bg-amber-50/40" : "hover:bg-muted/10"}`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{staffMember.name}</p>
                        <p className="text-xs text-muted-foreground">{ROLE_LABELS[staffMember.role] || staffMember.role}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {Object.entries(STATUS_MAP).map(([key, cfg]) => {
                          const Icon = cfg.icon;
                          const isActive = status === key;
                          return (
                            <button key={key}
                              disabled={currentSession.isLocked}
                              onClick={() => markStaff.mutate({ userId: staffMember.id, status: isActive ? "clear" : key })}
                              className={`h-9 px-3 rounded-lg border text-sm font-medium flex items-center gap-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${isActive ? cfg.activeColor : cfg.color + " bg-transparent"}`}>
                              <Icon className="w-4 h-4" />
                              <span className="hidden sm:inline">{cfg.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AttendanceReports() {
  const [period, setPeriod] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [reportView, setReportView] = useState<"battalion" | "grade" | "scout">("battalion");
  const { role } = useAuth();

  const { data: records = [], isLoading } = useQuery<ReportRecord[]>({
    queryKey: ["attendance-all-records"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/attendance-sessions/all-records`, {
        headers: { "X-User-Role": role || "" },
      });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { from: rangeFrom, to: rangeTo } = useMemo(
    () => periodDateRange(period, customFrom, customTo),
    [period, customFrom, customTo]
  );

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (!r.sessionDate) return true;
      const d = new Date(r.sessionDate);
      if (rangeFrom && d < rangeFrom) return false;
      if (rangeTo && d > rangeTo) return false;
      return true;
    });
  }, [records, rangeFrom, rangeTo]);

  const battalionStats = useMemo(() => {
    const map = new Map<string, { attended: number; total: number }>();
    for (const r of filtered) {
      const bn = r.battalion || r.sessionBattalion || "ללא גדוד";
      if (!map.has(bn)) map.set(bn, { attended: 0, total: 0 });
      const s = map.get(bn)!;
      s.total++;
      if (r.status === "present" || r.status === "late") s.attended++;
    }
    return [...map.entries()]
      .map(([name, s]) => ({ name, ...s, rate: s.total > 0 ? s.attended / s.total : 0 }))
      .sort((a, b) => b.rate - a.rate);
  }, [filtered]);

  const gradeStats = useMemo(() => {
    const map = new Map<string, { attended: number; total: number }>();
    for (const r of filtered) {
      const grade = r.grade || r.sessionGradeLevel || "ללא שכבה";
      if (!map.has(grade)) map.set(grade, { attended: 0, total: 0 });
      const s = map.get(grade)!;
      s.total++;
      if (r.status === "present" || r.status === "late") s.attended++;
    }
    const gradeOrder = ["ד", "ה", "ו", "ז", "ח", "ט", "י", "יא", "יב"];
    return [...map.entries()]
      .map(([name, s]) => ({ name, ...s, rate: s.total > 0 ? s.attended / s.total : 0 }))
      .sort((a, b) => {
        const ai = gradeOrder.indexOf(a.name);
        const bi = gradeOrder.indexOf(b.name);
        if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
  }, [filtered]);

  const scoutStats = useMemo(() => {
    const map = new Map<number, { name: string; grade: string | null; battalion: string | null; attended: number; total: number }>();
    for (const r of filtered) {
      if (!r.scoutId) continue;
      if (!map.has(r.scoutId)) {
        map.set(r.scoutId, {
          name: [r.scoutName, r.scoutLastName].filter(Boolean).join(" ") || `#${r.scoutId}`,
          grade: r.grade,
          battalion: r.battalion,
          attended: 0,
          total: 0,
        });
      }
      const s = map.get(r.scoutId)!;
      s.total++;
      if (r.status === "present" || r.status === "late") s.attended++;
    }
    return [...map.values()]
      .map(s => ({ ...s, rate: s.total > 0 ? s.attended / s.total : 0 }))
      .sort((a, b) => a.rate - b.rate);
  }, [filtered]);

  const handleExportReportCSV = () => {
    const activeStats = reportView === "battalion" ? battalionStats : reportView === "grade" ? gradeStats : scoutStats;
    const rows = activeStats.map((s: any) => [
      s.name,
      s.attended,
      s.total,
      `${Math.round(s.rate * 100)}%`,
    ]);
    exportCSV(
      `דוח-נוכחות-${reportView}.csv`,
      ["שם", "נוכחים", "סה\"כ", "אחוז"],
      rows,
    );
  };

  const chartData = useMemo(() => {
    if (reportView === "scout") return [];
    const src = reportView === "battalion" ? battalionStats : gradeStats;
    return src.slice(0, 12).map(s => ({
      name: s.name.length <= 2 && reportView === "grade" ? `כיתה ${s.name}` : s.name,
      אחוז: Math.round(s.rate * 100),
    }));
  }, [reportView, battalionStats, gradeStats]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold">דוחות נוכחות</h2>
          <p className="text-muted-foreground">סיכום נוכחות לפי גדוד, שכבה, וחניך</p>
        </div>
        <Button size="sm" variant="outline" onClick={handleExportReportCSV} disabled={isLoading} className="gap-1.5 shrink-0">
          <Download className="w-3.5 h-3.5" /> ייצוא CSV
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {[
            { value: "all", label: "כל הזמן" },
            { value: "week", label: "שבוע אחרון" },
            { value: "month", label: "חודש אחרון" },
            { value: "custom", label: "מותאם" },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${period === opt.value ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {(
            [
              { value: "battalion", label: "גדוד", icon: Flag },
              { value: "grade", label: "שכבה", icon: GraduationCap },
              { value: "scout", label: "חניך", icon: Users },
            ] as { value: "battalion" | "grade" | "scout"; label: string; icon: typeof Flag }[]
          ).map(opt => (
            <button
              key={opt.value}
              onClick={() => setReportView(opt.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${reportView === opt.value ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <opt.icon className="w-3.5 h-3.5" />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {period === "custom" && (
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-muted-foreground">מ-</span>
          <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-8 text-sm w-36" />
          <span className="text-xs text-muted-foreground">עד</span>
          <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-8 text-sm w-36" />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map(i => <div key={i} className="border rounded-xl p-4 bg-card"><Skeleton className="h-8 w-16 mx-auto mb-2" /><Skeleton className="h-3 w-24 mx-auto" /></div>)}
          </div>
          <Skeleton className="h-52 w-full rounded-2xl" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border rounded-xl text-muted-foreground">
          <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">אין נתוני נוכחות בתקופה זו</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {(() => {
              const total = filtered.length;
              const attended = filtered.filter(r => r.status === "present" || r.status === "late").length;
              const rate = total > 0 ? attended / total : 0;
              return [
                { label: "רשומות נוכחות", value: total, color: "text-foreground" },
                { label: "נוכחות / איחור", value: attended, color: "text-green-600" },
                { label: "אחוז נוכחות כללי", value: `${Math.round(rate * 100)}%`, color: rateColor(rate) },
              ];
            })().map(s => (
              <div key={s.label} className="border rounded-xl p-4 text-center bg-card">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {chartData.length > 0 && (
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b bg-muted/30">
                <p className="font-semibold text-sm">גרף נוכחות — {reportView === "battalion" ? "לפי גדוד" : "לפי שכבה"}</p>
              </div>
              <div className="p-4" style={{ height: 220, direction: "ltr" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 4 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => [`${v}%`, "נוכחות"]} />
                    <Bar dataKey="אחוז" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.אחוז >= 80 ? "#22c55e" : entry.אחוז >= 60 ? "#f59e0b" : "#ef4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {reportView === "battalion" && (
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b bg-muted/30 flex items-center gap-2">
                <Flag className="w-4 h-4 text-rose-400" />
                <p className="font-semibold text-sm">נוכחות לפי גדוד</p>
              </div>
              <div className="divide-y divide-border/40">
                {battalionStats.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-muted-foreground">אין נתונים</p>
                ) : battalionStats.map(s => (
                  <div key={s.name} className={`flex items-center gap-4 px-5 py-3 ${rateBg(s.rate)}`}>
                    <div className="w-32 shrink-0">
                      <p className="font-semibold text-sm">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.attended}/{s.total} רשומות</p>
                    </div>
                    <div className="flex-1">
                      <RateBar rate={s.rate} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reportView === "grade" && (
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b bg-muted/30 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-sky-400" />
                <p className="font-semibold text-sm">נוכחות לפי שכבה</p>
              </div>
              <div className="divide-y divide-border/40">
                {gradeStats.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-muted-foreground">אין נתונים</p>
                ) : gradeStats.map(s => (
                  <div key={s.name} className={`flex items-center gap-4 px-5 py-3 ${rateBg(s.rate)}`}>
                    <div className="w-32 shrink-0">
                      <p className="font-semibold text-sm">{s.name.length <= 2 ? `כיתה ${s.name}` : s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.attended}/{s.total} רשומות</p>
                    </div>
                    <div className="flex-1">
                      <RateBar rate={s.rate} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reportView === "scout" && (
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b bg-muted/30 flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <p className="font-semibold text-sm">נוכחות לפי חניך</p>
                <span className="text-xs text-muted-foreground mr-1">— ממוין מנמוך לגבוה</span>
              </div>
              <div className="divide-y divide-border/40">
                {scoutStats.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-muted-foreground">אין נתונים</p>
                ) : scoutStats.map(s => (
                  <div key={s.name} className={`flex items-center gap-4 px-5 py-3 ${rateBg(s.rate)}`}>
                    <div className="w-40 shrink-0">
                      <p className="font-semibold text-sm">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.attended}/{s.total} פעולות
                        {s.grade && ` · כיתה ${s.grade}`}
                        {s.battalion && ` · ${s.battalion}`}
                      </p>
                    </div>
                    <div className="flex-1">
                      <RateBar rate={s.rate} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

type VerificationRow = {
  session: Session;
  total: number;
  marked: number;
  instructors: { instructorName: string; total: number; marked: number }[];
};

function VerificationView() {
  const { user, role } = useAuth();
  const myBattalion = role === "roshgad" ? (user?.battalion || null) : null;

  const { data: rows = [], isLoading } = useQuery<VerificationRow[]>({
    queryKey: ["attendance-verification", myBattalion],
    queryFn: () => {
      const q = myBattalion ? `?battalion=${encodeURIComponent(myBattalion)}` : "";
      return fetch(`${API_BASE}/api/attendance-sessions/verification${q}`).then(r => r.json());
    },
    refetchInterval: 30000,
  });

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggle = (id: number) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>;

  if (rows.length === 0) return (
    <div className="text-center py-16 text-muted-foreground border rounded-xl">
      <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p className="text-sm">אין פעולות {myBattalion ? `לגדוד ${myBattalion}` : ""} לבקרה</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
        {myBattalion ? `גדוד: ${myBattalion}` : "כל הגדודים"} — רענון אוטומטי כל 30 שניות
      </div>
      {rows.map(({ session, total, marked, instructors }) => {
        const isExpanded = expanded.has(session.id);
        const pct = total > 0 ? Math.round(marked / total * 100) : 0;
        const allDone = instructors.every(i => i.marked === i.total);
        const noneDone = instructors.every(i => i.marked === 0);
        return (
          <div key={session.id} className="border rounded-xl overflow-hidden">
            <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors text-right" onClick={() => toggle(session.id)}>
              <div className={`w-3 h-3 rounded-full shrink-0 ${allDone && total > 0 ? "bg-green-500" : noneDone ? "bg-red-400" : "bg-amber-400"}`} />
              <div className="flex-1 min-w-0 text-right">
                <p className="font-medium text-sm">{session.title}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(session.date).toLocaleDateString("he-IL")}
                  {session.battalion ? ` • ${session.battalion}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="text-sm font-bold">{marked}/{total}</p>
                  <p className="text-xs text-muted-foreground">סומנו</p>
                </div>
                <div className="w-16">
                  <div className="h-1.5 bg-muted rounded-full">
                    <div className={`h-1.5 rounded-full ${pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-0.5">{pct}%</p>
                </div>
                <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "-rotate-90" : "rotate-90"}`} />
              </div>
            </button>
            {isExpanded && (
              <div className="border-t bg-muted/10 divide-y divide-border/40">
                {instructors.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">אין מדריכים משויכים לגדוד זה</p>
                ) : (
                  instructors.map(ins => {
                    const insPct = ins.total > 0 ? Math.round(ins.marked / ins.total * 100) : 0;
                    return (
                      <div key={ins.instructorName} className="flex items-center gap-3 px-4 py-2.5">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${ins.marked === ins.total && ins.total > 0 ? "bg-green-500" : ins.marked === 0 ? "bg-red-400" : "bg-amber-400"}`} />
                        <p className="flex-1 text-sm font-medium">{ins.instructorName}</p>
                        <p className="text-xs text-muted-foreground">{ins.marked}/{ins.total} חניכים</p>
                        <div className="w-14">
                          <div className="h-1 bg-muted rounded-full">
                            <div className={`h-1 rounded-full ${insPct === 100 ? "bg-green-500" : insPct > 0 ? "bg-amber-500" : "bg-red-400"}`} style={{ width: `${insPct}%` }} />
                          </div>
                        </div>
                        <span className={`text-xs font-medium w-8 text-left ${insPct === 100 ? "text-green-600" : insPct > 0 ? "text-amber-600" : "text-red-600"}`}>{insPct}%</span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Attendance() {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [mainTab, setMainTab] = useState<"activities" | "reports" | "verification">("activities");
  const { executionBlocked } = useAppSettings();
  const { role } = useAuth();
  const canVerify = ["marcaz_boger", "marcaz_tzair", "roshgad"].includes(role || "");

  if (executionBlocked) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
        <Lock className="w-14 h-14 text-amber-500 opacity-70" />
        <h2 className="text-2xl font-bold">ביצוע נעול</h2>
        <p className="text-muted-foreground max-w-sm">נתוני נוכחות נעולים על ידי מרכז בוגר. פנה למרכז בוגר לפתיחת הגישה.</p>
      </div>
    );
  }

  if (selectedSession) {
    return (
      <MarkingPage
        session={selectedSession}
        onBack={() => setSelectedSession(null)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b overflow-x-auto">
        <button
          onClick={() => setMainTab("activities")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${mainTab === "activities" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <ClipboardList className="w-4 h-4" /> פעולות
        </button>
        {canVerify && (
          <button
            onClick={() => setMainTab("verification")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${mainTab === "verification" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <UserCheck className="w-4 h-4" /> בקרת מדריכים
          </button>
        )}
        <button
          onClick={() => setMainTab("reports")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${mainTab === "reports" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <BarChart2 className="w-4 h-4" /> דוחות נוכחות
        </button>
      </div>

      {mainTab === "activities" && <ActivityList onSelect={setSelectedSession} />}
      {mainTab === "verification" && canVerify && <VerificationView />}
      {mainTab === "reports" && <AttendanceReports />}
    </div>
  );
}
