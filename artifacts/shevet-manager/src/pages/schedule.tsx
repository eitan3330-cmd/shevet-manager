import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, CalendarDays, MapPin, User, ChevronRight, ChevronLeft, FileSpreadsheet, Upload, Lock, Target, Check, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useAppSettings } from "@/lib/api-hooks";
import * as XLSX from "xlsx";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const EVENT_TYPES = [
  { value: "event", label: "מפעל" },
  { value: "meeting", label: "ישיבה" },
  { value: "training", label: "הכשרה" },
  { value: "activity", label: "פעולה" },
  { value: "camp", label: "מחנה" },
  { value: "trip", label: "טיול" },
  { value: "holiday", label: "חג / חופש" },
  { value: "tribal", label: "שבטי" },
  { value: "other", label: "אחר" },
];

const GRADE_LEVELS = [
  { value: "all", label: "כלל השבט" },
  { value: "dalet", label: "ד׳" },
  { value: "hey", label: "ה׳" },
  { value: "vav", label: "ו׳" },
  { value: "zayin", label: "ז׳" },
  { value: "chet", label: "ח׳" },
  { value: "tet", label: "ט׳" },
  { value: "madrichim", label: "מדריכים" },
  { value: "paelim", label: "פעילים" },
  { value: "roshgadim", label: "ראש״גדים" },
  { value: "roshatzim", label: "ראש״צים" },
  { value: "merkazim", label: "מרכזים" },
  { value: "bogrim", label: "בוגרים" },
  { value: "hofesh", label: "חופש / הדממה" },
];

const GRADE_COLORS: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  all:          { bg: "bg-violet-100", text: "text-violet-800", dot: "bg-violet-500", border: "border-violet-400" },
  dalet:        { bg: "bg-sky-100",    text: "text-sky-800",    dot: "bg-sky-500",    border: "border-sky-400" },
  hey:          { bg: "bg-blue-100",   text: "text-blue-800",   dot: "bg-blue-500",   border: "border-blue-400" },
  vav:          { bg: "bg-cyan-100",   text: "text-cyan-800",   dot: "bg-cyan-500",   border: "border-cyan-400" },
  zayin:        { bg: "bg-emerald-100", text: "text-emerald-800", dot: "bg-emerald-500", border: "border-emerald-400" },
  chet:         { bg: "bg-teal-100",   text: "text-teal-800",   dot: "bg-teal-500",   border: "border-teal-400" },
  tet:          { bg: "bg-amber-100",  text: "text-amber-800",  dot: "bg-amber-500",  border: "border-amber-400" },
  madrichim:    { bg: "bg-indigo-100", text: "text-indigo-800", dot: "bg-indigo-500",  border: "border-indigo-400" },
  paelim:       { bg: "bg-rose-100",   text: "text-rose-800",   dot: "bg-rose-500",   border: "border-rose-400" },
  roshgadim:    { bg: "bg-fuchsia-100", text: "text-fuchsia-800", dot: "bg-fuchsia-500", border: "border-fuchsia-400" },
  roshatzim:    { bg: "bg-purple-100", text: "text-purple-800", dot: "bg-purple-500",  border: "border-purple-400" },
  merkazim:     { bg: "bg-orange-100", text: "text-orange-800", dot: "bg-orange-500",  border: "border-orange-400" },
  bogrim:       { bg: "bg-lime-100",   text: "text-lime-800",   dot: "bg-lime-600",    border: "border-lime-400" },
  hofesh:       { bg: "bg-gray-100",   text: "text-gray-700",   dot: "bg-gray-400",    border: "border-gray-300" },
};

const TYPE_COLORS: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  event:    { bg: "bg-orange-100", text: "text-orange-800", dot: "bg-orange-500", border: "border-orange-400" },
  tribal:   { bg: "bg-purple-100", text: "text-purple-800", dot: "bg-purple-600", border: "border-purple-400" },
  meeting:  { bg: "bg-fuchsia-100", text: "text-fuchsia-800", dot: "bg-fuchsia-500", border: "border-fuchsia-400" },
  training: { bg: "bg-yellow-100", text: "text-yellow-800", dot: "bg-yellow-500", border: "border-yellow-400" },
  activity: { bg: "bg-teal-100", text: "text-teal-800", dot: "bg-teal-500", border: "border-teal-400" },
  camp:     { bg: "bg-red-100", text: "text-red-800", dot: "bg-red-500", border: "border-red-400" },
  trip:     { bg: "bg-cyan-100", text: "text-cyan-800", dot: "bg-cyan-500", border: "border-cyan-400" },
  holiday:  { bg: "bg-pink-100", text: "text-pink-800", dot: "bg-pink-500", border: "border-pink-400" },
  other:    { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-500", border: "border-slate-400" },
};

