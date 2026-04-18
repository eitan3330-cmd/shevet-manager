import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, Users, AlertCircle, Utensils, Upload, FileSpreadsheet, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import * as XLSX from "xlsx";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const GRADES = ["ד", "ה", "ו", "ז", "ח", "ט", "י", "יא", "יב"];

const GRADE_LEVEL_MAP: Record<string, string> = {
  "ד": "חניכים", "ה": "חניכים", "ו": "חניכים",
  "ז": "חניכים בכירים", "ח": "חניכים בכירים",
  "ט": "שכבת ט׳", "י": "שכבת י׳", "יא": "שכבת י״א", "יב": "שכבת י״ב",
};


const ELEMENTARY_SCHOOLS = ["אביגור", "קורצאק", "מורדי הגטאות", "הלל", "עליות", "עתיד"];
const ELEMENTARY_GRADES = new Set(["ד", "ה", "ו", "ז", "ח"]);
const HIGH_SCHOOL_GRADES = new Set(["ט", "י", "יא", "יב"]);

const FOOD_OPTIONS = [
  { value: "צמחוני", label: "צמחוני 🥦" },
  { value: "טבעוני", label: "טבעוני 🌱" },
  { value: "צליאקי", label: "צליאקי 🌾" },
  { value: "שומר שבת", label: "שומר שבת ✡️" },
];

const FOOD_COLORS: Record<string, string> = {
  "צמחוני": "bg-green-100 text-green-700 border-green-200",
  "טבעוני": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "צליאקי": "bg-amber-100 text-amber-700 border-amber-200",
  "שומר שבת": "bg-blue-100 text-blue-700 border-blue-200",
};

type ScoutForm = {
  name: string; lastName: string; phone: string; battalion: string;
  instructorName: string; grade: string; school: string; foodPreferences: string[]; medicalIssues: string; notes: string;
  birthDate: string;
};
const EMPTY: ScoutForm = { name: "", lastName: "", phone: "", battalion: "", instructorName: "", grade: "", school: "", foodPreferences: [], medicalIssues: "", notes: "", birthDate: "" };

function parseFoodPrefs(str: string | null | undefined): string[] {
  if (!str) return [];
  return str.split(",").map(s => s.trim()).filter(Boolean);
}

function serializeFoodPrefs(prefs: string[]): string {
  return prefs.join(",");
}

type ImportMode = "upsert" | "merge";

type ImportPreview = {
  rows: any[];
  headers: string[];
  hasGizra: boolean;
};

type MergeResult = {
  updated: number;
  notFound: number;
  notFoundNames: string[];
};

