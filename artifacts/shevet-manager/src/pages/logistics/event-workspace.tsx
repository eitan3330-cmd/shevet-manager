import { useState, useRef, useCallback, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowRight, Plus, Trash2, CheckCircle2, Circle, CalendarRange,
  MapPin, User, Users, Bus, Utensils, ListTodo, Pencil,
  AlertCircle, Clock, Upload, Check, X, AlertTriangle, FileSpreadsheet,
  HeartPulse, Search, Package, Wallet, CalendarClock, BookImage,
  Megaphone, Square, CheckSquare, ChevronDown, ChevronUp, TrendingUp, TrendingDown,
  Target, UserPlus, Shield, MoreHorizontal, Phone, Eye, EyeOff,
  Calendar, ChevronLeft, ChevronRight, GripVertical, Settings
} from "lucide-react";
import { useListScouts } from "@/lib/api-hooks";
import { useAuth } from "@/hooks/use-auth";
import * as XLSX from "xlsx";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const apiFetch = (path: string, opts?: RequestInit) =>
  fetch(`${API_BASE}/api${path}`, opts).then(r => r.json());

type EventTask = {
  id: number; eventId: number; title: string; priority: "high" | "normal" | "low";
  assignee: string | null; assignedToUserId: number | null; done: boolean;
  notes: string | null; dueDate: string | null; createdAt: string;
};
type EventBus = {
  id: number; eventId: number; name: string; capacity: number | null;
  driverName: string | null; departureTime: string | null; meetingPoint: string | null;
  notes: string | null; createdAt: string;
};
type MenuItem = { id: number; eventId: number; dayNumber: number; mealType: string; description: string; notes: string | null; createdAt: string };
type Scout = { id: number; name: string; lastName: string | null; grade: string | null; gizra: string; phone: string | null; battalion: string | null };
type ParticipantRow = {
  id: number; eventId: number; scoutId: number | null; rawName: string | null;
  confirmed: boolean; status: string; busId: number | null; notes: string | null;
  scoutName: string | null; scoutLastName: string | null; scoutGrade: string | null;
  scoutGizra: string | null; scoutBattalion: string | null; scoutPhone: string | null;
  scoutParentPhone: string | null; scoutMedicalIssues: string | null;
  scoutFoodPreferences: string | null; scoutInstructorName: string | null;
};
type MatchResult = {
  firstName: string; lastName: string; matchType: "exact" | "fuzzy" | "none";
  distance: number | null; alreadyAdded: boolean;
  scout: { id: number; name: string; lastName: string | null; grade: string | null; battalion: string | null; phone: string | null; parentPhone: string | null; medicalIssues: string | null; foodPreferences: string | null; gizra: string; instructorName: string | null } | null;
};
type EventData = {
  id: number; name: string; description: string | null; category: string; status: string;
  eventType: string | null; date: string | null; endDate: string | null; location: string | null;
  responsiblePerson: string | null; participantsCount: number | null;
  budgetAllocated: string | null; actualCost: string | null; transportNeeded: string | null;
  notes: string | null; error?: string;
};
type EventStaffRow = { id: number; eventId: number; userId: number; role: string; notes: string | null; createdAt: string; userName: string | null; userRole: string | null; userGrade: string | null; userTeam: string | null };
type EventDeadlineRow = { id: number; eventId: number; title: string; date: string; responsiblePerson: string | null; completed: boolean; notes: string | null; createdAt: string };
type EventFormat = { id: number; eventId: number; title: string; category: string; description: string | null; duration: string | null; responsible: string | null; notes: string | null; createdAt: string };
type EventEquipment = { id: number; eventId: number; name: string; quantity: number; category: string; responsible: string | null; checked: boolean; notes: string | null; createdAt: string };
type EventBudgetItem = { id: number; eventId: number; type: string; category: string; description: string; plannedAmount: string; actualAmount: string; notes: string | null; createdAt: string };
type EventScheduleSlot = { id: number; eventId: number; dayNumber: number; startTime: string; endTime: string | null; title: string; location: string | null; responsible: string | null; category: string; notes: string | null; createdAt: string };
type EventPortfolioItem = { id: number; eventId: number; title: string; type: string; content: string | null; imageUrl: string | null; createdAt: string };

type Section = "dashboard" | "tasks" | "participants" | "buses" | "menu" | "formats" | "equipment" | "budget" | "schedule" | "portfolio" | "details";

const MEAL_TYPES = [
  { value: "breakfast", label: "ארוחת בוקר" },
  { value: "lunch", label: "ארוחת צהריים" },
  { value: "dinner", label: "ארוחת ערב" },
  { value: "snack", label: "חטיף" },
];
const EVENT_TYPES: Record<string, string> = {
  shabaton: "שבתון", mifaal_yomi: "מפעל יומי", erev: "ערב",
  machaneh_kayitz: "מחנה קיץ", machaneh_choref: "מחנה חורף",
  tiyul: "טיול", peilut_shvatit: "פעילות שבטית", akira: "עקירה", other: "אחר",
};
const STAFF_ROLES = ["אחראי טיול", "שכבגיסט", "אחראי לוגיסטיקה", "אחראי תוכן", "אחראי ציוד", "אחראי הסעות", "אחראי תפריט", "תפקיד אחר"];

const STAFF_ROLE_SECTIONS: Record<string, Section[]> = {
  "אחראי טיול": ["dashboard", "tasks", "participants", "buses", "budget", "formats", "equipment", "schedule", "menu", "portfolio", "details"],
  "שכבגיסט": ["dashboard", "tasks", "participants", "portfolio"],
  "אחראי לוגיסטיקה": ["dashboard", "tasks", "buses", "budget", "equipment"],
  "אחראי תוכן": ["dashboard", "tasks", "formats", "portfolio", "schedule"],
  "אחראי ציוד": ["dashboard", "tasks", "equipment"],
  "אחראי הסעות": ["dashboard", "tasks", "buses"],
  "אחראי תפריט": ["dashboard", "tasks", "menu"],
};

const NAV_ITEMS: { id: Section; label: string; icon: string; group: string }[] = [
  { id: "dashboard", label: "לוח בקרה", icon: "dashboard", group: "" },
  { id: "tasks", label: "משימות", icon: "assignment", group: "ניהול שוטף" },
  { id: "participants", label: "רשומים", icon: "how_to_reg", group: "ניהול שוטף" },
  { id: "buses", label: "אוטובוסים", icon: "directions_bus", group: "ניהול שוטף" },
  { id: "budget", label: "תקציב", icon: "payments", group: "ניהול שוטף" },
  { id: "formats", label: "פורמטים", icon: "description", group: "מסמכים ותוכן" },
  { id: "equipment", label: "ציוד", icon: "inventory_2", group: "מסמכים ותוכן" },
  { id: "schedule", label: "לו״ז טיול", icon: "calendar_today", group: "מסמכים ותוכן" },
  { id: "menu", label: "תפריט", icon: "restaurant", group: "מסמכים ותוכן" },
  { id: "portfolio", label: "תיק הדרכה", icon: "history_edu", group: "מסמכים ותוכן" },
  { id: "details", label: "פרטי מפעל", icon: "settings", group: "" },
];

const ROLE_HIERARCHY: Record<string, number> = {
  marcaz_boger: 6, marcaz_tzair: 5, roshatz: 4, roshgad: 3, madrich: 2, pael: 1,
};