const TRIBAL_COLOR = TYPE_COLORS.tribal;
const EVENT_COLOR = TYPE_COLORS.event;
const DEADLINE_COLOR = { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", border: "border-red-400" };

const HEBREW_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

function getEventColors(e: any) {
  if (e.type === "tribal" || e.type === "event") return TYPE_COLORS[e.type];
  const grades = parseGrades(e.gradeLevel);
  if (grades.length === 1 && grades[0] !== "all" && GRADE_COLORS[grades[0]]) return GRADE_COLORS[grades[0]];
  if (grades.includes("all") || grades.length === 0) {
    return TYPE_COLORS[e.type] || GRADE_COLORS["all"];
  }
  if (grades.length > 1) return GRADE_COLORS[grades[0]];
  return TYPE_COLORS[e.type] || GRADE_COLORS["all"];
}

function getTypeBadgeColor(type: string) {
  return TYPE_COLORS[type] || TYPE_COLORS.other;
}

function parseGrades(gradeLevel: string | null | undefined): string[] {
  if (!gradeLevel) return ["all"];
  return gradeLevel.split(",").map(g => g.trim()).filter(Boolean);
}

function getGradeDotsForEvent(e: any): string[] {
  if (e.type === "tribal") return ["tribal"];
  if (e.type === "event") return ["event"];
  return parseGrades(e.gradeLevel);
}

function getDotColor(grade: string): string {
  if (grade === "tribal") return TRIBAL_COLOR.dot;
  if (grade === "event") return EVENT_COLOR.dot;
  return GRADE_COLORS[grade]?.dot || GRADE_COLORS["all"].dot;
}

type Form = {
  title: string; description: string; date: string; endDate: string;
  type: string; responsiblePerson: string; location: string; grades: string[]; notes: string;
};
const EMPTY: Form = { title: "", description: "", date: "", endDate: "", type: "event", responsiblePerson: "", location: "", grades: ["all"], notes: "" };

type DeadlineForm = {
  title: string; date: string; responsiblePerson: string; notes: string;
};
const EMPTY_DEADLINE: DeadlineForm = { title: "", date: "", responsiblePerson: "", notes: "" };

export function Schedule() {
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [viewDate, setViewDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "list">("month");
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [deadlineDialogOpen, setDeadlineDialogOpen] = useState(false);
  const [deadlineEventId, setDeadlineEventId] = useState<number | null>(null);
  const [deadlineEventName, setDeadlineEventName] = useState("");
  const [deadlineForm, setDeadlineForm] = useState<DeadlineForm>(EMPTY_DEADLINE);
  const [editDeadlineId, setEditDeadlineId] = useState<number | null>(null);
  const [gradeFilter, setGradeFilter] = useState<string>("all_filter");
  const [visibleGrades, setVisibleGrades] = useState<Set<string>>(new Set(["all"]));
  const [showMyScheduleOnly, setShowMyScheduleOnly] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { role, user } = useAuth();
  const qc = useQueryClient();

  const canEdit = ["marcaz_boger", "marcaz_tzair"].includes(role || "");

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["schedule"],
    queryFn: () => fetch(`${API_BASE}/api/schedule`).then(r => r.json()),
  });

  const { data: allDeadlines = [] } = useQuery({
    queryKey: ["event-deadlines"],
    queryFn: () => fetch(`${API_BASE}/api/event-deadlines`).then(r => r.json()),
  });

  const { data: mifaalim = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => fetch(`${API_BASE}/api/events`).then(r => r.json()),
  });

  const { data: eventDeadlines = [] } = useQuery({
    queryKey: ["event-deadlines-for", deadlineEventId],
    queryFn: () => deadlineEventId ? fetch(`${API_BASE}/api/events/${deadlineEventId}/deadlines`).then(r => r.json()) : Promise.resolve([]),
    enabled: !!deadlineEventId,
  });

  const createEvent = useMutation({
    mutationFn: (data: any) => fetch(`${API_BASE}/api/schedule`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["schedule"] }); setIsOpen(false); setForm(EMPTY); toast({ title: "אירוע נוסף ללוז" }); },
  });

  const updateEvent = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => fetch(`${API_BASE}/api/schedule/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["schedule"] }); setIsOpen(false); toast({ title: "אירוע עודכן" }); },
  });

  const deleteEvent = useMutation({
    mutationFn: (id: number) => fetch(`${API_BASE}/api/schedule/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["schedule"] }); toast({ title: "אירוע נמחק" }); },
  });

  const authHeaders = { "Content-Type": "application/json", "x-user-role": role || "" };

  const createDeadline = useMutation({
    mutationFn: (data: any) => fetch(`${API_BASE}/api/events/${deadlineEventId}/deadlines`, { method: "POST", headers: authHeaders, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["event-deadlines-for", deadlineEventId] }); qc.invalidateQueries({ queryKey: ["event-deadlines"] }); setDeadlineForm(EMPTY_DEADLINE); setEditDeadlineId(null); toast({ title: "דד-ליין נוסף" }); },
  });

  const updateDeadline = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => fetch(`${API_BASE}/api/event-deadlines/${id}`, { method: "PUT", headers: authHeaders, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["event-deadlines-for", deadlineEventId] }); qc.invalidateQueries({ queryKey: ["event-deadlines"] }); setDeadlineForm(EMPTY_DEADLINE); setEditDeadlineId(null); toast({ title: "דד-ליין עודכן" }); },
  });

  const deleteDeadline = useMutation({
    mutationFn: (id: number) => fetch(`${API_BASE}/api/event-deadlines/${id}`, { method: "DELETE", headers: { "x-user-role": role || "" } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["event-deadlines-for", deadlineEventId] }); qc.invalidateQueries({ queryKey: ["event-deadlines"] }); toast({ title: "דד-ליין נמחק" }); },
  });

  const toggleDeadlineComplete = useMutation({
    mutationFn: ({ id, completed }: { id: number; completed: boolean }) => fetch(`${API_BASE}/api/event-deadlines/${id}`, { method: "PUT", headers: authHeaders, body: JSON.stringify({ completed }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["event-deadlines-for", deadlineEventId] }); qc.invalidateQueries({ queryKey: ["event-deadlines"] }); },
  });

  const handleEdit = (e: any) => {
    setEditId(e.id);
    const grades = parseGrades(e.gradeLevel);
    setForm({
      title: e.title, description: e.description || "", date: e.date?.split("T")[0] || "",
      endDate: e.endDate?.split("T")[0] || "", type: e.type, responsiblePerson: e.responsiblePerson || "",
      location: e.location || "", grades, notes: e.notes || "",
    });
    setIsOpen(true);
  };

  const handleSubmit = () => {
    const gradeLevel = form.grades.join(",");
    const data = { ...form, gradeLevel, date: form.date ? new Date(form.date).toISOString() : null, endDate: form.endDate ? new Date(form.endDate).toISOString() : null };
    const { grades: _, ...submitData } = data;
    if (editId) updateEvent.mutate({ id: editId, data: submitData });
    else createEvent.mutate(submitData);
  };

  const toggleGrade = (grade: string) => {
    setForm(p => {
      let newGrades: string[];
      if (grade === "all") {
        newGrades = ["all"];
      } else {
        newGrades = p.grades.filter(g => g !== "all");
        if (newGrades.includes(grade)) {
          newGrades = newGrades.filter(g => g !== grade);
        } else {
          newGrades.push(grade);
        }
        if (newGrades.length === 0) newGrades = ["all"];
      }
      return { ...p, grades: newGrades };
    });
  };

  const openDeadlineDialog = (eventId: number, eventName: string) => {
    setDeadlineEventId(eventId);
    setDeadlineEventName(eventName);
    setDeadlineForm(EMPTY_DEADLINE);
    setEditDeadlineId(null);
    setDeadlineDialogOpen(true);
  };

  const handleDeadlineSubmit = () => {
    const data = { title: deadlineForm.title, date: new Date(deadlineForm.date).toISOString(), responsiblePerson: deadlineForm.responsiblePerson || null, notes: deadlineForm.notes || null };
    if (editDeadlineId) updateDeadline.mutate({ id: editDeadlineId, data });
    else createDeadline.mutate(data);
  };

  const excelSerialToDate = (serial: number): Date => new Date((serial - 25569) * 86400000);

  const isCalendarFormat = (wb: XLSX.WorkBook): boolean => {
    const HEBREW_MONTH_NAMES = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
    return wb.SheetNames.some(name => HEBREW_MONTH_NAMES.some(m => name.includes(m)));
  };

  const parseCalendarExcel = (wb: XLSX.WorkBook): any[] => {
    const events: any[] = [];
    const DAY_HEADERS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      let i = 0;
      while (i < rows.length) {
        const row = rows[i];
        const isHeader = row && row.length >= 7 && DAY_HEADERS.every((d, idx) => String(row[idx]).trim() === d);
        if (isHeader && i + 1 < rows.length) {
          const dateRow = rows[i + 1];
          const dates: (Date | null)[] = [];
          for (let col = 0; col < 7; col++) {
            const val = dateRow[col];
            if (typeof val === "number" && val > 40000 && val < 60000) dates.push(excelSerialToDate(val));
            else dates.push(null);
          }
          let contentRow = i + 2;
          while (contentRow < rows.length) {
            const cr = rows[contentRow];
            if (!cr) break;
            const nextIsHeader = cr.length >= 7 && DAY_HEADERS.every((d, idx) => String(cr[idx]).trim() === d);
            if (nextIsHeader) break;
            const hasTitle = String(rows[contentRow + 1]?.[0] || "").includes("לוז שבטי");
            if (hasTitle) break;
            for (let col = 0; col < 7; col++) {
              const cellText = String(cr[col] || "").trim();
              if (cellText && dates[col]) {
                events.push({ title: cellText, date: dates[col]!.toISOString().split("T")[0], type: "activity" });
              }
            }
            contentRow++;
          }
          i = contentRow;
        } else { i++; }
      }
    }
    const seen = new Set<string>();
    return events.filter(e => { const key = `${e.title}|${e.date}`; if (seen.has(key)) return false; seen.add(key); return true; });
  };

  const parseTabularExcel = (wb: XLSX.WorkBook): any[] => {
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
    if (!json.length) return [];
    const COL_MAP: Record<string, string> = {
      "כותרת": "title", "שם": "title", "תאריך": "date", "תאריך התחלה": "date",
      "תאריך סיום": "endDate", "סוג": "type", "שכבה": "gradeLevel",
      "מיקום": "location", "אחראי": "responsiblePerson", "תיאור": "description", "הערות": "notes",
    };
    return json.map(row => {
      const r: any = {};
      for (const [heb, eng] of Object.entries(COL_MAP)) { if (row[heb] !== undefined) r[eng] = row[heb]; }
      return r;
    }).filter(r => r.title);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        let mapped: any[];
        if (isCalendarFormat(wb)) {
          mapped = parseCalendarExcel(wb);
          if (mapped.length === 0) { toast({ title: "לא נמצאו אירועים בלוז", variant: "destructive" }); return; }
          toast({ title: `זוהה לוז שבטי — ${mapped.length} אירועים נמצאו` });
        } else {
          mapped = parseTabularExcel(wb);
          if (mapped.length === 0) { toast({ title: "הקובץ ריק", variant: "destructive" }); return; }
        }
        setImportRows(mapped);
        setImportOpen(true);
      } catch { toast({ title: "שגיאה בקריאת הקובץ", variant: "destructive" }); }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleImportConfirm = async () => {
    setImportLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/schedule/import-bulk`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: importRows }) });
      const result = await res.json();
      qc.invalidateQueries({ queryKey: ["schedule"] });
      toast({ title: `ייבוא הושלם: ${result.added} אירועים נוספו, ${result.skipped} דולגו` });
      setImportOpen(false);
      setImportRows([]);
    } catch { toast({ title: "שגיאה בייבוא", variant: "destructive" }); }
    finally { setImportLoading(false); }
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const userGradeKeys: string[] = (() => {
    if (!role) return [];
    if (role === "madrich") return ["madrichim"];
    if (role === "roshgad") return ["roshgadim", "madrichim"];
    if (role === "pael") return ["paelim"];
    if (role === "roshatz") return ["roshatzim", "madrichim"];
    if (role === "marcaz_boger" || role === "marcaz_tzair") return ["merkazim", "bogrim"];
    return [];
  })();

  const filteredEvents = (events as any[]).filter(e => {
    const grades = parseGrades(e.gradeLevel);
    const isHadama = e.type === "holiday" || grades.includes("hofesh");
    if (isHadama) return true;

    if (showMyScheduleOnly && userGradeKeys.length > 0) {
      return userGradeKeys.some(k => grades.includes(k)) || grades.includes("all") || e.type === "tribal";
    }

    if (gradeFilter === "all_filter") return true;
    if (gradeFilter === "event_filter") return e.type === "event";
    if (gradeFilter === "tribal_filter") return e.type === "tribal";
    if (gradeFilter === "deadline_filter") return false;
    return grades.includes(gradeFilter) || grades.includes("all");
  });

  const monthEvents = filteredEvents.filter(e => {
    const d = new Date(e.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const monthDeadlines = (allDeadlines as any[]).filter(d => {
    const dd = new Date(d.date);
    return dd.getFullYear() === year && dd.getMonth() === month;
  });

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 1) % 7;
  const days = Array.from({ length: lastDay.getDate() }, (_, i) => i + 1);

  const getEventsByDay = (day: number) => monthEvents.filter(e => new Date(e.date).getDate() === day);
  const getDeadlinesByDay = (day: number) => monthDeadlines.filter(d => new Date(d.date).getDate() === day);

  const upcomingEvents = filteredEvents.filter(e => new Date(e.date) >= new Date()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 5);
  const upcomingDeadlines = (allDeadlines as any[]).filter(d => new Date(d.date) >= new Date() && !d.completed).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 5);

  const { planningBlocked } = useAppSettings();

  if (planningBlocked) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
        <Lock className="w-14 h-14 text-amber-500 opacity-70" />
        <h2 className="text-2xl font-bold">תכנון נעול</h2>
        <p className="text-muted-foreground max-w-sm">לוז השבט נעול על ידי מרכז בוגר. פנה למרכז בוגר לפתיחת הגישה.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold">לוז שבטי</h2>
          <p className="text-muted-foreground">לוח האירועים השנתי של השבט</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex rounded-lg border overflow-hidden text-sm">
            {[{ id: "month", label: "חודשי" }, { id: "list", label: "רשימה" }].map(m => (
              <button key={m.id} onClick={() => setViewMode(m.id as any)}
                className={`px-3 py-1.5 ${viewMode === m.id ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}>
                {m.label}
              </button>
            ))}
          </div>
          {canEdit && (
            <>
              <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
                <FileSpreadsheet className="w-4 h-4" /> העלה לוז מ-Excel
              </Button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} />
              <Button onClick={() => { setEditId(null); setForm(EMPTY); setIsOpen(true); }} className="gap-2">
                <Plus className="w-4 h-4" /> הוסף ללוז
              </Button>
            </>
          )}
        </div>
      </div>

      {/* My schedule toggle */}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={() => { setShowMyScheduleOnly(!showMyScheduleOnly); if (!showMyScheduleOnly) setGradeFilter("all_filter"); }}
          className={`text-sm px-4 py-2 rounded-xl border-2 transition-all font-bold flex items-center gap-2 ${showMyScheduleOnly ? "bg-[#00327d] text-white border-[#00327d] shadow-lg shadow-[#00327d]/20" : "bg-white text-slate-600 border-slate-200 hover:border-[#00327d]/30"}`}
        >
          <span className="material-symbols-outlined text-[18px]">{showMyScheduleOnly ? "visibility" : "visibility_off"}</span>
          {showMyScheduleOnly ? "הלו״ז שלי" : "כל הלו״ז"}
        </button>
        <span className="text-xs text-slate-400 mr-2">
          {showMyScheduleOnly ? "מציג אירועים הרלוונטיים אליך + הדממה" : "מציג את כל האירועים בשבט"}
        </span>
      </div>

      {/* Color legend + grade filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-muted-foreground ml-1">סינון:</span>
        <button
          onClick={() => { setGradeFilter("all_filter"); setShowMyScheduleOnly(false); }}
          className={`text-xs px-2.5 py-1 rounded-full border transition-all ${gradeFilter === "all_filter" && !showMyScheduleOnly ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"}`}
        >הכל</button>
        {GRADE_LEVELS.filter(g => g.value !== "all").map(g => (
          <button
            key={g.value}
            onClick={() => setGradeFilter(gradeFilter === g.value ? "all_filter" : g.value)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-all flex items-center gap-1.5 ${gradeFilter === g.value ? `${GRADE_COLORS[g.value].bg} ${GRADE_COLORS[g.value].text} ${GRADE_COLORS[g.value].border}` : "bg-background border-border hover:bg-muted"}`}
          >
            <span className={`w-2 h-2 rounded-full ${GRADE_COLORS[g.value].dot}`} />
            {g.label}
          </button>
        ))}
        <button
          onClick={() => setGradeFilter(gradeFilter === "tribal_filter" ? "all_filter" : "tribal_filter")}
          className={`text-xs px-2.5 py-1 rounded-full border transition-all flex items-center gap-1.5 ${gradeFilter === "tribal_filter" ? `${TRIBAL_COLOR.bg} ${TRIBAL_COLOR.text} ${TRIBAL_COLOR.border}` : "bg-background border-border hover:bg-muted"}`}
        >
          <span className={`w-2 h-2 rounded-full ${TRIBAL_COLOR.dot}`} />
          שבטי
        </button>
        <button
          onClick={() => setGradeFilter(gradeFilter === "event_filter" ? "all_filter" : "event_filter")}
          className={`text-xs px-2.5 py-1 rounded-full border transition-all flex items-center gap-1.5 ${gradeFilter === "event_filter" ? `${EVENT_COLOR.bg} ${EVENT_COLOR.text} ${EVENT_COLOR.border}` : "bg-background border-border hover:bg-muted"}`}
        >
          <span className={`w-2 h-2 rounded-full ${EVENT_COLOR.dot}`} />
          מפעלים
        </button>
        {canEdit && mifaalim.length > 0 && (
          <>
            <div className="w-px h-5 bg-border mx-1" />
            <Select value="" onValueChange={v => {
              const ev = (mifaalim as any[]).find((m: any) => String(m.id) === v);
              if (ev) openDeadlineDialog(ev.id, ev.name);
            }}>
              <SelectTrigger className="h-7 text-xs w-auto min-w-[140px] gap-1">
                <Target className="w-3 h-3" />
                <SelectValue placeholder="דד-ליינים למפעל" />
              </SelectTrigger>
              <SelectContent>
                {(mifaalim as any[]).map((m: any) => (
                  <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {viewMode === "month" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-card border rounded-xl p-3">
            <Button variant="ghost" size="icon" onClick={() => setViewDate(new Date(year, month + 1, 1))}><ChevronLeft className="w-4 h-4" /></Button>
            <h3 className="text-lg font-bold">{HEBREW_MONTHS[month]} {year}</h3>
            <Button variant="ghost" size="icon" onClick={() => setViewDate(new Date(year, month - 1, 1))}><ChevronRight className="w-4 h-4" /></Button>
          </div>

          <div className="border rounded-xl overflow-hidden bg-card">
            <div className="grid grid-cols-7 bg-muted/30">
              {["א", "ב", "ג", "ד", "ה", "ו", "ש"].map(d => (
                <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 divide-x divide-y divide-border/50">
              {Array.from({ length: startDow }).map((_, i) => <div key={`empty-${i}`} className="min-h-[90px] bg-muted/10" />)}
              {days.map(day => {
                const dayEvents = getEventsByDay(day);
                const dayDeadlines = getDeadlinesByDay(day);
                const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;
                return (
                  <div key={day} className={`min-h-[90px] p-1.5 ${isToday ? "bg-primary/5" : ""}`}>
                    <span className={`text-sm font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{day}</span>
                    <div className="space-y-0.5 mt-1">
                      {dayEvents.slice(0, 3).map(e => {
                        const colors = getEventColors(e);
                        const dots = getGradeDotsForEvent(e);
                        return (
                          <div key={e.id} className={`text-xs px-1.5 py-0.5 rounded truncate flex items-center gap-1 ${colors.bg} ${colors.text}`} title={e.title}>
                            {dots.length > 1 ? (
                              <span className="flex gap-0.5 shrink-0">
                                {dots.slice(0, 3).map((d, i) => <span key={i} className={`w-1.5 h-1.5 rounded-full ${getDotColor(d)}`} />)}
                              </span>
                            ) : null}
                            <span className="truncate">{e.title}</span>
                          </div>
                        );
                      })}
                      {dayDeadlines.map(d => (
                        <div key={`dl-${d.id}`} className={`text-xs px-1.5 py-0.5 rounded truncate flex items-center gap-1 ${d.completed ? "bg-green-50 text-green-700 line-through" : `${DEADLINE_COLOR.bg} ${DEADLINE_COLOR.text}`}`} title={`דד-ליין: ${d.title}`}>
                          <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{d.title}</span>
                        </div>
                      ))}
                      {dayEvents.length > 3 && <div className="text-xs text-muted-foreground pr-1">+{dayEvents.length - 3}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Color legend */}
          <div className="border rounded-xl p-3 bg-card">
            <h4 className="font-semibold mb-2 text-xs text-muted-foreground">מקרא צבעים</h4>
            <div className="flex flex-wrap gap-3">
              {GRADE_LEVELS.filter(g => g.value !== "all").map(g => (
                <span key={g.value} className="flex items-center gap-1.5 text-xs">
                  <span className={`w-3 h-3 rounded ${GRADE_COLORS[g.value].dot}`} />
                  {g.label}
                </span>
              ))}
              <span className="flex items-center gap-1.5 text-xs">
                <span className={`w-3 h-3 rounded ${GRADE_COLORS["all"].dot}`} />
                כלל השבט
              </span>
              <span className="flex items-center gap-1.5 text-xs">
                <span className={`w-3 h-3 rounded ${TRIBAL_COLOR.dot}`} />
                שבטי
              </span>
              <span className="flex items-center gap-1.5 text-xs">
                <span className={`w-3 h-3 rounded ${EVENT_COLOR.dot}`} />
                מפעל
              </span>
              <span className="flex items-center gap-1.5 text-xs">
                <span className={`w-3 h-3 rounded ${DEADLINE_COLOR.dot}`} />
                דד-ליין
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            {upcomingEvents.length > 0 && (
              <div className="border rounded-xl p-4 bg-card">
                <h4 className="font-semibold mb-3 text-sm text-muted-foreground">אירועים קרובים</h4>
                <div className="space-y-2">
                  {upcomingEvents.map(e => {
                    const colors = getEventColors(e);
                    const grades = parseGrades(e.gradeLevel);
                    return (
                      <div key={e.id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="flex gap-0.5 shrink-0">
                            {getGradeDotsForEvent(e).slice(0, 3).map((d, i) => (
                              <span key={i} className={`w-2.5 h-2.5 rounded-full ${getDotColor(d)}`} />
                            ))}
                          </div>
                          <span className="font-medium text-sm truncate">{e.title}</span>
                          {grades.map(g => {
                            const label = GRADE_LEVELS.find(gl => gl.value === g)?.label;
                            const gc = GRADE_COLORS[g] || GRADE_COLORS["all"];
                            return label ? <Badge key={g} variant="outline" className={`text-xs shrink-0 ${gc.bg} ${gc.text} border-0`}>{label}</Badge> : null;
                          })}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{new Date(e.date).toLocaleDateString('he-IL')}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {upcomingDeadlines.length > 0 && (
              <div className="border rounded-xl p-4 bg-card">
                <h4 className="font-semibold mb-3 text-sm text-muted-foreground flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-500" /> דד-ליינים קרובים
                </h4>
                <div className="space-y-2">
                  {upcomingDeadlines.map((d: any) => (
                    <div key={d.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${DEADLINE_COLOR.dot}`} />
                        <span className="font-medium text-sm truncate">{d.title}</span>
                        {d.eventName && <Badge variant="outline" className="text-xs shrink-0 bg-orange-50 text-orange-700 border-0">{d.eventName}</Badge>}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{new Date(d.date).toLocaleDateString('he-IL')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">טוען...</div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border rounded-xl">
              <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>הלוז ריק — הוסף אירועים ראשונים</p>
            </div>
          ) : (
            filteredEvents.map(e => {
              const typeLabel = EVENT_TYPES.find(t => t.value === e.type)?.label || e.type;
              const colors = getEventColors(e);
              const typeBadge = getTypeBadgeColor(e.type);
              const grades = parseGrades(e.gradeLevel);
              return (
                <div key={e.id} className={`border rounded-xl p-4 bg-card flex items-start gap-3 hover:shadow-sm transition-shadow border-r-4 ${colors.border}`}>
                  <div className="flex flex-col gap-1 shrink-0 mt-1">
                    {getGradeDotsForEvent(e).slice(0, 4).map((d, i) => (
                      <span key={i} className={`w-3 h-3 rounded-full ${getDotColor(d)}`} />
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">{e.title}</h3>
                        {e.description && <p className="text-sm text-muted-foreground">{e.description}</p>}
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-0.5"><CalendarDays className="w-3 h-3" />{new Date(e.date).toLocaleDateString('he-IL')}{e.endDate && ` — ${new Date(e.endDate).toLocaleDateString('he-IL')}`}</span>
                          {e.location && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{e.location}</span>}
                          {e.responsiblePerson && <span className="flex items-center gap-0.5"><User className="w-3 h-3" />{e.responsiblePerson}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 flex-wrap">
                        <Badge variant="outline" className={`text-xs ${typeBadge.bg} ${typeBadge.text} border-0`}>{typeLabel}</Badge>
                        {grades.map(g => {
                          const label = GRADE_LEVELS.find(gl => gl.value === g)?.label;
                          const gc = GRADE_COLORS[g] || GRADE_COLORS["all"];
                          return label ? <Badge key={g} variant="outline" className={`text-xs ${gc.bg} ${gc.text} border-0`}>{label}</Badge> : null;
                        })}
                        {canEdit && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(e)}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("למחוק?")) deleteEvent.mutate(e.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Add/Edit event dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editId ? "עריכת אירוע" : "הוספת אירוע ללוז"}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto px-1">
            <Input placeholder="כותרת האירוע *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">סוג</label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">תאריכים</label>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
                  <Input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} placeholder="סיום" />
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">שכבות (אפשר לבחור כמה)</label>
              <div className="flex flex-wrap gap-2">
                {GRADE_LEVELS.map(g => {
                  const isSelected = form.grades.includes(g.value);
                  const gc = GRADE_COLORS[g.value] || GRADE_COLORS["all"];
                  return (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => toggleGrade(g.value)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${isSelected ? `${gc.bg} ${gc.text} ${gc.border}` : "bg-background border-border hover:bg-muted"}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${gc.dot}`} />
                      {g.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">מיקום</label><Input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} /></div>
              <div><label className="text-xs text-muted-foreground">אחראי</label><Input value={form.responsiblePerson} onChange={e => setForm(p => ({ ...p, responsiblePerson: e.target.value }))} /></div>
            </div>
            <div><label className="text-sm font-medium">תיאור</label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
            <div><label className="text-sm font-medium">הערות</label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
            <Button className="w-full" onClick={handleSubmit} disabled={!form.title || !form.date}>
              {editId ? "שמור שינויים" : "הוסף ללוז"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={v => { if (!v) { setImportOpen(false); setImportRows([]); } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Upload className="w-5 h-5" /> תצוגה מקדימה — ייבוא לוז</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg text-blue-800 text-sm flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 shrink-0" />
              נמצאו <strong>{importRows.length}</strong> אירועים. כפילויות (כותרת + תאריך זהה) יידלגו.
            </div>
            <div className="border rounded-xl overflow-auto max-h-60 text-sm">
              <table className="w-full">
                <thead className="bg-muted/30 sticky top-0">
                  <tr>
                    <th className="text-right p-2 font-medium">כותרת</th>
                    <th className="text-right p-2 font-medium">תאריך</th>
                    <th className="text-right p-2 font-medium">סוג</th>
                    <th className="text-right p-2 font-medium">שכבה</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.slice(0, 20).map((r, i) => (
                    <tr key={i} className={i % 2 === 0 ? "" : "bg-muted/10"}>
                      <td className="p-2 font-medium">{r.title}</td>
                      <td className="p-2 text-muted-foreground">{r.date ? String(r.date) : "—"}</td>
                      <td className="p-2">{EVENT_TYPES.find(t => t.value === r.type)?.label || r.type || "מפעל"}</td>
                      <td className="p-2">{GRADE_LEVELS.find(g => g.value === r.gradeLevel)?.label || r.gradeLevel || "כלל השבט"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {importRows.length > 20 && <p className="text-center text-xs text-muted-foreground py-2">...ועוד {importRows.length - 20}</p>}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setImportOpen(false); setImportRows([]); }}>ביטול</Button>
              <Button onClick={handleImportConfirm} disabled={importLoading} className="gap-2">
                {importLoading ? "מייבא..." : <><Upload className="w-4 h-4" /> אשר ייבוא</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deadline table dialog */}
      <Dialog open={deadlineDialogOpen} onOpenChange={v => { if (!v) { setDeadlineDialogOpen(false); setDeadlineEventId(null); } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-red-500" />
              דד-ליינים — {deadlineEventName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {canEdit && (
              <div className="border rounded-lg p-3 bg-muted/20 space-y-2">
                <h4 className="text-sm font-semibold">{editDeadlineId ? "עדכון דד-ליין" : "הוסף דד-ליין חדש"}</h4>
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="שם המשימה *" value={deadlineForm.title} onChange={e => setDeadlineForm(p => ({ ...p, title: e.target.value }))} />
                  <Input type="date" value={deadlineForm.date} onChange={e => setDeadlineForm(p => ({ ...p, date: e.target.value }))} />
                  <Input placeholder="אחראי" value={deadlineForm.responsiblePerson} onChange={e => setDeadlineForm(p => ({ ...p, responsiblePerson: e.target.value }))} />
                </div>
                <Input placeholder="הערות" value={deadlineForm.notes} onChange={e => setDeadlineForm(p => ({ ...p, notes: e.target.value }))} />
                <div className="flex gap-2 justify-end">
                  {editDeadlineId && (
                    <Button variant="outline" size="sm" onClick={() => { setEditDeadlineId(null); setDeadlineForm(EMPTY_DEADLINE); }}>ביטול</Button>
                  )}
                  <Button size="sm" onClick={handleDeadlineSubmit} disabled={!deadlineForm.title || !deadlineForm.date} className="gap-1">
                    <Plus className="w-3.5 h-3.5" />
                    {editDeadlineId ? "עדכן" : "הוסף"}
                  </Button>
                </div>
              </div>
            )}

            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-right p-2.5 font-medium w-8"></th>
                    <th className="text-right p-2.5 font-medium">משימה</th>
                    <th className="text-right p-2.5 font-medium">תאריך</th>
                    <th className="text-right p-2.5 font-medium">אחראי</th>
                    <th className="text-right p-2.5 font-medium">סטטוס</th>
                    {canEdit && <th className="text-right p-2.5 font-medium w-20">פעולות</th>}
                  </tr>
                </thead>
                <tbody>
                  {(eventDeadlines as any[]).length === 0 ? (
                    <tr><td colSpan={canEdit ? 6 : 5} className="text-center py-8 text-muted-foreground">אין דד-ליינים — הוסף את הראשון</td></tr>
                  ) : (eventDeadlines as any[]).map((d: any) => {
                    const isPast = new Date(d.date) < new Date() && !d.completed;
                    return (
                      <tr key={d.id} className={`border-t ${d.completed ? "bg-green-50/50" : isPast ? "bg-red-50/50" : ""}`}>
                        <td className="p-2.5">
                          {canEdit && (
                            <Checkbox
                              checked={!!d.completed}
                              onCheckedChange={(checked) => toggleDeadlineComplete.mutate({ id: d.id, completed: !!checked })}
                            />
                          )}
                        </td>
                        <td className={`p-2.5 font-medium ${d.completed ? "line-through text-muted-foreground" : ""}`}>{d.title}</td>
                        <td className={`p-2.5 ${isPast ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                          {new Date(d.date).toLocaleDateString('he-IL')}
                          {isPast && <span className="mr-1 text-xs">(עבר!)</span>}
                        </td>
                        <td className="p-2.5 text-muted-foreground">{d.responsiblePerson || "—"}</td>
                        <td className="p-2.5">
                          {d.completed ? (
                            <Badge className="bg-green-100 text-green-700 border-0 text-xs gap-1"><Check className="w-3 h-3" />הושלם</Badge>
                          ) : isPast ? (
                            <Badge className="bg-red-100 text-red-700 border-0 text-xs gap-1"><AlertTriangle className="w-3 h-3" />באיחור</Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-700 border-0 text-xs gap-1"><Clock className="w-3 h-3" />ממתין</Badge>
                          )}
                        </td>
                        {canEdit && (
                          <td className="p-2.5">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                                setEditDeadlineId(d.id);
                                setDeadlineForm({ title: d.title, date: d.date?.split("T")[0] || "", responsiblePerson: d.responsiblePerson || "", notes: d.notes || "" });
                              }}><Pencil className="w-3 h-3" /></Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => { if (confirm("למחוק?")) deleteDeadline.mutate(d.id); }}><Trash2 className="w-3 h-3" /></Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              דד-ליינים מופיעים אוטומטית בלוז השבטי בתאריך שלהם
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