export function Scouts() {
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [battalionFilter, setBattalionFilter] = useState("all");
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ScoutForm>(EMPTY);
  const [tab, setTab] = useState<"list" | "medical" | "food">("list");
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [defaultBattalion, setDefaultBattalion] = useState("");
  const [importMode, setImportMode] = useState<ImportMode>("upsert");
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { role } = useAuth();
  const qc = useQueryClient();

  const { data: scouts = [], isLoading } = useQuery({
    queryKey: ["scouts-raw"],
    queryFn: () => fetch(`${API_BASE}/api/scouts`).then(r => r.json()),
  });

  const createScout = useMutation({
    mutationFn: (data: any) => fetch(`${API_BASE}/api/scouts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["scouts-raw"] }); setIsOpen(false); setForm(EMPTY); toast({ title: "חניך נוסף" }); },
  });

  const updateScout = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => fetch(`${API_BASE}/api/scouts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["scouts-raw"] }); setIsOpen(false); toast({ title: "חניך עודכן" }); },
  });

  const deleteScout = useMutation({
    mutationFn: (id: number) => fetch(`${API_BASE}/api/scouts/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["scouts-raw"] }); toast({ title: "חניך נמחק" }); },
  });

  const handleEdit = (s: any) => {
    setEditId(s.id);
    setForm({
      name: s.name || "", lastName: s.lastName || "", phone: s.phone || "",
      battalion: s.battalion || "", instructorName: s.instructorName || "",
      grade: s.grade || "", school: s.school || "", foodPreferences: parseFoodPrefs(s.foodPreferences),
      medicalIssues: s.medicalIssues || "", notes: s.notes || "",
      birthDate: s.birthDate || "",
    });
    setIsOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name) return;
    const gradeLevel = form.grade ? GRADE_LEVEL_MAP[form.grade] || null : null;
    const data = { ...form, gizra: null, foodPreferences: serializeFoodPrefs(form.foodPreferences), gradeLevel, role: "chanich", tribeRole: null, parentPhone: null };
    if (editId) updateScout.mutate({ id: editId, data });
    else createScout.mutate(data);
  };

  // Birthday reminders: scouts with birthdays in next 30 days
  const upcomingBirthdays = (() => {
    const today = new Date();
    const toDay = today.getMonth() * 32 + today.getDate();
    return (scouts as any[])
      .filter(s => s.birthDate)
      .map(s => {
        const d = new Date(s.birthDate);
        const bDay = d.getMonth() * 32 + d.getDate();
        let diff = bDay - toDay;
        if (diff < 0) diff += 12 * 32;
        return { ...s, daysUntil: diff };
      })
      .filter(s => s.daysUntil <= 30)
      .sort((a, b) => a.daysUntil - b.daysUntil);
  })();

  const toggleFood = (val: string) => {
    setForm(p => ({
      ...p,
      foodPreferences: p.foodPreferences.includes(val)
        ? p.foodPreferences.filter(f => f !== val)
        : [...p.foodPreferences, val],
    }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (json.length === 0) { toast({ title: "הקובץ ריק", variant: "destructive" }); return; }

        const COL_MAP: Record<string, string> = {
          "שם פרטי": "name", "שם": "name", "שם חניך": "name", "first name": "name",
          "שם משפחה": "lastName", "משפחה": "lastName", "last name": "lastName",
          "טלפון": "phone", "טלפון חניך": "phone", "נייד": "phone", "פלאפון": "phone",
          "טלפון הורה": "parentPhone", "טלפון הורים": "parentPhone", "נייד הורה": "parentPhone",
          "גזרה": "gizra", "גיזרה": "gizra", "קבוצה": "gizra",
          "גדוד": "battalion", "גדודים": "battalion",
          "מדריך": "instructorName", "שם מדריך": "instructorName", "מחנך": "instructorName",
          "כיתה": "grade", "שכבה": "grade", "כתה": "grade",
          "בית ספר": "school", 'בי"ס': "school", 'ביה"ס': "school", "בית-ספר": "school",
          "שם בית הספר": "school",
          "תאריך לידה": "birthDate", "ת. לידה": "birthDate",
          "העדפות מזון": "foodPreferences", "מזון": "foodPreferences",
          "בעיות רפואיות": "medicalIssues", "רפואי": "medicalIssues",
          "אלרגיות ומחלות": "medicalIssues",
          "אלרגיות ומחלות אחרות": "medicalOther",
          "מין": "gender",
          "הערות": "notes",
        };

        const headers = Object.keys(json[0]);
        const isMedicalFile = headers.some(h => h === "אלרגיות ומחלות");
        const isFoodFile = headers.some(h => h === "העדפות מזון") && !headers.some(h => h === "שם בית הספר");

        let mapped: any[];

        if (isMedicalFile) {
          const grouped = new Map<string, any>();
          for (const row of json) {
            const r: any = {};
            for (const [heb, eng] of Object.entries(COL_MAP)) {
              const val = row[heb];
              if (val !== undefined && val !== "") {
                if (!r[eng]) r[eng] = String(val).trim();
              }
            }
            if (r.grade) r.grade = r.grade.replace(/['"׳]/g, "").trim();
            if (!r.name || r.name.length < 2) continue;
            const key = `${r.name}|${r.lastName || ""}`;
            const existing = grouped.get(key);
            if (existing) {
              const issues: string[] = [];
              if (existing.medicalIssues) issues.push(...existing.medicalIssues.split(",").map((s: string) => s.trim()));
              if (r.medicalIssues && r.medicalIssues !== "-") issues.push(r.medicalIssues);
              if (r.medicalOther && r.medicalOther !== "-") issues.push(r.medicalOther);
              existing.medicalIssues = [...new Set(issues)].filter(Boolean).join(", ");
            } else {
              const issues: string[] = [];
              if (r.medicalIssues && r.medicalIssues !== "-") issues.push(r.medicalIssues);
              if (r.medicalOther && r.medicalOther !== "-") issues.push(r.medicalOther);
              r.medicalIssues = issues.join(", ");
              delete r.medicalOther;
              grouped.set(key, r);
            }
          }
          mapped = Array.from(grouped.values());
          if (!importMode || importMode === "upsert") setImportMode("merge");
        } else if (isFoodFile) {
          mapped = json.map(row => {
            const r: any = {};
            for (const [heb, eng] of Object.entries(COL_MAP)) {
              const val = row[heb];
              if (val !== undefined && val !== "") {
                if (!r[eng]) r[eng] = String(val).trim();
              }
            }
            if (r.grade) r.grade = r.grade.replace(/['"׳]/g, "").trim();
            return r;
          }).filter(r => r.name && r.name.length > 1);
          if (!importMode || importMode === "upsert") setImportMode("merge");
        } else {
          mapped = json.map(row => {
            const r: any = {};
            for (const [heb, eng] of Object.entries(COL_MAP)) {
              const val = row[heb];
              if (val !== undefined && val !== "") {
                if (!r[eng]) r[eng] = String(val).trim();
              }
            }
            if (r.grade) r.grade = r.grade.replace(/['"׳]/g, "").trim();
            return r;
          }).filter(r => r.name && r.name.length > 1);
        }

        const hasGizra = mapped.some(r => r.gizra);
        setDefaultBattalion("");
        setImportPreview({ rows: mapped, headers, hasGizra });
        setImportOpen(true);
      } catch {
        toast({ title: "שגיאה בקריאת הקובץ", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const resetImportDialog = () => {
    setImportOpen(false);
    setImportPreview(null);
    setDefaultBattalion("");
    setMergeResult(null);
  };

  const handleImportConfirm = async () => {
    if (!importPreview) return;
    setImportLoading(true);
    try {
      if (importMode === "merge") {
        const res = await fetch(`${API_BASE}/api/scouts/merge-details`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: importPreview.rows }),
        });
        const result: MergeResult = await res.json();
        if (!res.ok) throw new Error(result && (result as any).error || "שגיאה בעדכון");
        qc.invalidateQueries({ queryKey: ["scouts-raw"] });
        setImportPreview(null);
        setMergeResult(result);
        toast({ title: `עדכון הושלם: ${result.updated} חניכים עודכנו` });
      } else {
        const rows = importPreview.rows.map(r => ({
          ...r,
          battalion: r.battalion || defaultBattalion || null,
        }));
        const res = await fetch(`${API_BASE}/api/scouts/import-bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result?.error || "שגיאה בייבוא");
        qc.invalidateQueries({ queryKey: ["scouts-raw"] });
        toast({ title: `ייבוא הושלם: ${result.added} נוספו, ${result.updated} עודכנו, ${result.skipped} דולגו` });
        resetImportDialog();
      }
    } catch {
      toast({ title: "שגיאה בייבוא", variant: "destructive" });
    } finally {
      setImportLoading(false);
    }
  };

  const canEdit = ["marcaz_boger", "marcaz_tzair"].includes(role || "");

  const filtered = (scouts as any[]).filter(s => {
    const matchSearch = !search || `${s.name} ${s.lastName || ""}`.includes(search);
    const matchGrade = gradeFilter === "all" || s.grade === gradeFilter;
    const matchBattalion = battalionFilter === "all" || s.battalion === battalionFilter;
    return matchSearch && matchGrade && matchBattalion;
  });

  const battalions = [...new Set((scouts as any[]).map(s => s.battalion).filter(Boolean))].sort();
  const withMedical = filtered.filter(s => s.medicalIssues);
  const withFood = filtered.filter(s => s.foodPreferences);

  const groupByGrade: Record<string, any[]> = {};
  filtered.forEach(s => {
    const level = s.grade ? GRADE_LEVEL_MAP[s.grade] || "אחר" : "ללא כיתה";
    if (!groupByGrade[level]) groupByGrade[level] = [];
    groupByGrade[level].push(s);
  });

  const gradeOrder = ["פעילים", "שכבה ט", "חניכים בכירים", "חניכים", "ללא כיתה", "אחר"];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold">מאגר חניכים</h2>
          <p className="text-muted-foreground">{(scouts as any[]).length} חניכים במאגר</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
              <FileSpreadsheet className="w-4 h-4" /> העלה Excel
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} />
            <Button onClick={() => { setEditId(null); setForm(EMPTY); setIsOpen(true); }} className="gap-2">
              <Plus className="w-4 h-4" /> חניך חדש
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "סה״כ חניכים", value: (scouts as any[]).length },
          { label: "פעילים י-יב", value: (scouts as any[]).filter(s => ["י", "יא", "יב"].includes(s.grade)).length, color: "text-blue-600" },
          { label: "בעיות רפואיות", value: (scouts as any[]).filter(s => s.medicalIssues).length, color: "text-red-600" },
          { label: "העדפות מזון", value: (scouts as any[]).filter(s => s.foodPreferences).length, color: "text-amber-600" },
        ].map(s => (
          <Card key={s.label}><CardContent className="pt-4 pb-3 text-center">
            <p className={`text-2xl font-bold ${s.color || ""}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Birthday reminders banner */}
      {upcomingBirthdays.length > 0 && (
        <div className="rounded-xl border border-pink-200 bg-pink-50/60 px-4 py-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-base">🎂</span>
            <span className="font-semibold text-pink-800 text-sm">יום הולדת בחודש הקרוב ({upcomingBirthdays.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {upcomingBirthdays.map(s => (
              <span key={s.id} className="flex items-center gap-1.5 text-xs bg-white border border-pink-200 rounded-full px-3 py-1 text-pink-800 shadow-sm">
                <span className="font-medium">{s.name} {s.lastName || ""}</span>
                {s.daysUntil === 0 ? (
                  <span className="bg-pink-500 text-white px-1.5 py-0.5 rounded-full text-[10px]">היום!</span>
                ) : (
                  <span className="text-pink-500">בעוד {s.daysUntil} ימים</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input className="pr-9" placeholder="חיפוש לפי שם..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={gradeFilter} onValueChange={setGradeFilter}>
          <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הכיתות</SelectItem>
            {GRADES.map(g => <SelectItem key={g} value={g}>כיתה {g}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={battalionFilter} onValueChange={setBattalionFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הגדודים</SelectItem>
            {battalions.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-1.5">
        {[{ id: "list", label: "רשימה" }, { id: "medical", label: `בעיות רפואיות (${withMedical.length})` }, { id: "food", label: `העדפות מזון (${withFood.length})` }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      ) : tab === "medical" ? (
        <div className="space-y-2">
          {withMedical.length === 0 ? <p className="text-center py-8 text-muted-foreground">אין חניכים עם בעיות רפואיות</p> : withMedical.map((s: any) => (
            <div key={s.id} className="border rounded-xl p-3 bg-red-50/50 border-red-100 flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{s.name} {s.lastName || ""}</p>
                <p className="text-xs text-muted-foreground">{[s.battalion, s.grade ? (HIGH_SCHOOL_GRADES.has(s.grade) ? GRADE_LEVEL_MAP[s.grade] || s.grade : `כיתה ${s.grade}`) : "", s.instructorName ? `מדריך: ${s.instructorName}` : ""].filter(Boolean).join(" • ")}</p>
                <p className="text-sm text-red-700 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" />{s.medicalIssues}</p>
              </div>
            </div>
          ))}
        </div>
      ) : tab === "food" ? (
        <div className="space-y-2">
          {withFood.length === 0 ? <p className="text-center py-8 text-muted-foreground">אין חניכים עם העדפות מזון מיוחדות</p> : withFood.map((s: any) => (
            <div key={s.id} className="border rounded-xl p-3 bg-amber-50/50 border-amber-100">
              <p className="font-semibold">{s.name} {s.lastName || ""}</p>
              <p className="text-xs text-muted-foreground mb-1">{[s.battalion, s.grade ? (HIGH_SCHOOL_GRADES.has(s.grade) ? GRADE_LEVEL_MAP[s.grade] || s.grade : `כיתה ${s.grade}`) : ""].filter(Boolean).join(" • ")}</p>
              <div className="flex flex-wrap gap-1">
                {parseFoodPrefs(s.foodPreferences).map(pref => (
                  <span key={pref} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${FOOD_COLORS[pref] || "bg-muted text-muted-foreground border-border"}`}>
                    {pref}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-xl">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>לא נמצאו חניכים</p>
        </div>
      ) : (
        <div className="space-y-4">
          {gradeOrder.filter(level => groupByGrade[level]?.length > 0).map(level => (
            <div key={level}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-muted rounded-md">{level}</span>
                <span>({groupByGrade[level].length})</span>
              </h3>
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-right p-3 font-medium">שם</th>
                      <th className="text-right p-3 font-medium hidden md:table-cell">שם משפחה</th>
                      <th className="text-right p-3 font-medium">כיתה</th>
                      <th className="text-right p-3 font-medium hidden sm:table-cell">בית ספר</th>
                      <th className="text-right p-3 font-medium hidden md:table-cell">גדוד</th>
                      <th className="text-right p-3 font-medium hidden md:table-cell">מדריך</th>
                      <th className="p-3 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {groupByGrade[level].map((s: any, i: number) => (
                      <tr key={s.id} className={`${i % 2 === 0 ? "bg-background" : "bg-muted/10"} hover:bg-muted/20 transition-colors`}>
                        <td className="p-3 font-medium">
                          {s.name}
                          {s.medicalIssues && <span title={s.medicalIssues}><AlertCircle className="w-3.5 h-3.5 inline mr-1 text-red-500" /></span>}
                          {s.foodPreferences && <span title={s.foodPreferences}><Utensils className="w-3.5 h-3.5 inline mr-1 text-amber-500" /></span>}
                        </td>
                        <td className="p-3 text-muted-foreground hidden md:table-cell">{s.lastName || "—"}</td>
                        <td className="p-3">{s.grade ? (HIGH_SCHOOL_GRADES.has(s.grade) ? GRADE_LEVEL_MAP[s.grade] || s.grade : `כיתה ${s.grade}`) : "—"}</td>
                        <td className="p-3 text-muted-foreground hidden sm:table-cell">{s.school || "—"}</td>
                        <td className="p-3 text-muted-foreground hidden md:table-cell">{s.battalion || "—"}</td>
                        <td className="p-3 text-muted-foreground hidden md:table-cell">{s.instructorName || "—"}</td>
                        <td className="p-3">
                          {canEdit && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(s)}><Pencil className="w-3.5 h-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("למחוק?")) deleteScout.mutate(s.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editId ? "עריכת חניך" : "חניך חדש"}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[75vh] overflow-y-auto px-1">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">שם פרטי *</label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div><label className="text-xs text-muted-foreground">שם משפחה</label><Input value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">גדוד</label>
                <Input placeholder="שם הגדוד" value={form.battalion} onChange={e => setForm(p => ({ ...p, battalion: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">כיתה</label>
                <Select value={form.grade || "none"} onValueChange={v => setForm(p => ({ ...p, grade: v === "none" ? "" : v, school: "" }))}>
                  <SelectTrigger><SelectValue placeholder="בחר כיתה" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ללא</SelectItem>
                    {GRADES.map(g => <SelectItem key={g} value={g}>כיתה {g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">בית ספר</label>
              {form.grade && ELEMENTARY_GRADES.has(form.grade) ? (
                <Select value={form.school || "none"} onValueChange={v => setForm(p => ({ ...p, school: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="בחר בית ספר" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ללא</SelectItem>
                    {ELEMENTARY_SCHOOLS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : form.grade && HIGH_SCHOOL_GRADES.has(form.grade) ? (
                <Input
                  placeholder="שם בית הספר (תיכון)"
                  value={form.school}
                  onChange={e => setForm(p => ({ ...p, school: e.target.value }))}
                />
              ) : (
                <Input
                  placeholder="שם בית הספר"
                  value={form.school}
                  onChange={e => setForm(p => ({ ...p, school: e.target.value }))}
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">מדריך</label><Input placeholder="שם המדריך" value={form.instructorName} onChange={e => setForm(p => ({ ...p, instructorName: e.target.value }))} /></div>
              <div><label className="text-xs text-muted-foreground">טלפון</label><Input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">תאריך לידה</label>
              <Input type="date" value={form.birthDate} onChange={e => setForm(p => ({ ...p, birthDate: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5"><Utensils className="w-3.5 h-3.5 text-amber-500" />העדפות מזון</label>
              <div className="grid grid-cols-2 gap-2">
                {FOOD_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleFood(opt.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-right transition-all ${
                      form.foodPreferences.includes(opt.value)
                        ? "bg-amber-50 border-amber-300 text-amber-800 font-medium"
                        : "bg-background border-border text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <CheckSquare className={`w-4 h-4 shrink-0 ${form.foodPreferences.includes(opt.value) ? "text-amber-600" : "text-muted-foreground/40"}`} />
                    {opt.label}
                  </button>
                ))}
              </div>
              {form.foodPreferences.length > 0 && (
                <p className="text-xs text-amber-600">נבחר: {form.foodPreferences.join(", ")}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 text-red-500" />בעיות רפואיות</label>
              <Textarea placeholder="אסטמה, סכרת, תרופות..." value={form.medicalIssues} onChange={e => setForm(p => ({ ...p, medicalIssues: e.target.value }))} rows={2} />
            </div>
            <div><label className="text-sm font-medium">הערות</label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
            <Button className="w-full" onClick={handleSubmit} disabled={!form.name}>
              {editId ? "שמור שינויים" : "הוסף חניך"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import preview dialog */}
      <Dialog open={importOpen} onOpenChange={v => { if (!v) resetImportDialog(); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              {importMode === "merge" ? "עדכון פרטי חניכים מקובץ" : "ייבוא חניכים מקובץ"}
            </DialogTitle>
          </DialogHeader>

          {/* Mode toggle — shown at top when preview is loaded */}
          {importPreview && (
            <div className="flex gap-2 p-1 bg-muted rounded-lg">
              <button
                type="button"
                onClick={() => setImportMode("upsert")}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                  importMode === "upsert" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                הוסף / עדכן חניכים
              </button>
              <button
                type="button"
                onClick={() => setImportMode("merge")}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                  importMode === "merge" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                עדכון פרטים בלבד
              </button>
            </div>
          )}

          {/* Merge result screen */}
          {mergeResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center border rounded-xl p-4 bg-green-50">
                  <p className="text-3xl font-bold text-green-600">{mergeResult.updated}</p>
                  <p className="text-sm text-green-700 mt-1">חניכים עודכנו</p>
                </div>
                <div className="text-center border rounded-xl p-4 bg-amber-50">
                  <p className="text-3xl font-bold text-amber-600">{mergeResult.notFound}</p>
                  <p className="text-sm text-amber-700 mt-1">לא נמצאו במאגר</p>
                </div>
              </div>
              {mergeResult.notFoundNames.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-amber-800">שמות שלא נמצאו:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {mergeResult.notFoundNames.map((name, i) => (
                      <span key={i} className="text-xs bg-white border border-amber-200 rounded-full px-2 py-0.5 text-amber-800">{name}</span>
                    ))}
                  </div>
                  <p className="text-xs text-amber-600">ייתכן שהשמות שונים מהמאגר — ניתן לעדכן ידנית</p>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={resetImportDialog}>סגור</Button>
                <Button variant="outline" onClick={() => { setMergeResult(null); fileRef.current?.click(); }}>
                  <FileSpreadsheet className="w-4 h-4 ml-1" /> העלה קובץ נוסף
                </Button>
              </div>
            </div>
          )}

          {/* Preview table */}
          {importPreview && (
            <div className="space-y-3">

              {/* Mode description */}
              {importMode === "merge" ? (
                <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg text-purple-800 text-sm">
                  <FileSpreadsheet className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <strong>עדכון פרטים בלבד</strong> — {importPreview.rows.length} שורות בקובץ.
                    המערכת תחפש כל חניך לפי שם במאגר ותעדכן רק את השדות הקיימים בקובץ.
                    לא ייווצרו חניכים חדשים.
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg text-blue-800 text-sm">
                  <FileSpreadsheet className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    נמצאו <strong>{importPreview.rows.length}</strong> חניכים לייבוא.
                    חניכים קיימים (לפי שם או טלפון) יעודכנו, חדשים יתווספו.
                  </div>
                </div>
              )}

              {/* Battalion default — only in upsert mode */}
              {importMode === "upsert" && (
                <div className="rounded-lg border border-muted bg-muted/20 p-3 space-y-2">
                  <p className="text-sm font-medium">גדוד ברירת מחדל (לחניכים שאין להם גדוד בקובץ):</p>
                  <Input
                    className="bg-white text-sm"
                    placeholder="לדוגמה: גדוד כ׳..."
                    value={defaultBattalion}
                    onChange={e => setDefaultBattalion(e.target.value)}
                  />
                </div>
              )}

              {/* Preview table */}
              <div className="border rounded-xl overflow-auto max-h-56 text-sm">
                <table className="w-full">
                  <thead className="bg-muted/30 sticky top-0">
                    <tr>
                      <th className="text-right p-2 font-medium">שם</th>
                      {importMode === "upsert" && <th className="text-right p-2 font-medium">גדוד</th>}
                      {importMode === "upsert" && <th className="text-right p-2 font-medium">כיתה</th>}
                      {importPreview.rows.some(r => r.foodPreferences) && <th className="text-right p-2 font-medium">מזון</th>}
                      {importPreview.rows.some(r => r.medicalIssues) && <th className="text-right p-2 font-medium">רפואי</th>}
                      {importMode === "upsert" && <th className="text-right p-2 font-medium hidden sm:table-cell">מדריך</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.rows.slice(0, 30).map((r, i) => (
                      <tr key={i} className={i % 2 === 0 ? "" : "bg-muted/10"}>
                        <td className="p-2 font-medium">{[r.name, r.lastName].filter(Boolean).join(" ")}</td>
                        {importMode === "upsert" && (
                          <td className="p-2">
                            {r.battalion || (defaultBattalion
                              ? <span className="text-amber-600">{defaultBattalion}</span>
                              : <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                        )}
                        {importMode === "upsert" && <td className="p-2 text-muted-foreground">{r.grade ? `כיתה ${r.grade}` : "—"}</td>}
                        {importPreview.rows.some(r => r.foodPreferences) && (
                          <td className="p-2 text-xs text-green-700">{r.foodPreferences || "—"}</td>
                        )}
                        {importPreview.rows.some(r => r.medicalIssues) && (
                          <td className="p-2 text-xs text-red-700">{r.medicalIssues || "—"}</td>
                        )}
                        {importMode === "upsert" && (
                          <td className="p-2 text-muted-foreground text-xs hidden sm:table-cell">{[r.battalion, r.instructorName].filter(Boolean).join(" / ") || "—"}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {importPreview.rows.length > 30 && (
                  <p className="text-center text-xs text-muted-foreground py-2">...ועוד {importPreview.rows.length - 30} שורות</p>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={resetImportDialog}>ביטול</Button>
                <Button
                  onClick={handleImportConfirm}
                  disabled={importLoading}
                  className="gap-2"
                >
                  {importLoading
                    ? "מעדכן..."
                    : importMode === "merge"
                      ? <><Upload className="w-4 h-4" /> עדכן פרטים ({importPreview.rows.length})</>
                      : <><Upload className="w-4 h-4" /> ייבא {importPreview.rows.length} חניכים</>
                  }
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