function ExcelImportPanel({ eventId, onImportDone }: { eventId: number; onImportDone: () => void }) {
  const [step, setStep] = useState<"idle" | "preview" | "results">("idle");
  const [results, setResults] = useState<MatchResult[]>([]);
  const [pending, setPending] = useState<Record<number, "confirm" | "reject" | "unmatched">>({});
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");
  const [importSummary, setImportSummary] = useState({ added: 0, failed: 0, skipped: 0 });
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const parseExcel = useCallback(async (file: File) => {
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
      const rawNames: { firstName: string; lastName: string }[] = [];
      for (const row of rows) {
        const keys = Object.keys(row);
        const firstKey = keys.find(k => /שם פרטי|first.*name|firstname/i.test(k));
        const lastKey = keys.find(k => /שם משפחה|last.*name|lastname/i.test(k));
        const fullKey = keys.find(k => /שם מלא|full.*name|fullname/i.test(k));
        if (firstKey && lastKey) {
          const fn = String(row[firstKey]).trim(), ln = String(row[lastKey]).trim();
          if (fn || ln) rawNames.push({ firstName: fn, lastName: ln });
        } else if (fullKey) {
          const parts = String(row[fullKey]).trim().split(/\s+/);
          if (parts.length >= 2) rawNames.push({ firstName: parts[0], lastName: parts.slice(1).join(" ") });
        } else if (keys.length >= 2) {
          const fn = String(row[keys[0]]).trim(), ln = String(row[keys[1]]).trim();
          if (fn || ln) rawNames.push({ firstName: fn, lastName: ln });
        }
      }
      if (rawNames.length === 0) { toast({ title: "לא נמצאו שמות בקובץ", variant: "destructive" }); return; }
      const seen = new Map<string, number>();
      const names = rawNames.map((n, i) => { const key = `${n.firstName.toLowerCase()}|${n.lastName.toLowerCase()}`; if (seen.has(key)) return null; seen.set(key, i); return n; }).filter((n): n is { firstName: string; lastName: string } => n !== null);
      const dupCount = rawNames.length - names.length;
      const resp = await fetch(`${API_BASE}/api/events/${eventId}/participants/import-excel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ names }) });
      if (!resp.ok) throw new Error("שגיאת שרת");
      const data: MatchResult[] = await resp.json();
      setResults(data);
      if (dupCount > 0) toast({ title: `${dupCount} שמות כפולים הוסרו מהרשימה` });
      const init: Record<number, "confirm" | "reject" | "unmatched"> = {};
      data.forEach((r, i) => { if (r.alreadyAdded) init[i] = "reject"; else if (r.matchType !== "none") init[i] = "confirm"; else init[i] = "unmatched"; });
      setPending(init);
      setStep("preview");
    } catch { toast({ title: "שגיאה בטעינת הקובץ", variant: "destructive" }); }
  }, [eventId, toast]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) parseExcel(f); if (fileRef.current) fileRef.current.value = ""; };

  const confirmImport = async () => {
    setImporting(true);
    const rows: { scoutId?: number; rawName?: string; confirmed: boolean }[] = [];
    for (const [idxStr, action] of Object.entries(pending)) {
      const idx = parseInt(idxStr); const r = results[idx];
      if (action === "confirm" && r.scout) rows.push({ scoutId: r.scout.id, confirmed: true });
      else if (action === "unmatched") rows.push({ rawName: `${r.firstName} ${r.lastName}`.trim(), confirmed: false });
    }
    if (rows.length === 0) { setImportSummary({ added: 0, failed: 0, skipped: 0 }); setStep("results"); setImporting(false); return; }
    const resp = await fetch(`${API_BASE}/api/events/${eventId}/participants/bulk-confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
    let added = 0, failed = 0, skipped = 0;
    if (resp.ok) { const result = await resp.json() as { added: number; skipped: number; failed: number }; added = result.added; failed = result.failed; skipped = result.skipped; } else { failed = rows.length; }
    setImportSummary({ added, failed, skipped }); setStep("results"); setImporting(false); onImportDone();
    const parts = [`נוספו ${added}`]; if (skipped > 0) parts.push(`${skipped} כבר קיימים`); if (failed > 0) parts.push(`${failed} נכשלו`);
    toast({ title: parts.join(" · "), variant: failed > 0 ? "destructive" : "default" });
  };

  const reset = () => { setStep("idle"); setResults([]); setPending({}); setFileName(""); setImportSummary({ added: 0, failed: 0, skipped: 0 }); };
  const toConfirm = Object.values(pending).filter(v => v === "confirm" || v === "unmatched").length;

  if (step === "idle") {
    return (
      <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center cursor-pointer hover:border-[#00327d]/30 hover:bg-blue-50/30 transition-all" onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) parseExcel(f); }}>
        <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 text-slate-400" />
        <p className="font-bold text-sm text-slate-700">גרור קובץ Excel / CSV לכאן</p>
        <p className="text-xs text-slate-500 mt-1">הקובץ צריך לכלול עמודות: שם פרטי, שם משפחה</p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
      </div>
    );
  }

  if (step === "results") {
    return (
      <div className="rounded-2xl bg-green-50 p-5 text-center space-y-3">
        <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
        <p className="font-bold text-green-800">הייבוא הושלם</p>
        <p className="text-sm text-green-700">{importSummary.added} משתתפים נוספו{importSummary.skipped > 0 ? ` · ${importSummary.skipped} כבר קיימים` : ""}{importSummary.failed > 0 ? ` · ${importSummary.failed} נכשלו` : ""}</p>
        <Button variant="outline" size="sm" onClick={reset}>ייבוא רשימה נוספת</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="font-bold text-sm">{fileName} — {results.length} שמות</p>
          <div className="flex gap-3 text-xs mt-0.5 flex-wrap">
            <span className="text-green-600">{results.filter(r => r.matchType === "exact").length} התאמות מדויקות</span>
            <span className="text-amber-600">{results.filter(r => r.matchType === "fuzzy").length} חלקיות</span>
            <span className="text-red-600">{results.filter(r => r.matchType === "none").length} ללא התאמה</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={reset}>ביטול</Button>
          <Button size="sm" onClick={confirmImport} disabled={importing || toConfirm === 0}>{importing ? "מייבא..." : `אשר ייבוא (${toConfirm})`}</Button>
        </div>
      </div>
      <div className="rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-[420px] overflow-y-auto bg-white">
        {results.map((r, i) => {
          const action = pending[i];
          const rowBg = action === "reject" ? "bg-slate-50" : r.matchType === "exact" ? "bg-green-50/40" : r.matchType === "fuzzy" ? "bg-amber-50/40" : "bg-red-50/40";
          return (
            <div key={i} className={`flex items-start gap-3 px-4 py-3 ${rowBg} ${action === "reject" ? "opacity-50" : ""}`}>
              <div className="shrink-0 mt-0.5">
                {r.matchType === "exact" && <Check className="w-4 h-4 text-green-600" />}
                {r.matchType === "fuzzy" && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                {r.matchType === "none" && <X className="w-4 h-4 text-red-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{r.firstName} {r.lastName}{r.alreadyAdded && <span className="text-xs text-slate-500 mr-1">(כבר ברשימה)</span>}</p>
                {r.scout && <p className="text-xs text-slate-500">→ {r.scout.name} {r.scout.lastName || ""}{r.scout.grade && ` · כיתה ${r.scout.grade}`}{r.scout.battalion && ` · ${r.scout.battalion}`}{r.scout.medicalIssues && <span className="text-red-600"> · ⚕ {r.scout.medicalIssues}</span>}</p>}
                {r.matchType === "none" && <p className="text-xs text-slate-500">לא נמצא במאגר — יתווסף כשם גולמי</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                {!r.alreadyAdded && r.matchType !== "none" && (
                  <>
                    <button onClick={() => setPending(p => ({ ...p, [i]: "confirm" }))} className={`px-2 py-1 rounded text-xs font-medium border transition-all ${action === "confirm" ? "bg-green-500 text-white border-green-500" : "text-green-700 border-green-300 hover:bg-green-50"}`}>אשר</button>
                    <button onClick={() => setPending(p => ({ ...p, [i]: "reject" }))} className={`px-2 py-1 rounded text-xs font-medium border transition-all ${action === "reject" ? "bg-slate-200 text-slate-500" : "text-slate-500 border-slate-300 hover:bg-slate-50"}`}>דלג</button>
                  </>
                )}
                {!r.alreadyAdded && r.matchType === "none" && (
                  <>
                    <button onClick={() => setPending(p => ({ ...p, [i]: "unmatched" }))} className={`px-2 py-1 rounded text-xs font-medium border transition-all ${action === "unmatched" ? "bg-amber-500 text-white border-amber-500" : "text-amber-700 border-amber-300 hover:bg-amber-50"}`}>הוסף בלאו"כ</button>
                    <button onClick={() => setPending(p => ({ ...p, [i]: "reject" }))} className={`px-2 py-1 rounded text-xs font-medium border transition-all ${action === "reject" ? "bg-slate-200 text-slate-500" : "text-slate-500 border-slate-300 hover:bg-slate-50"}`}>דלג</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UnmatchedRow({ participant, availableScouts, onAttach, onRemove }: { participant: ParticipantRow; availableScouts: Scout[]; onAttach: (pid: number, scoutId: number) => void; onRemove: () => void }) {
  const [selectedId, setSelectedId] = useState("");
  return (
    <div className="flex items-center gap-2 text-sm flex-wrap">
      <span className="text-amber-800 flex-1 min-w-24 font-medium">{participant.rawName || "ללא שם"}</span>
      <Select value={selectedId} onValueChange={setSelectedId}>
        <SelectTrigger className="h-7 text-xs w-44 bg-white"><SelectValue placeholder="קשר לחניך..." /></SelectTrigger>
        <SelectContent>{availableScouts.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name} {s.lastName || ""}{s.grade ? ` (כיתה ${s.grade})` : ""}</SelectItem>)}</SelectContent>
      </Select>
      <Button size="sm" variant="outline" className="h-7 text-xs border-amber-400 text-amber-700 hover:bg-amber-100" disabled={!selectedId} onClick={() => { if (selectedId) onAttach(participant.id, parseInt(selectedId)); }}><Check className="w-3 h-3 ml-1" /> קשר</Button>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:bg-amber-100" onClick={onRemove}><Trash2 className="w-3 h-3" /></Button>
    </div>
  );
}

export function EventWorkspace() {
  const [, params] = useRoute("/logistics/events/:id");
  const [, setLocation] = useLocation();
  const eventId = params?.id ? parseInt(params.id) : null;
  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const { role, user } = useAuth();
  const canEditEvent = ["marcaz_boger", "marcaz_tzair", "roshatz", "roshgad"].includes(role || "");
  const authHeaders = { "Content-Type": "application/json", "x-user-role": role || "" };

  const checkedFetch = async (url: string, opts: RequestInit) => {
    const r = await fetch(url, opts);
    if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err?.error || "שגיאה"); }
    if (r.status === 204) return null;
    return r.json();
  };

  const { data: event } = useQuery<EventData>({ queryKey: ["event", eventId], queryFn: () => apiFetch(`/events/${eventId}`), enabled: !!eventId });
  const { data: tasks = [] } = useQuery<EventTask[]>({ queryKey: ["event-tasks", eventId], queryFn: () => apiFetch(`/events/${eventId}/tasks`), enabled: !!eventId });
  const { data: participants = [] } = useQuery<ParticipantRow[]>({ queryKey: ["event-participants", eventId], queryFn: () => apiFetch(`/events/${eventId}/participants`), enabled: !!eventId });
  const { data: buses = [] } = useQuery<EventBus[]>({ queryKey: ["event-buses", eventId], queryFn: () => apiFetch(`/events/${eventId}/buses`), enabled: !!eventId });
  const { data: menu = [] } = useQuery<MenuItem[]>({ queryKey: ["event-menu", eventId], queryFn: () => apiFetch(`/events/${eventId}/menu`), enabled: !!eventId });
  const { data: allScouts = [] } = useListScouts() as { data: Scout[] };
  const { data: formats = [] } = useQuery<EventFormat[]>({ queryKey: ["event-formats", eventId], queryFn: () => apiFetch(`/events/${eventId}/formats`), enabled: !!eventId });
  const { data: equipment = [] } = useQuery<EventEquipment[]>({ queryKey: ["event-equipment", eventId], queryFn: () => apiFetch(`/events/${eventId}/equipment`), enabled: !!eventId });
  const { data: budgetItems = [] } = useQuery<EventBudgetItem[]>({ queryKey: ["event-budget-items", eventId], queryFn: () => apiFetch(`/events/${eventId}/budget-items`), enabled: !!eventId });
  const { data: scheduleSlots = [] } = useQuery<EventScheduleSlot[]>({ queryKey: ["event-schedule", eventId], queryFn: () => apiFetch(`/events/${eventId}/schedule`), enabled: !!eventId });
  const { data: portfolioItems = [] } = useQuery<EventPortfolioItem[]>({ queryKey: ["event-portfolio", eventId], queryFn: () => apiFetch(`/events/${eventId}/portfolio`), enabled: !!eventId });
  const { data: eventDeadlines = [] } = useQuery<EventDeadlineRow[]>({ queryKey: ["event-deadlines-for", eventId], queryFn: () => apiFetch(`/events/${eventId}/deadlines`), enabled: !!eventId });
  const { data: eventStaff = [] } = useQuery<EventStaffRow[]>({ queryKey: ["event-staff", eventId], queryFn: () => apiFetch(`/events/${eventId}/staff`), enabled: !!eventId });
  const { data: allUsers = [] } = useQuery<any[]>({ queryKey: ["all-users"], queryFn: () => apiFetch("/users") });

  const invalidate = (key: string) => qc.invalidateQueries({ queryKey: [key, eventId] });

  /* Tasks state */
  const [newTask, setNewTask] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");

  const addTask = useMutation({
    mutationFn: (data: { title: string; priority: string; assignee: string | null; assignedToUserId: number | null; dueDate: string | null }) => checkedFetch(`${API_BASE}/api/events/${eventId}/tasks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { invalidate("event-tasks"); setNewTask(""); setTaskAssignee(""); },
    onError: (e: Error) => toast({ title: e.message || "שגיאה בהוספת משימה", variant: "destructive" }),
  });
  const toggleTask = useMutation({
    mutationFn: ({ taskId, done }: { taskId: number; done: boolean }) => checkedFetch(`${API_BASE}/api/events/${eventId}/tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done }) }),
    onSuccess: () => invalidate("event-tasks"),
    onError: (e: Error) => toast({ title: e.message || "שגיאה", variant: "destructive" }),
  });
  const deleteTask = useMutation({
    mutationFn: (taskId: number) => checkedFetch(`${API_BASE}/api/events/${eventId}/tasks/${taskId}`, { method: "DELETE" }),
    onSuccess: () => invalidate("event-tasks"),
    onError: (e: Error) => toast({ title: e.message || "שגיאה", variant: "destructive" }),
  });

  /* Participants state */
  const [selectedScout, setSelectedScout] = useState("");
  const [participantGradeFilter, setParticipantGradeFilter] = useState("all");
  const [participantBattalionFilter, setParticipantBattalionFilter] = useState("all");
  const [participantSearch, setParticipantSearch] = useState("");
  const [participantMedicalFilter, setParticipantMedicalFilter] = useState("all");

  const addParticipant = useMutation({
    mutationFn: (scoutId: number) => checkedFetch(`${API_BASE}/api/events/${eventId}/participants`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scoutId, confirmed: true }) }),
    onSuccess: () => { invalidate("event-participants"); setSelectedScout(""); },
    onError: (e: Error) => toast({ title: e.message || "שגיאה בהוספת משתתף", variant: "destructive" }),
  });
  const removeParticipant = useMutation({
    mutationFn: (pid: number) => checkedFetch(`${API_BASE}/api/events/${eventId}/participants/${pid}`, { method: "DELETE" }),
    onSuccess: () => invalidate("event-participants"),
    onError: (e: Error) => toast({ title: e.message || "שגיאה", variant: "destructive" }),
  });
  const updateParticipantBus = useMutation({
    mutationFn: ({ pid, busId }: { pid: number; busId: number | null }) => checkedFetch(`${API_BASE}/api/events/${eventId}/participants/${pid}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ busId }) }),
    onSuccess: () => invalidate("event-participants"),
    onError: (e: Error) => toast({ title: e.message || "שגיאה", variant: "destructive" }),
  });

  /* Buses state */
  const [newBus, setNewBus] = useState({ name: "", capacity: "", driverName: "", departureTime: "", meetingPoint: "" });
  const [autoAssignCap, setAutoAssignCap] = useState("50");
  const [autoAssignReserve, setAutoAssignReserve] = useState("4");
  const [showPrintSigns, setShowPrintSigns] = useState(false);
  const addBus = useMutation({
    mutationFn: () => checkedFetch(`${API_BASE}/api/events/${eventId}/buses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...newBus, capacity: newBus.capacity ? parseInt(newBus.capacity) : null }) }),
    onSuccess: () => { invalidate("event-buses"); setNewBus({ name: "", capacity: "", driverName: "", departureTime: "", meetingPoint: "" }); },
    onError: (e: Error) => toast({ title: e.message || "שגיאה", variant: "destructive" }),
  });
  const deleteBus = useMutation({
    mutationFn: (busId: number) => checkedFetch(`${API_BASE}/api/events/${eventId}/buses/${busId}`, { method: "DELETE" }),
    onSuccess: () => invalidate("event-buses"),
    onError: (e: Error) => toast({ title: e.message || "שגיאה", variant: "destructive" }),
  });
  const autoAssignBuses = useMutation({
    mutationFn: () => checkedFetch(`${API_BASE}/api/events/${eventId}/buses/auto-assign`, { method: "POST", headers: authHeaders, body: JSON.stringify({ busCapacity: parseInt(autoAssignCap) || 50, reserveForBogrim: parseInt(autoAssignReserve) || 4 }) }),
    onSuccess: (data: any) => { invalidate("event-buses"); invalidate("event-participants"); toast({ title: `שובצו ${data.totalAssigned} משתתפים ל-${data.totalBuses} אוטובוסים` }); },
    onError: (e: Error) => toast({ title: e.message || "שגיאה בשיבוץ אוטומטי", variant: "destructive" }),
  });

  /* Menu state */
  const [selectedDay, setSelectedDay] = useState(1);
  const [newMenuItem, setNewMenuItem] = useState({ mealType: "breakfast", description: "" });
  const addMenuItem = useMutation({
    mutationFn: () => checkedFetch(`${API_BASE}/api/events/${eventId}/menu`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...newMenuItem, dayNumber: selectedDay }) }),
    onSuccess: () => { invalidate("event-menu"); setNewMenuItem({ mealType: "breakfast", description: "" }); },
    onError: (e: Error) => toast({ title: e.message || "שגיאה", variant: "destructive" }),
  });
  const deleteMenuItem = useMutation({
    mutationFn: (menuId: number) => checkedFetch(`${API_BASE}/api/events/${eventId}/menu/${menuId}`, { method: "DELETE" }),
    onSuccess: () => invalidate("event-menu"),
    onError: (e: Error) => toast({ title: e.message || "שגיאה", variant: "destructive" }),
  });

  /* Formats */
  const [newFormat, setNewFormat] = useState({ title: "", category: "general", description: "", duration: "", responsible: "" });
  const addFormat = useMutation({
    mutationFn: () => checkedFetch(`${API_BASE}/api/events/${eventId}/formats`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newFormat) }),
    onSuccess: () => { invalidate("event-formats"); setNewFormat({ title: "", category: "general", description: "", duration: "", responsible: "" }); },
    onError: (e: Error) => toast({ title: e.message || "שגיאה", variant: "destructive" }),
  });
  const deleteFormat = useMutation({
    mutationFn: (id: number) => checkedFetch(`${API_BASE}/api/events/${eventId}/formats/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidate("event-formats"),
    onError: (e: Error) => toast({ title: e.message || "שגיאה", variant: "destructive" }),
  });

  /* Equipment */
  const [newEquipment, setNewEquipment] = useState({ name: "", quantity: "1", category: "general", responsible: "" });
  const addEquipment = useMutation({
    mutationFn: () => checkedFetch(`${API_BASE}/api/events/${eventId}/equipment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...newEquipment, quantity: parseInt(newEquipment.quantity) || 1 }) }),
    onSuccess: () => { invalidate("event-equipment"); setNewEquipment({ name: "", quantity: "1", category: "general", responsible: "" }); },
    onError: (e: Error) => toast({ title: e.message || "שגיאה", variant: "destructive" }),
  });
  const deleteEquipment = useMutation({
    mutationFn: (id: number) => checkedFetch(`${API_BASE}/api/events/${eventId}/equipment/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidate("event-equipment"),
    onError: (e: Error) => toast({ title: e.message || "שגיאה", variant: "destructive" }),
  });
  const toggleEquipment = useMutation({
    mutationFn: ({ id, checked }: { id: number; checked: boolean }) => checkedFetch(`${API_BASE}/api/events/${eventId}/equipment/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checked }) }),
    onSuccess: () => invalidate("event-equipment"),
    onError: (e: Error) => toast({ title: e.message || "שגיאה", variant: "destructive" }),
  });

  /* Budget */
  const [newBudgetItem, setNewBudgetItem] = useState({ type: "expense", category: "general", description: "", plannedAmount: "", actualAmount: "" });
  const addBudgetItem = useMutation({
    mutationFn: () => checkedFetch(`${API_BASE}/api/events/${eventId}/budget-items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newBudgetItem) }),
    onSuccess: () => { invalidate("event-budget-items"); setNewBudgetItem({ type: "expense", category: "general", description: "", plannedAmount: "", actualAmount: "" }); },
    onError: (e: Error) => toast({ title: e.message || "שגיאה", variant: "destructive" }),
  });
  const deleteBudgetItem = useMutation({
    mutationFn: (id: number) => checkedFetch(`${API_BASE}/api/events/${eventId}/budget-items/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidate("event-budget-items"),
    onError: (e: Error) => toast({ title: e.message || "שגיאה", variant: "destructive" }),
  });
  const updateBudgetItem = useMutation({
    mutationFn: ({ id, actualAmount }: { id: number; actualAmount: string }) => checkedFetch(`${API_BASE}/api/events/${eventId}/budget-items/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actualAmount }) }),
    onSuccess: () => invalidate("event-budget-items"),
    onError: (e: Error) => toast({ title: e.message || "שגיאה", variant: "destructive" }),
  });

  /* Schedule */
  const [scheduleDay, setScheduleDay] = useState(1);
  const [newSlot, setNewSlot] = useState({ startTime: "", endTime: "", title: "", location: "", responsible: "", category: "activity" });
  const addSlot = useMutation({
    mutationFn: () => checkedFetch(`${API_BASE}/api/events/${eventId}/schedule`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...newSlot, dayNumber: scheduleDay }) }),
    onSuccess: () => { invalidate("event-schedule"); setNewSlot({ startTime: "", endTime: "", title: "", location: "", responsible: "", category: "activity" }); },
    onError: (e: Error) => toast({ title: e.message || "שגיאה", variant: "destructive" }),
  });
  const deleteSlot = useMutation({
    mutationFn: (id: number) => checkedFetch(`${API_BASE}/api/events/${eventId}/schedule/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidate("event-schedule"),
    onError: (e: Error) => toast({ title: e.message || "שגיאה", variant: "destructive" }),
  });

  /* Portfolio */
  const [newPortfolio, setNewPortfolio] = useState({ title: "", type: "note", content: "" });
  const addPortfolio = useMutation({
    mutationFn: () => checkedFetch(`${API_BASE}/api/events/${eventId}/portfolio`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newPortfolio) }),
    onSuccess: () => { invalidate("event-portfolio"); setNewPortfolio({ title: "", type: "note", content: "" }); },
    onError: (e: Error) => toast({ title: e.message || "שגיאה", variant: "destructive" }),
  });
  const deletePortfolio = useMutation({
    mutationFn: (id: number) => checkedFetch(`${API_BASE}/api/events/${eventId}/portfolio/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidate("event-portfolio"),
    onError: (e: Error) => toast({ title: e.message || "שגיאה", variant: "destructive" }),
  });

  /* Deadlines */
  const [newDeadline, setNewDeadline] = useState({ title: "", date: "", responsiblePerson: "", notes: "" });
  const [editDeadlineId, setEditDeadlineId] = useState<number | null>(null);
  const addDeadline = useMutation({
    mutationFn: (data: any) => checkedFetch(`${API_BASE}/api/events/${eventId}/deadlines`, { method: "POST", headers: authHeaders, body: JSON.stringify(data) }),
    onSuccess: () => { invalidate("event-deadlines-for"); qc.invalidateQueries({ queryKey: ["event-deadlines"] }); setNewDeadline({ title: "", date: "", responsiblePerson: "", notes: "" }); setEditDeadlineId(null); toast({ title: "דד-ליין נוסף" }); },
    onError: (e: Error) => toast({ title: e.message || "שגיאה", variant: "destructive" }),
  });
  const updateDeadline = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => checkedFetch(`${API_BASE}/api/event-deadlines/${id}`, { method: "PUT", headers: authHeaders, body: JSON.stringify(data) }),
    onSuccess: () => { invalidate("event-deadlines-for"); qc.invalidateQueries({ queryKey: ["event-deadlines"] }); setNewDeadline({ title: "", date: "", responsiblePerson: "", notes: "" }); setEditDeadlineId(null); toast({ title: "דד-ליין עודכן" }); },
    onError: (e: Error) => toast({ title: e.message || "שגיאה", variant: "destructive" }),
  });
  const deleteDeadline = useMutation({
    mutationFn: (id: number) => checkedFetch(`${API_BASE}/api/event-deadlines/${id}`, { method: "DELETE", headers: { "x-user-role": role || "" } }),
    onSuccess: () => { invalidate("event-deadlines-for"); qc.invalidateQueries({ queryKey: ["event-deadlines"] }); toast({ title: "דד-ליין נמחק" }); },
    onError: (e: Error) => toast({ title: e.message || "שגיאה", variant: "destructive" }),
  });
  const toggleDeadlineComplete = useMutation({
    mutationFn: ({ id, completed }: { id: number; completed: boolean }) => checkedFetch(`${API_BASE}/api/event-deadlines/${id}`, { method: "PUT", headers: authHeaders, body: JSON.stringify({ completed }) }),
    onSuccess: () => { invalidate("event-deadlines-for"); qc.invalidateQueries({ queryKey: ["event-deadlines"] }); },
    onError: (e: Error) => toast({ title: e.message || "שגיאה", variant: "destructive" }),
  });

  /* Staff */
  const [selectedStaffUser, setSelectedStaffUser] = useState("");
  const [staffRole, setStaffRole] = useState("שכבגיסט");
  const [customStaffRole, setCustomStaffRole] = useState("");
  const [staffNotes, setStaffNotes] = useState("");
  const addStaff = useMutation({
    mutationFn: () => { const finalRole = staffRole === "תפקיד אחר" ? (customStaffRole || "תפקיד אחר") : staffRole; return checkedFetch(`${API_BASE}/api/events/${eventId}/staff`, { method: "POST", headers: authHeaders, body: JSON.stringify({ userId: parseInt(selectedStaffUser), role: finalRole, notes: staffNotes || null }) }); },
    onSuccess: () => { invalidate("event-staff"); setSelectedStaffUser(""); setStaffRole("שכבגיסט"); setCustomStaffRole(""); setStaffNotes(""); toast({ title: "איש צוות נוסף" }); },
    onError: (e: Error) => toast({ title: e.message || "שגיאה", variant: "destructive" }),
  });
  const deleteStaff = useMutation({
    mutationFn: (staffId: number) => checkedFetch(`${API_BASE}/api/events/${eventId}/staff/${staffId}`, { method: "DELETE", headers: { "x-user-role": role || "" } }),
    onSuccess: () => { invalidate("event-staff"); toast({ title: "שכבגיסט הוסר" }); },
    onError: (e: Error) => toast({ title: e.message || "שגיאה", variant: "destructive" }),
  });
  const availableStaffUsers = allUsers.filter((u: any) => !eventStaff.some(s => s.userId === u.id));

  if (!eventId || !event) return <div className="flex items-center justify-center h-64 text-slate-500">טוען...</div>;
  if (event.error) return <div className="text-center py-16 text-slate-500">מפעל לא נמצא</div>;

  const doneTasks = tasks.filter(t => t.done).length;
  const openTasks = tasks.filter(t => !t.done);
  const confirmedParticipants = participants.filter(p => p.confirmed);
  const unmatchedParticipants = participants.filter(p => !p.scoutId);
  const availableScouts = allScouts.filter(s => !participants.some(p => p.scoutId === s.id));
  const tripLeader = eventStaff.find(s => s.role === "אחראי טיול");

  const myStaffRoles = user?.id ? eventStaff.filter(s => s.userId === user.id).map(s => s.role) : [];
  const allSections: Section[] = ["dashboard", "tasks", "participants", "buses", "budget", "formats", "equipment", "schedule", "menu", "portfolio", "details"];
  const visibleSections: Set<Section> = (() => {
    if (canEditEvent) return new Set(allSections);
    if (myStaffRoles.length === 0) return new Set<Section>(["dashboard"]);
    const sections = new Set<Section>();
    for (const staffRole of myStaffRoles) {
      const mapped = STAFF_ROLE_SECTIONS[staffRole];
      if (mapped) mapped.forEach(s => sections.add(s));
      else ["dashboard", "tasks"].forEach(s => sections.add(s as Section));
    }
    return sections;
  })();
  const editableSections: Set<Section> = (() => {
    if (canEditEvent) return new Set(allSections);
    const sections = new Set<Section>();
    for (const staffRole of myStaffRoles) {
      const mapped = STAFF_ROLE_SECTIONS[staffRole];
      if (mapped) mapped.filter(s => s !== "dashboard").forEach(s => sections.add(s));
    }
    return sections;
  })();
  const canEditSection = (section: Section) => editableSections.has(section);
  const canEditActive = canEditEvent || canEditSection(activeSection);
  const filteredNavItems = NAV_ITEMS.filter(item => visibleSections.has(item.id));

  const numDays = event.endDate && event.date ? Math.max(1, Math.ceil((new Date(event.endDate).getTime() - new Date(event.date).getTime()) / 86400000) + 1) : 1;
  const daysUntilEvent = event.date ? Math.max(0, Math.ceil((new Date(event.date).getTime() - Date.now()) / 86400000)) : null;
  const regPercent = event.participantsCount && event.participantsCount > 0 ? Math.round((confirmedParticipants.length / event.participantsCount) * 100) : confirmedParticipants.length > 0 ? 100 : 0;

  const participantBattalions = [...new Set(confirmedParticipants.map(p => p.scoutBattalion).filter((b): b is string => !!b))];
  const participantGrades = [...new Set(confirmedParticipants.map(p => p.scoutGrade).filter((g): g is string => !!g))];
  const filteredParticipants = confirmedParticipants.filter(p => {
    if (participantGradeFilter !== "all" && p.scoutGrade !== participantGradeFilter) return false;
    if (participantBattalionFilter !== "all" && p.scoutBattalion !== participantBattalionFilter) return false;
    if (participantMedicalFilter === "medical" && !p.scoutMedicalIssues?.trim()) return false;
    if (participantMedicalFilter === "no-medical" && !!p.scoutMedicalIssues?.trim()) return false;
    if (participantSearch) {
      const name = [p.scoutName, p.scoutLastName, p.rawName].filter(Boolean).join(" ").toLowerCase();
      if (!name.includes(participantSearch.toLowerCase())) return false;
    }
    return true;
  });

  const totalPlanned = budgetItems.reduce((s, b) => s + (parseFloat(b.plannedAmount) || 0), 0);
  const totalActual = budgetItems.reduce((s, b) => s + (parseFloat(b.actualAmount) || 0), 0);
  const upcomingDeadlines = eventDeadlines.filter(d => !d.completed).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 4);

  return (
    <div className="flex min-h-[calc(100vh-4rem)]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-white border-l border-slate-100 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto hidden lg:block">
        <div className="px-5 pt-6 pb-4">
          <button onClick={() => setLocation("/logistics/events")} className="flex items-center gap-2 text-slate-500 hover:text-[#00327d] text-xs font-medium mb-4 transition-colors">
            <ArrowRight className="w-3.5 h-3.5" /> כל המפעלים
          </button>
          <h3 className="font-extrabold text-[#00327d] text-sm truncate" style={{ fontFamily: "'Manrope', sans-serif" }}>{event.name}</h3>
          <p className="text-[10px] text-slate-500 mt-0.5">{EVENT_TYPES[event.eventType || ""] || event.eventType || ""}</p>
        </div>
        <nav className="px-3 space-y-0.5">
          {(() => {
            let lastGroup = "";
            return filteredNavItems.map(item => {
              const showGroup = item.group && item.group !== lastGroup;
              lastGroup = item.group;
              const isActive = activeSection === item.id;
              return (
                <div key={item.id}>
                  {showGroup && <div className="pt-4 pb-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.group}</div>}
                  <button
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${isActive ? "bg-[#00327d] text-white shadow-md shadow-[#00327d]/15" : "text-slate-500 hover:text-[#00327d] hover:bg-blue-50/50"}`}
                  >
                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </button>
                </div>
              );
            });
          })()}
        </nav>
      </aside>

      {/* Mobile nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-50 flex overflow-x-auto px-2 py-1.5 gap-1">
        {filteredNavItems.filter(n => ["dashboard", "tasks", "participants", "buses", "budget"].includes(n.id)).map(item => (
          <button key={item.id} onClick={() => { setActiveSection(item.id); setMobileMenuOpen(false); }} className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-[10px] min-w-[52px] transition-all ${activeSection === item.id ? "bg-[#00327d] text-white" : "text-slate-500"}`}>
            <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-[10px] min-w-[52px] ${mobileMenuOpen ? "bg-[#00327d] text-white" : "text-slate-500"}`}>
          <MoreHorizontal className="w-[18px] h-[18px]" />
          <span>עוד</span>
        </button>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute bottom-16 left-4 right-4 bg-white rounded-2xl shadow-2xl p-4 grid grid-cols-3 gap-3" onClick={e => e.stopPropagation()}>
            {filteredNavItems.filter(n => !["dashboard", "tasks", "participants", "buses", "budget"].includes(n.id)).map(item => (
              <button key={item.id} onClick={() => { setActiveSection(item.id); setMobileMenuOpen(false); }} className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs transition-all ${activeSection === item.id ? "bg-[#00327d] text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 pb-20 lg:pb-8">
        {/* DASHBOARD */}
        {activeSection === "dashboard" && (
          <div className="p-6 lg:p-8 max-w-[1200px] space-y-8">
            {/* Hero */}
            <section className="relative p-8 lg:p-10 rounded-[2rem] text-white overflow-hidden shadow-2xl shadow-[#00327d]/20" style={{ background: "linear-gradient(135deg, #00327d 0%, #0047ab 100%)" }}>
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
              <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="max-w-xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-[11px] font-bold tracking-wider mb-4 border border-white/10">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    סטטוס פעיל: {event.name}
                  </div>
                  <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight mb-3" style={{ fontFamily: "'Manrope', sans-serif" }}>ניהול {event.name}</h1>
                  <p className="text-white/70 text-base leading-relaxed">{event.description || "מרכז השליטה המבצעי של שבט רמת גן. עקביות ומסורת בכל שלב."}</p>
                </div>
                <div className="flex gap-4">
                  {daysUntilEvent !== null && (
                    <div className="bg-white/10 backdrop-blur-md px-6 py-5 rounded-2xl border border-white/10 text-center min-w-[110px]">
                      <div className="text-[10px] uppercase tracking-widest font-bold text-white/60 mb-1">ימים למפעל</div>
                      <div className="text-3xl font-extrabold" style={{ fontFamily: "'Manrope', sans-serif" }}>{daysUntilEvent}</div>
                    </div>
                  )}
                  <div className="bg-white/10 backdrop-blur-md px-6 py-5 rounded-2xl border border-white/10 text-center min-w-[110px]">
                    <div className="text-[10px] uppercase tracking-widest font-bold text-white/60 mb-1">אחוזי רישום</div>
                    <div className="text-3xl font-extrabold" style={{ fontFamily: "'Manrope', sans-serif" }}>{regPercent}<span className="text-lg opacity-60">%</span></div>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-12 gap-6">
              {/* Tasks column */}
              <div className="col-span-12 lg:col-span-8 space-y-6">
                {/* Open tasks card */}
                <div className="bg-white rounded-[2rem] p-6 lg:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_15px_-3px_rgba(0,0,0,0.03)] border border-slate-100">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#00327d]">
                        <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>assignment</span>
                      </div>
                      <h2 className="text-xl font-bold" style={{ fontFamily: "'Manrope', sans-serif" }}>משימות פתוחות</h2>
                    </div>
                    <button onClick={() => setActiveSection("tasks")} className="px-4 py-1.5 text-[#00327d] font-bold text-sm hover:bg-blue-50 rounded-xl transition-all">צפה בכל ({tasks.length})</button>
                  </div>

                  {canEditEvent && (
                    <div className="flex gap-2 mb-5 flex-wrap">
                      <Input placeholder="משימה חדשה..." value={newTask} onChange={e => setNewTask(e.target.value)} className="flex-1 min-w-[200px] h-10 rounded-xl bg-slate-50 border-slate-200" onKeyDown={e => { if (e.key === "Enter" && newTask.trim()) addTask.mutate({ title: newTask.trim(), priority: "normal", assignee: taskAssignee || null, assignedToUserId: taskAssignee ? (allUsers.find((u: any) => u.name === taskAssignee)?.id || null) : null, dueDate: null }); }} />
                      <Select value={taskAssignee} onValueChange={setTaskAssignee}>
                        <SelectTrigger className="w-36 h-10 rounded-xl"><SelectValue placeholder="מסור ל..." /></SelectTrigger>
                        <SelectContent>{allUsers.map((u: any) => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button className="h-10 px-4 rounded-xl bg-[#00327d] hover:bg-[#00327d]/90" disabled={!newTask.trim()} onClick={() => addTask.mutate({ title: newTask.trim(), priority: "normal", assignee: taskAssignee || null, assignedToUserId: taskAssignee ? (allUsers.find((u: any) => u.name === taskAssignee)?.id || null) : null, dueDate: null })}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  <div className="space-y-3">
                    {openTasks.slice(0, 5).map(task => {
                      const assignedUser = task.assignedToUserId ? allUsers.find((u: any) => u.id === task.assignedToUserId) : null;
                      return (
                        <div key={task.id} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50/50 border border-slate-100 hover:border-[#00327d]/20 transition-all group">
                          <button onClick={() => toggleTask.mutate({ taskId: task.id, done: true })} className="w-6 h-6 border-2 border-slate-300 rounded-lg flex items-center justify-center hover:border-[#00327d] transition-colors shrink-0">
                            <Check className="w-3.5 h-3.5 text-transparent group-hover:text-slate-200" />
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm text-slate-800">{task.title}</div>
                            {(task.assignee || assignedUser) && <div className="text-[11px] text-slate-500 mt-0.5">אחראי: {assignedUser?.name || task.assignee}</div>}
                          </div>
                          {canEditEvent && (
                            <button onClick={() => deleteTask.mutate(task.id)} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {tasks.filter(t => t.done).slice(0, 2).map(task => (
                      <div key={task.id} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-transparent opacity-60">
                        <div className="w-6 h-6 bg-[#00327d] text-white flex items-center justify-center rounded-lg shrink-0">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1"><div className="font-bold text-sm text-slate-800 line-through decoration-slate-400">{task.title}</div></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick access cards row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Buses card */}
                  <div className="bg-white rounded-3xl p-5 text-center shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_15px_-3px_rgba(0,0,0,0.03)] border border-slate-100 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer group" onClick={() => setActiveSection("buses")}>
                    <div className="w-12 h-12 bg-blue-50 text-[#00327d] rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                      <Bus className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-slate-800 mb-1 text-sm">אוטובוסים</h3>
                    <p className="text-[11px] text-slate-500 mb-3">{buses.length} רכבים</p>
                    <div className="py-1.5 bg-slate-100 hover:bg-[#00327d] hover:text-white rounded-xl text-[11px] font-bold transition-all">נהל רכבים</div>
                  </div>

                  {/* Participants card */}
                  <div className="bg-white rounded-3xl p-5 text-center shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_15px_-3px_rgba(0,0,0,0.03)] border border-slate-100 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer group" onClick={() => setActiveSection("participants")}>
                    <div className="w-12 h-12 bg-red-50 text-[#b6171e] rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                      <Users className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-slate-800 mb-1 text-sm">רשומים</h3>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full my-2 overflow-hidden">
                      <div className="bg-[#b6171e] h-full rounded-full transition-all" style={{ width: `${Math.min(regPercent, 100)}%` }} />
                    </div>
                    <p className="text-[11px] text-slate-500 font-bold mb-3">{confirmedParticipants.length}{event.participantsCount ? ` / ${event.participantsCount}` : ""} חניכים</p>
                    <div className="py-1.5 bg-slate-100 hover:bg-[#b6171e] hover:text-white rounded-xl text-[11px] font-bold transition-all">דו"ח שמי</div>
                  </div>

                  {/* Trip leader card */}
                  <div className="bg-white rounded-3xl p-5 text-center shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_15px_-3px_rgba(0,0,0,0.03)] border border-slate-100">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#00327d] to-[#0047ab] text-white rounded-2xl flex items-center justify-center mx-auto mb-3 font-bold text-lg shadow-md">
                      {tripLeader ? (tripLeader.userName || "?")[0] : "?"}
                    </div>
                    <h3 className="font-bold text-slate-800 mb-1 text-sm">אחראי טיול</h3>
                    <p className="text-[11px] text-slate-500 mb-3">{tripLeader ? `${tripLeader.userName} (${tripLeader.userGrade || ""})` : "לא שובץ"}</p>
                    {tripLeader ? (
                      <div className="py-1.5 bg-[#00327d] text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5">
                        <Phone className="w-3 h-3" /> צור קשר
                      </div>
                    ) : canEditEvent ? (
                      <button onClick={() => setActiveSection("details")} className="w-full py-1.5 bg-slate-100 hover:bg-[#00327d] hover:text-white rounded-xl text-[11px] font-bold transition-all">שבץ אחראי</button>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Side column */}
              <div className="col-span-12 lg:col-span-4 space-y-6">
                {/* Deadlines card */}
                <div className="bg-white rounded-[2rem] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_15px_-3px_rgba(0,0,0,0.03)] border border-slate-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                      <Target className="w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-bold" style={{ fontFamily: "'Manrope', sans-serif" }}>דד-ליינים קרובים</h2>
                  </div>
                  <div className="space-y-5">
                    {upcomingDeadlines.length === 0 && <p className="text-sm text-slate-500 text-center py-4">אין דד-ליינים קרובים</p>}
                    {upcomingDeadlines.map(d => {
                      const dt = new Date(d.date);
                      const isPast = dt < new Date();
                      const monthNames = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];
                      const daysLeft = Math.ceil((dt.getTime() - Date.now()) / 86400000);
                      return (
                        <div key={d.id} className="flex items-start gap-3">
                          <div className="flex flex-col items-center min-w-[44px] py-1.5 px-1 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-[9px] font-bold text-slate-500">{monthNames[dt.getMonth()]}</span>
                            <span className={`text-lg font-extrabold ${isPast ? "text-[#b6171e]" : "text-slate-800"}`}>{dt.getDate()}</span>
                          </div>
                          <div>
                            <div className="font-bold text-sm text-slate-800 leading-snug">{d.title}</div>
                            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {isPast ? <span className="text-[#b6171e] font-bold">עבר!</span> : `בעוד ${daysLeft} ימים`}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button onClick={() => setActiveSection("tasks")} className="w-full mt-6 py-2.5 border border-dashed border-slate-300 text-slate-500 rounded-2xl text-[11px] font-bold hover:bg-slate-50 transition-all">צפה ביומן המלא</button>
                </div>

                {/* Quick links grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "formats" as Section, icon: "description", label: "פורמטים" },
                    { id: "equipment" as Section, icon: "inventory_2", label: "ציוד" },
                    { id: "schedule" as Section, icon: "calendar_today", label: "לו״ז טיול" },
                    { id: "menu" as Section, icon: "restaurant", label: "תפריט" },
                  ].map(item => (
                    <button key={item.id} onClick={() => setActiveSection(item.id)} className="bg-white p-4 rounded-2xl flex flex-col items-center text-center gap-2 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_15px_-3px_rgba(0,0,0,0.03)] border border-slate-100 hover:bg-blue-50 hover:border-[#00327d]/10 transition-all group">
                      <span className="material-symbols-outlined text-[#00327d] group-hover:scale-110 transition-transform">{item.icon}</span>
                      <span className="font-bold text-xs text-slate-800">{item.label}</span>
                    </button>
                  ))}
                  <button onClick={() => setActiveSection("portfolio")} className="col-span-2 bg-white p-4 rounded-2xl flex flex-col items-center text-center gap-2 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_15px_-3px_rgba(0,0,0,0.03)] border border-slate-100 hover:bg-red-50 hover:border-[#b6171e]/10 transition-all group">
                    <span className="material-symbols-outlined text-[#b6171e] group-hover:scale-110 transition-transform">history_edu</span>
                    <span className="font-bold text-xs text-slate-800">תיק הדרכה מלא</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TASKS section */}
        {activeSection === "tasks" && (
          <div className="p-6 lg:p-8 max-w-[1000px] space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-extrabold text-[#00327d]" style={{ fontFamily: "'Manrope', sans-serif" }}>משימות ודד-ליינים</h2>
              <Badge className="bg-blue-50 text-[#00327d] border-0 text-xs">{tasks.length} משימות · {eventDeadlines.length} דד-ליינים</Badge>
            </div>

            {canEditActive && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-3">
                <p className="text-xs font-bold text-slate-500">הוסף משימה חדשה</p>
                <div className="flex gap-2 flex-wrap">
                  <Input placeholder="תיאור המשימה..." value={newTask} onChange={e => setNewTask(e.target.value)} className="flex-1 min-w-[200px] h-10 rounded-xl" />
                  <Select value={taskAssignee} onValueChange={setTaskAssignee}>
                    <SelectTrigger className="w-36 h-10 rounded-xl"><SelectValue placeholder="מסור ל..." /></SelectTrigger>
                    <SelectContent>{allUsers.map((u: any) => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button className="h-10 px-5 rounded-xl bg-[#00327d]" disabled={!newTask.trim()} onClick={() => addTask.mutate({ title: newTask.trim(), priority: "normal", assignee: taskAssignee || null, assignedToUserId: taskAssignee ? (allUsers.find((u: any) => u.name === taskAssignee)?.id || null) : null, dueDate: null })}>
                    <Plus className="w-4 h-4 ml-1" /> הוסף
                  </Button>
                </div>
              </div>
            )}

            {/* All tasks */}
            <div className="space-y-2">
              {tasks.map(task => {
                const assignedUser = task.assignedToUserId ? allUsers.find((u: any) => u.id === task.assignedToUserId) : null;
                return (
                  <div key={task.id} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all group ${task.done ? "bg-slate-50 border-transparent opacity-60" : "bg-white border-slate-100 hover:border-[#00327d]/20"}`}>
                    <button onClick={() => toggleTask.mutate({ taskId: task.id, done: !task.done })} className={`w-6 h-6 border-2 rounded-lg flex items-center justify-center shrink-0 transition-colors ${task.done ? "bg-[#00327d] border-[#00327d] text-white" : "border-slate-300 hover:border-[#00327d]"}`}>
                      {task.done && <Check className="w-3.5 h-3.5" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold text-sm ${task.done ? "line-through text-slate-500" : "text-slate-800"}`}>{task.title}</div>
                      {(task.assignee || assignedUser) && <div className="text-[11px] text-slate-500 mt-0.5">אחראי: {assignedUser?.name || task.assignee}</div>}
                    </div>
                    {canEditActive && <button onClick={() => deleteTask.mutate(task.id)} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                );
              })}
            </div>

            {/* Deadlines section */}
            <div className="mt-8">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
                <Target className="w-5 h-5 text-orange-500" /> דד-ליינים
              </h3>
              {canEditActive && (
                <div className="bg-white rounded-2xl p-4 border border-slate-100 mb-4">
                  <div className="flex gap-2 flex-wrap">
                    <Input placeholder="דד-ליין חדש..." value={newDeadline.title} onChange={e => setNewDeadline(p => ({ ...p, title: e.target.value }))} className="flex-1 min-w-[180px] h-9 rounded-xl" />
                    <Input type="date" value={newDeadline.date} onChange={e => setNewDeadline(p => ({ ...p, date: e.target.value }))} className="w-36 h-9 rounded-xl" />
                    <Input placeholder="אחראי" value={newDeadline.responsiblePerson} onChange={e => setNewDeadline(p => ({ ...p, responsiblePerson: e.target.value }))} className="w-28 h-9 rounded-xl" />
                    <Button className="h-9 px-4 rounded-xl bg-[#00327d]" disabled={!newDeadline.title || !newDeadline.date} onClick={() => {
                      const data = { title: newDeadline.title, date: new Date(newDeadline.date).toISOString(), responsiblePerson: newDeadline.responsiblePerson || null, notes: null };
                      if (editDeadlineId) updateDeadline.mutate({ id: editDeadlineId, data }); else addDeadline.mutate(data);
                    }}><Plus className="w-4 h-4" /></Button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {eventDeadlines.map(d => {
                  const isPast = new Date(d.date) < new Date() && !d.completed;
                  return (
                    <div key={d.id} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${d.completed ? "bg-green-50/50 border-green-100 opacity-60" : isPast ? "bg-red-50/50 border-red-100" : "bg-white border-slate-100"}`}>
                      {canEditActive && <Checkbox checked={!!d.completed} onCheckedChange={(c) => toggleDeadlineComplete.mutate({ id: d.id, completed: !!c })} />}
                      <div className="flex-1">
                        <div className={`font-bold text-sm ${d.completed ? "line-through text-slate-500" : ""}`}>{d.title}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{new Date(d.date).toLocaleDateString("he-IL")}{d.responsiblePerson && ` · ${d.responsiblePerson}`}</div>
                      </div>
                      {d.completed && <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">הושלם</Badge>}
                      {isPast && <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">באיחור</Badge>}
                      {!d.completed && !isPast && <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">ממתין</Badge>}
                      {canEditActive && <button onClick={() => { if (confirm("למחוק?")) deleteDeadline.mutate(d.id); }} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* PARTICIPANTS section */}
        {activeSection === "participants" && (
          <div className="p-6 lg:p-8 max-w-[1100px] space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-2xl font-extrabold text-[#00327d]" style={{ fontFamily: "'Manrope', sans-serif" }}>רשומים</h2>
              <div className="flex items-center gap-3">
                <Badge className="bg-blue-50 text-[#00327d] border-0">{confirmedParticipants.length} מאושרים</Badge>
                {unmatchedParticipants.length > 0 && <Badge className="bg-amber-50 text-amber-700 border-0">{unmatchedParticipants.length} ללא התאמה</Badge>}
              </div>
            </div>

            {canEditActive && <ExcelImportPanel eventId={eventId!} onImportDone={() => invalidate("event-participants")} />}

            {canEditActive && (
              <div className="flex gap-2 flex-wrap items-end">
                <div className="flex-1 min-w-[200px]">
                  <Select value={selectedScout} onValueChange={setSelectedScout}>
                    <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="הוסף חניך ידנית..." /></SelectTrigger>
                    <SelectContent>{availableScouts.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name} {s.lastName || ""}{s.grade ? ` (${s.grade})` : ""}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button className="h-10 rounded-xl bg-[#00327d]" disabled={!selectedScout} onClick={() => addParticipant.mutate(parseInt(selectedScout))}>
                  <Plus className="w-4 h-4 ml-1" /> הוסף
                </Button>
              </div>
            )}

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="חיפוש שם..." value={participantSearch} onChange={e => setParticipantSearch(e.target.value)} className="pr-9 h-9 rounded-xl" />
              </div>
              {participantGrades.length > 1 && (
                <Select value={participantGradeFilter} onValueChange={setParticipantGradeFilter}>
                  <SelectTrigger className="w-28 h-9 rounded-xl"><SelectValue placeholder="כיתה" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">כל הכיתות</SelectItem>{participantGrades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              )}
              {participantBattalions.length > 1 && (
                <Select value={participantBattalionFilter} onValueChange={setParticipantBattalionFilter}>
                  <SelectTrigger className="w-28 h-9 rounded-xl"><SelectValue placeholder="גדוד" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">כל הגדודים</SelectItem>{participantBattalions.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              )}
              <Select value={participantMedicalFilter} onValueChange={setParticipantMedicalFilter}>
                <SelectTrigger className="w-32 h-9 rounded-xl"><SelectValue placeholder="רפואי" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">הכל</SelectItem>
                  <SelectItem value="medical">עם בעיות רפואיות</SelectItem>
                  <SelectItem value="no-medical">ללא בעיות רפואיות</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Participant list */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="text-right p-3 font-medium text-slate-600 text-xs">שם</th>
                    <th className="text-right p-3 font-medium text-slate-600 text-xs">כיתה</th>
                    <th className="text-right p-3 font-medium text-slate-600 text-xs">גדוד</th>
                    <th className="text-right p-3 font-medium text-slate-600 text-xs">אוטובוס</th>
                    <th className="text-right p-3 font-medium text-slate-600 text-xs">בעיות רפואיות</th>
                    {canEditActive && <th className="w-10"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredParticipants.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 font-medium">{p.scoutName} {p.scoutLastName || ""}{!p.scoutId && <span className="text-amber-600 text-xs mr-1">({p.rawName})</span>}</td>
                      <td className="p-3 text-slate-600">{p.scoutGrade || "—"}</td>
                      <td className="p-3 text-slate-600">{p.scoutBattalion || "—"}</td>
                      <td className="p-3">
                        {buses.length > 0 ? (
                          <Select value={p.busId ? String(p.busId) : ""} onValueChange={v => updateParticipantBus.mutate({ pid: p.id, busId: v ? parseInt(v) : null })}>
                            <SelectTrigger className="h-7 w-28 text-xs rounded-lg"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>{buses.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}</SelectContent>
                          </Select>
                        ) : "—"}
                      </td>
                      <td className="p-3">{p.scoutMedicalIssues ? <span className="text-red-600 text-xs">⚕ {p.scoutMedicalIssues}</span> : <span className="text-slate-400 text-xs">—</span>}</td>
                      {canEditActive && <td className="p-3"><button onClick={() => removeParticipant.mutate(p.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {unmatchedParticipants.length > 0 && (
              <div className="bg-amber-50 rounded-2xl p-5 space-y-3">
                <p className="font-bold text-sm text-amber-800">משתתפים ללא התאמה ({unmatchedParticipants.length})</p>
                {unmatchedParticipants.map(p => <UnmatchedRow key={p.id} participant={p} availableScouts={availableScouts} onAttach={(pid, sid) => fetch(`${API_BASE}/api/events/${eventId}/participants/${pid}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scoutId: sid }) }).then(() => invalidate("event-participants"))} onRemove={() => removeParticipant.mutate(p.id)} />)}
              </div>
            )}
          </div>
        )}

        {/* BUSES section */}
        {activeSection === "buses" && !showPrintSigns && (
          <div className="p-6 lg:p-8 max-w-[1000px] space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-2xl font-extrabold text-[#00327d]" style={{ fontFamily: "'Manrope', sans-serif" }}>אוטובוסים</h2>
              {buses.length > 0 && (
                <Button variant="outline" className="h-9 rounded-xl text-sm gap-1.5" onClick={() => setShowPrintSigns(true)}>
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  הדפס שלטים
                </Button>
              )}
            </div>

            {canEditActive && (
              <div className="bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-2xl p-5 border border-blue-200/50 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#00327d]">auto_fix_high</span>
                  <h3 className="font-bold text-sm text-[#00327d]">שיבוץ אוטומטי</h3>
                </div>
                <p className="text-xs text-slate-600">מחלק משתתפים לאוטובוסים לפי שכבה וגדוד — לא מערבב שכבות, משאיר מקום לבוגרים</p>
                <div className="flex gap-2 flex-wrap items-end">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">קיבולת אוטובוס</label>
                    <Input type="number" value={autoAssignCap} onChange={e => setAutoAssignCap(e.target.value)} className="w-24 h-9 rounded-xl" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">מקומות לבוגרים</label>
                    <Input type="number" value={autoAssignReserve} onChange={e => setAutoAssignReserve(e.target.value)} className="w-24 h-9 rounded-xl" />
                  </div>
                  <Button className="h-9 rounded-xl bg-[#00327d]" disabled={autoAssignBuses.isPending || participants.length === 0} onClick={() => { if (buses.length > 0 && !confirm("שיבוץ אוטומטי ימחק את כל האוטובוסים הקיימים ויצור חדשים. להמשיך?")) return; autoAssignBuses.mutate(); }}>
                    {autoAssignBuses.isPending ? "משבץ..." : "שבץ אוטומטית"}
                  </Button>
                </div>
                {participants.length === 0 && <p className="text-xs text-amber-600">יש להוסיף משתתפים קודם</p>}
              </div>
            )}

            {canEditActive && (
              <div className="bg-white rounded-2xl p-5 border border-slate-100 space-y-3">
                <p className="text-xs font-bold text-slate-500">הוסף אוטובוס ידנית</p>
                <div className="flex gap-2 flex-wrap">
                  <Input placeholder="שם אוטובוס *" value={newBus.name} onChange={e => setNewBus(p => ({ ...p, name: e.target.value }))} className="flex-1 min-w-[150px] h-10 rounded-xl" />
                  <Input placeholder="קיבולת" type="number" value={newBus.capacity} onChange={e => setNewBus(p => ({ ...p, capacity: e.target.value }))} className="w-24 h-10 rounded-xl" />
                  <Input placeholder="שם נהג" value={newBus.driverName} onChange={e => setNewBus(p => ({ ...p, driverName: e.target.value }))} className="w-32 h-10 rounded-xl" />
                  <Input placeholder="שעת יציאה" value={newBus.departureTime} onChange={e => setNewBus(p => ({ ...p, departureTime: e.target.value }))} className="w-28 h-10 rounded-xl" />
                  <Input placeholder="נקודת מפגש" value={newBus.meetingPoint} onChange={e => setNewBus(p => ({ ...p, meetingPoint: e.target.value }))} className="w-32 h-10 rounded-xl" />
                  <Button className="h-10 rounded-xl bg-[#00327d]" disabled={!newBus.name} onClick={() => addBus.mutate()}><Plus className="w-4 h-4 ml-1" /> הוסף</Button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {buses.map(b => {
                const assigned = participants.filter(p => p.busId === b.id);
                return (
                  <div key={b.id} className="bg-white rounded-2xl p-5 border border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 text-[#00327d] rounded-xl flex items-center justify-center font-extrabold text-lg" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          {b.name.match(/\d+/)?.[0] || <Bus className="w-5 h-5" />}
                        </div>
                        <div>
                          <h3 className="font-bold text-sm">{b.name}</h3>
                          <p className="text-[11px] text-slate-500">{assigned.length}{b.capacity ? `/${b.capacity}` : ""} נוסעים</p>
                        </div>
                      </div>
                      {canEditActive && <button onClick={() => deleteBus.mutate(b.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                    {b.notes && <p className="text-xs text-slate-500">{b.notes}</p>}
                    {b.driverName && <p className="text-xs text-slate-600">נהג: {b.driverName}</p>}
                    {b.departureTime && <p className="text-xs text-slate-600">יציאה: {b.departureTime}</p>}
                    {b.meetingPoint && <p className="text-xs text-slate-600">מפגש: {b.meetingPoint}</p>}
                    {assigned.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {assigned.map(p => <span key={p.id} className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full">{p.scoutName} {p.scoutLastName?.[0] || ""}{p.scoutGrade ? ` (${p.scoutGrade})` : ""}</span>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PRINT BUS SIGNS */}
        {activeSection === "buses" && showPrintSigns && (
          <div className="p-6 lg:p-8">
            <div className="flex items-center justify-between mb-6 print:hidden">
              <h2 className="text-2xl font-extrabold text-[#00327d]" style={{ fontFamily: "'Manrope', sans-serif" }}>שלטי אוטובוסים</h2>
              <div className="flex gap-2">
                <Button variant="outline" className="h-9 rounded-xl" onClick={() => setShowPrintSigns(false)}>חזרה</Button>
                <Button className="h-9 rounded-xl bg-[#00327d] gap-1.5" onClick={() => window.print()}>
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  הדפס
                </Button>
              </div>
            </div>
            <div className="space-y-8">
              {buses.map(b => {
                const assigned = participants.filter(p => p.busId === b.id);
                return (
                  <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-8 break-inside-avoid print:border-2 print:border-black print:rounded-none print:p-6">
                    <div className="text-center border-b-2 border-[#00327d] pb-4 mb-4 print:border-black">
                      <div className="text-6xl font-extrabold text-[#00327d] print:text-black" style={{ fontFamily: "'Manrope', sans-serif" }}>{b.name}</div>
                      {event?.name && <p className="text-lg font-bold mt-2 text-slate-700">{event.name}</p>}
                      {b.notes && <p className="text-base text-slate-600 mt-1">{b.notes}</p>}
                    </div>
                    <div className="text-sm font-bold text-slate-600 mb-3">{assigned.length} נוסעים{b.capacity ? ` (קיבולת: ${b.capacity})` : ""}</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1">
                      {assigned.sort((a, b2) => {
                        const na = [a.scoutName, a.scoutLastName].filter(Boolean).join(" ");
                        const nb = [b2.scoutName, b2.scoutLastName].filter(Boolean).join(" ");
                        return na.localeCompare(nb, "he");
                      }).map((p, i) => (
                        <div key={p.id} className="flex items-center gap-2 py-0.5 text-sm">
                          <span className="text-slate-400 text-xs w-5 text-left">{i + 1}.</span>
                          <span className="font-medium">{p.scoutName} {p.scoutLastName || ""}</span>
                          {p.scoutGrade && <span className="text-xs text-slate-500">({p.scoutGrade})</span>}
                        </div>
                      ))}
                    </div>
                    {b.driverName && <p className="text-xs text-slate-500 mt-4 pt-2 border-t border-slate-200">נהג: {b.driverName}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* BUDGET section */}
        {activeSection === "budget" && (
          <div className="p-6 lg:p-8 max-w-[1000px] space-y-6">
            <h2 className="text-2xl font-extrabold text-[#00327d]" style={{ fontFamily: "'Manrope', sans-serif" }}>תקציב</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-100 text-center">
                <p className="text-[10px] text-slate-500 font-bold mb-1">מתוכנן</p>
                <p className="text-2xl font-extrabold text-[#00327d]">₪{totalPlanned.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-slate-100 text-center">
                <p className="text-[10px] text-slate-500 font-bold mb-1">בוצע</p>
                <p className="text-2xl font-extrabold text-slate-800">₪{totalActual.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-slate-100 text-center">
                <p className="text-[10px] text-slate-500 font-bold mb-1">יתרה</p>
                <p className={`text-2xl font-extrabold ${totalPlanned - totalActual >= 0 ? "text-green-600" : "text-red-600"}`}>₪{(totalPlanned - totalActual).toLocaleString()}</p>
              </div>
            </div>
            {canEditActive && (
              <div className="bg-white rounded-2xl p-5 border border-slate-100">
                <div className="flex gap-2 flex-wrap">
                  <Input placeholder="תיאור *" value={newBudgetItem.description} onChange={e => setNewBudgetItem(p => ({ ...p, description: e.target.value }))} className="flex-1 min-w-[150px] h-10 rounded-xl" />
                  <Select value={newBudgetItem.type} onValueChange={v => setNewBudgetItem(p => ({ ...p, type: v }))}>
                    <SelectTrigger className="w-28 h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">הוצאה</SelectItem>
                      <SelectItem value="income">הכנסה</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={newBudgetItem.category} onValueChange={v => setNewBudgetItem(p => ({ ...p, category: v }))}>
                    <SelectTrigger className="w-28 h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">כללי</SelectItem>
                      <SelectItem value="transport">הסעות</SelectItem>
                      <SelectItem value="food">אוכל</SelectItem>
                      <SelectItem value="equipment">ציוד</SelectItem>
                      <SelectItem value="venue">מקום</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="תכנון ₪" type="number" value={newBudgetItem.plannedAmount} onChange={e => setNewBudgetItem(p => ({ ...p, plannedAmount: e.target.value }))} className="w-28 h-10 rounded-xl" />
                  <Input placeholder="ביצוע ₪" type="number" value={newBudgetItem.actualAmount} onChange={e => setNewBudgetItem(p => ({ ...p, actualAmount: e.target.value }))} className="w-28 h-10 rounded-xl" />
                  <Button className="h-10 rounded-xl bg-[#00327d]" disabled={!newBudgetItem.description} onClick={() => addBudgetItem.mutate()}><Plus className="w-4 h-4" /></Button>
                </div>
              </div>
            )}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="text-right p-3 font-medium text-slate-600 text-xs">תיאור</th>
                    <th className="text-right p-3 font-medium text-slate-600 text-xs">קטגוריה</th>
                    <th className="text-right p-3 font-medium text-slate-600 text-xs">תכנון</th>
                    <th className="text-right p-3 font-medium text-slate-600 text-xs">ביצוע</th>
                    {canEditActive && <th className="w-10"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {budgetItems.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-medium">{b.description}</td>
                      <td className="p-3 text-slate-600">{b.category}</td>
                      <td className="p-3">₪{parseFloat(b.plannedAmount || "0").toLocaleString()}</td>
                      <td className="p-3">
                        {canEditActive ? (
                          <Input value={b.actualAmount} onChange={e => updateBudgetItem.mutate({ id: b.id, actualAmount: e.target.value })} className="h-7 w-24 text-xs rounded-lg" />
                        ) : `₪${parseFloat(b.actualAmount || "0").toLocaleString()}`}
                      </td>
                      {canEditActive && <td className="p-3"><button onClick={() => deleteBudgetItem.mutate(b.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* FORMATS section */}
        {activeSection === "formats" && (
          <div className="p-6 lg:p-8 max-w-[1000px] space-y-6">
            <h2 className="text-2xl font-extrabold text-[#00327d]" style={{ fontFamily: "'Manrope', sans-serif" }}>פורמטים</h2>
            {canEditActive && (
              <div className="bg-white rounded-2xl p-5 border border-slate-100">
                <div className="flex gap-2 flex-wrap">
                  <Input placeholder="שם פורמט *" value={newFormat.title} onChange={e => setNewFormat(p => ({ ...p, title: e.target.value }))} className="flex-1 min-w-[150px] h-10 rounded-xl" />
                  <Input placeholder="משך" value={newFormat.duration} onChange={e => setNewFormat(p => ({ ...p, duration: e.target.value }))} className="w-24 h-10 rounded-xl" />
                  <Input placeholder="אחראי" value={newFormat.responsible} onChange={e => setNewFormat(p => ({ ...p, responsible: e.target.value }))} className="w-32 h-10 rounded-xl" />
                  <Button className="h-10 rounded-xl bg-[#00327d]" disabled={!newFormat.title} onClick={() => addFormat.mutate()}><Plus className="w-4 h-4 ml-1" /> הוסף</Button>
                </div>
              </div>
            )}
            <div className="space-y-3">
              {formats.map(f => (
                <div key={f.id} className="bg-white rounded-2xl p-5 border border-slate-100 flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-sm">{f.title}</h3>
                    <div className="text-xs text-slate-500 mt-1 flex gap-3">
                      {f.duration && <span>משך: {f.duration}</span>}
                      {f.responsible && <span>אחראי: {f.responsible}</span>}
                    </div>
                    {f.description && <p className="text-xs text-slate-600 mt-2">{f.description}</p>}
                  </div>
                  {canEditActive && <button onClick={() => deleteFormat.mutate(f.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EQUIPMENT section */}
        {activeSection === "equipment" && (
          <div className="p-6 lg:p-8 max-w-[1000px] space-y-6">
            <h2 className="text-2xl font-extrabold text-[#00327d]" style={{ fontFamily: "'Manrope', sans-serif" }}>ציוד</h2>
            {canEditActive && (
              <div className="bg-white rounded-2xl p-5 border border-slate-100">
                <div className="flex gap-2 flex-wrap">
                  <Input placeholder="פריט *" value={newEquipment.name} onChange={e => setNewEquipment(p => ({ ...p, name: e.target.value }))} className="flex-1 min-w-[150px] h-10 rounded-xl" />
                  <Input placeholder="כמות" type="number" value={newEquipment.quantity} onChange={e => setNewEquipment(p => ({ ...p, quantity: e.target.value }))} className="w-20 h-10 rounded-xl" />
                  <Select value={newEquipment.category} onValueChange={v => setNewEquipment(p => ({ ...p, category: v }))}>
                    <SelectTrigger className="w-32 h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">כללי</SelectItem>
                      <SelectItem value="logistics">לוגיסטי</SelectItem>
                      <SelectItem value="hadracha">הדרכתי</SelectItem>
                      <SelectItem value="medical">רפואי</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="אחראי" value={newEquipment.responsible} onChange={e => setNewEquipment(p => ({ ...p, responsible: e.target.value }))} className="w-28 h-10 rounded-xl" />
                  <Button className="h-10 rounded-xl bg-[#00327d]" disabled={!newEquipment.name} onClick={() => addEquipment.mutate()}><Plus className="w-4 h-4" /></Button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              {equipment.map(e => (
                <div key={e.id} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${e.checked ? "bg-green-50/50 border-green-100" : "bg-white border-slate-100"}`}>
                  <Checkbox checked={e.checked} onCheckedChange={(c) => toggleEquipment.mutate({ id: e.id, checked: !!c })} />
                  <div className="flex-1">
                    <span className={`font-bold text-sm ${e.checked ? "line-through text-slate-500" : ""}`}>{e.name}</span>
                    <span className="text-xs text-slate-500 mr-2">x{e.quantity}</span>
                    {e.responsible && <span className="text-xs text-slate-500 mr-2">· {e.responsible}</span>}
                  </div>
                  <Badge className="bg-slate-100 text-slate-600 border-0 text-[10px]">{e.category}</Badge>
                  {canEditActive && <button onClick={() => deleteEquipment.mutate(e.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SCHEDULE section */}
        {activeSection === "schedule" && (
          <div className="p-6 lg:p-8 max-w-[1100px] space-y-6">
            <h2 className="text-2xl font-extrabold text-[#00327d]" style={{ fontFamily: "'Manrope', sans-serif" }}>לו״ז טיול</h2>
            <div className="flex gap-2 items-center flex-wrap">
              {Array.from({ length: numDays }, (_, i) => i + 1).map(d => (
                <button key={d} onClick={() => setScheduleDay(d)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${scheduleDay === d ? "bg-[#00327d] text-white" : "bg-white border border-slate-200 hover:bg-blue-50"}`}>
                  יום {d}
                </button>
              ))}
            </div>
            {canEditActive && (
              <div className="bg-white rounded-2xl p-5 border border-slate-100">
                <div className="flex gap-2 flex-wrap">
                  <Input type="time" value={newSlot.startTime} onChange={e => setNewSlot(p => ({ ...p, startTime: e.target.value }))} className="w-28 h-10 rounded-xl" />
                  <Input type="time" value={newSlot.endTime} onChange={e => setNewSlot(p => ({ ...p, endTime: e.target.value }))} className="w-28 h-10 rounded-xl" />
                  <Input placeholder="פעילות *" value={newSlot.title} onChange={e => setNewSlot(p => ({ ...p, title: e.target.value }))} className="flex-1 min-w-[150px] h-10 rounded-xl" />
                  <Select value={newSlot.category} onValueChange={v => setNewSlot(p => ({ ...p, category: v }))}>
                    <SelectTrigger className="w-28 h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activity">כללי</SelectItem>
                      <SelectItem value="logistics">לוגיסטי</SelectItem>
                      <SelectItem value="hadracha">הדרכתי</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="מיקום" value={newSlot.location} onChange={e => setNewSlot(p => ({ ...p, location: e.target.value }))} className="w-28 h-10 rounded-xl" />
                  <Button className="h-10 rounded-xl bg-[#00327d]" disabled={!newSlot.title || !newSlot.startTime} onClick={() => addSlot.mutate()}><Plus className="w-4 h-4" /></Button>
                </div>
              </div>
            )}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              {scheduleSlots.filter(s => s.dayNumber === scheduleDay).sort((a, b) => a.startTime.localeCompare(b.startTime)).map(s => {
                const catColor = s.category === "logistics" ? "bg-amber-100 text-amber-700" : s.category === "hadracha" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-[#00327d]";
                return (
                  <div key={s.id} className="flex items-center gap-4 p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <div className="w-20 text-center shrink-0">
                      <span className="font-bold text-sm text-[#00327d]">{s.startTime}</span>
                      {s.endTime && <span className="text-xs text-slate-500 block">{s.endTime}</span>}
                    </div>
                    <div className="w-1 h-10 bg-[#00327d]/20 rounded-full shrink-0" />
                    <div className="flex-1">
                      <div className="font-bold text-sm">{s.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex gap-2">
                        {s.location && <span>{s.location}</span>}
                        {s.responsible && <span>אחראי: {s.responsible}</span>}
                      </div>
                    </div>
                    <Badge className={`${catColor} border-0 text-[10px]`}>{s.category === "logistics" ? "לוגיסטי" : s.category === "hadracha" ? "הדרכתי" : "כללי"}</Badge>
                    {canEditActive && <button onClick={() => deleteSlot.mutate(s.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                );
              })}
              {scheduleSlots.filter(s => s.dayNumber === scheduleDay).length === 0 && (
                <div className="p-10 text-center text-slate-500 text-sm">אין פעילויות ביום {scheduleDay}</div>
              )}
            </div>
          </div>
        )}

        {/* MENU section */}
        {activeSection === "menu" && (
          <div className="p-6 lg:p-8 max-w-[1000px] space-y-6">
            <h2 className="text-2xl font-extrabold text-[#00327d]" style={{ fontFamily: "'Manrope', sans-serif" }}>תפריט</h2>
            <div className="flex gap-2 items-center flex-wrap">
              {Array.from({ length: numDays }, (_, i) => i + 1).map(d => (
                <button key={d} onClick={() => setSelectedDay(d)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${selectedDay === d ? "bg-[#00327d] text-white" : "bg-white border border-slate-200 hover:bg-blue-50"}`}>
                  יום {d}
                </button>
              ))}
            </div>
            {canEditActive && (
              <div className="bg-white rounded-2xl p-5 border border-slate-100">
                <div className="flex gap-2 flex-wrap">
                  <Select value={newMenuItem.mealType} onValueChange={v => setNewMenuItem(p => ({ ...p, mealType: v }))}>
                    <SelectTrigger className="w-36 h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{MEAL_TYPES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input placeholder="תיאור ארוחה *" value={newMenuItem.description} onChange={e => setNewMenuItem(p => ({ ...p, description: e.target.value }))} className="flex-1 min-w-[200px] h-10 rounded-xl" />
                  <Button className="h-10 rounded-xl bg-[#00327d]" disabled={!newMenuItem.description} onClick={() => addMenuItem.mutate()}><Plus className="w-4 h-4 ml-1" /> הוסף</Button>
                </div>
              </div>
            )}
            <div className="space-y-3">
              {MEAL_TYPES.map(mt => {
                const items = menu.filter(m => m.dayNumber === selectedDay && m.mealType === mt.value);
                if (items.length === 0) return null;
                return (
                  <div key={mt.value} className="bg-white rounded-2xl p-5 border border-slate-100">
                    <h3 className="font-bold text-sm text-[#00327d] mb-3">{mt.label}</h3>
                    {items.map(item => (
                      <div key={item.id} className="flex items-center justify-between py-2">
                        <span className="text-sm">{item.description}</span>
                        {canEditActive && <button onClick={() => deleteMenuItem.mutate(item.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PORTFOLIO section */}
        {activeSection === "portfolio" && (
          <div className="p-6 lg:p-8 max-w-[1000px] space-y-6">
            <h2 className="text-2xl font-extrabold text-[#00327d]" style={{ fontFamily: "'Manrope', sans-serif" }}>תיק הדרכה</h2>
            {(canEditActive || role === "madrich") && (
              <div className="bg-white rounded-2xl p-5 border border-slate-100">
                <div className="flex gap-2 flex-wrap">
                  <Input placeholder="כותרת *" value={newPortfolio.title} onChange={e => setNewPortfolio(p => ({ ...p, title: e.target.value }))} className="flex-1 min-w-[150px] h-10 rounded-xl" />
                  <Select value={newPortfolio.type} onValueChange={v => setNewPortfolio(p => ({ ...p, type: v }))}>
                    <SelectTrigger className="w-32 h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="note">הערה</SelectItem>
                      <SelectItem value="activity">פעולה</SelectItem>
                      <SelectItem value="document">מסמך</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button className="h-10 rounded-xl bg-[#00327d]" disabled={!newPortfolio.title} onClick={() => addPortfolio.mutate()}><Plus className="w-4 h-4 ml-1" /> הוסף</Button>
                </div>
                <Textarea placeholder="תוכן..." value={newPortfolio.content} onChange={e => setNewPortfolio(p => ({ ...p, content: e.target.value }))} rows={3} className="mt-3 rounded-xl" />
              </div>
            )}
            <div className="space-y-3">
              {portfolioItems.map(p => (
                <div key={p.id} className="bg-white rounded-2xl p-5 border border-slate-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge className="bg-slate-100 text-slate-600 border-0 text-[10px] mb-2">{p.type === "activity" ? "פעולה" : p.type === "document" ? "מסמך" : "הערה"}</Badge>
                      <h3 className="font-bold text-sm">{p.title}</h3>
                      {p.content && <p className="text-xs text-slate-600 mt-2 whitespace-pre-wrap">{p.content}</p>}
                    </div>
                    {canEditActive && <button onClick={() => deletePortfolio.mutate(p.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DETAILS section */}
        {activeSection === "details" && (
          <div className="p-6 lg:p-8 max-w-[1000px] space-y-6">
            <h2 className="text-2xl font-extrabold text-[#00327d]" style={{ fontFamily: "'Manrope', sans-serif" }}>פרטי מפעל וצוות</h2>

            {/* Event details */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 space-y-4">
              <h3 className="font-bold text-sm text-slate-800">פרטי אירוע</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-slate-500 text-xs">שם:</span><p className="font-medium">{event.name}</p></div>
                <div><span className="text-slate-500 text-xs">סוג:</span><p className="font-medium">{EVENT_TYPES[event.eventType || ""] || event.eventType || "—"}</p></div>
                <div><span className="text-slate-500 text-xs">תאריך:</span><p className="font-medium">{event.date ? new Date(event.date).toLocaleDateString("he-IL") : "—"}{event.endDate ? ` — ${new Date(event.endDate).toLocaleDateString("he-IL")}` : ""}</p></div>
                <div><span className="text-slate-500 text-xs">מיקום:</span><p className="font-medium">{event.location || "—"}</p></div>
                <div><span className="text-slate-500 text-xs">אחראי:</span><p className="font-medium">{event.responsiblePerson || "—"}</p></div>
                <div><span className="text-slate-500 text-xs">סטטוס:</span><p className="font-medium">{event.status}</p></div>
              </div>
              {event.description && <p className="text-sm text-slate-600 pt-2 border-t border-slate-100">{event.description}</p>}
              {event.notes && <p className="text-xs text-slate-500">{event.notes}</p>}
            </div>

            {/* Staff management */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 space-y-4">
              <h3 className="font-bold text-sm text-slate-800">צוות מפעל</h3>
              {canEditEvent && (
                <div className="flex gap-2 flex-wrap items-end">
                  <Select value={selectedStaffUser} onValueChange={setSelectedStaffUser}>
                    <SelectTrigger className="flex-1 min-w-[180px] h-10 rounded-xl"><SelectValue placeholder="בחר משתמש..." /></SelectTrigger>
                    <SelectContent>{availableStaffUsers.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name}{u.grade ? ` (${u.grade})` : ""}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={staffRole} onValueChange={v => { setStaffRole(v); if (v !== "תפקיד אחר") setCustomStaffRole(""); }}>
                    <SelectTrigger className="w-40 h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{STAFF_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                  {staffRole === "תפקיד אחר" && (
                    <Input placeholder="שם התפקיד..." value={customStaffRole} onChange={e => setCustomStaffRole(e.target.value)} className="w-40 h-10 rounded-xl" />
                  )}
                  <Button className="h-10 rounded-xl bg-[#00327d]" disabled={!selectedStaffUser || (staffRole === "תפקיד אחר" && !customStaffRole.trim())} onClick={() => addStaff.mutate()}>
                    <UserPlus className="w-4 h-4 ml-1" /> שבץ
                  </Button>
                </div>
              )}
              <div className="space-y-2">
                {eventStaff.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-[#00327d] to-[#0047ab] text-white rounded-lg flex items-center justify-center font-bold text-sm">{(s.userName || "?")[0]}</div>
                      <div>
                        <span className="font-medium text-sm">{s.userName || "—"}</span>
                        <div className="text-[11px] text-slate-500">{s.role}{s.userGrade ? ` · ${s.userGrade}` : ""}</div>
                      </div>
                    </div>
                    {canEditEvent && <button onClick={() => { if (confirm("להסיר?")) deleteStaff.mutate(s.id); }} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
