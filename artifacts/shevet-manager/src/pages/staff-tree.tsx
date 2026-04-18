import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, Crown, Star, Shield, Flag, User, Plus, Trash2,
  Lock, Unlock, Settings, Pencil, Check, X, UserPlus, ChevronDown,
  AlertTriangle, Sparkles, BookOpen, Zap, Upload, FileSpreadsheet, GripVertical, ArrowLeftRight,
  RefreshCw, Loader2
} from "lucide-react";
import * as XLSX from "xlsx";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const ROLE_META: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ElementType; order: number }> = {
  marcaz_boger: { label: "מרכז בוגר", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", icon: Crown, order: 1 },
  marcaz_tzair: { label: "מרכז צעיר", color: "text-red-700", bg: "bg-red-50", border: "border-red-200", icon: Star, order: 2 },
  roshatz: { label: "ראשצ", color: "text-sky-700", bg: "bg-sky-50", border: "border-sky-200", icon: Shield, order: 3 },
  roshgad: { label: "ראשגד", color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200", icon: Flag, order: 4 },
};

const ROLE_OPTIONS = [
  { value: "marcaz_boger", label: "מרכז בוגר" },
  { value: "marcaz_tzair", label: "מרכז צעיר" },
  { value: "roshatz", label: "ראשצ" },
  { value: "roshgad", label: "ראשגד" },
];

const NEXT_YEAR_ROLE_OPTIONS = [
  { value: "lo_meshubach", label: "לא משובץ" },
  { value: "madrich", label: "מדריך" },
  { value: "pael", label: "פעיל" },
];

const GRADES = ["ד", "ה", "ו", "ז", "ח", "ט", "י", "יא", "יב"];
const PAELIM_GRADES = new Set(["י", "יא", "יב"]);
const CHANICHIM_GRADES = new Set(["ד", "ה", "ו", "ז", "ח"]);
const CANDIDATE_MADRICH_GRADES = new Set(["ט"]);
const CANDIDATE_PAEL_GRADES = new Set(["י", "יא"]);

// Org structure: which ראשצ battalions belong to each wing
const HADRACHA_ROSHGAD_COLS = ["ד", "ה", "ו", "ז", "ח", "קורס"];
const PAELIM_ROSHATZ_GROUPS = [
  { label: "ראשצ שכבות", cols: ["מחסן", "קיוסק", "צופיות+קיימות", "שכבג", "פעילים", 'צפ"ש+תחזוקה'] },
  { label: "אחראי תחום", cols: ["צופים לכל", "קהילה", "להב", "מועדון רעות", "אור כתום", "גזברות+מפעלים"] },
];
const HAGBARAA_COLS = ["הגברה", "חשמל", "הגברה וחשמל"];

type TribeUser = {
  id: number;
  name: string;
  role: string;
  battalion?: string | null;
  team?: string | null;
  grade?: string | null;
  active: boolean;
  scoutId?: number | null;
};

type Scout = {
  id: number;
  name: string;
  lastName?: string;
  grade?: string;
  battalion?: string;
  school?: string;
  instructorName?: string;
  gizra?: string;
};

type AppSettings = Record<string, string>;

type NextYearAssignment = {
  id: number;
  scoutId: number;
  proposedRole: string;
  proposedBattalion?: string | null;
  notes?: string | null;
  yearLabel: string;
  locked?: boolean;
  approvedBy?: string | null;
  releaseDate?: string | null;
  released?: boolean;
};

function AddUserRow({ onAdd }: { onAdd: (u: { name: string; role: string; battalion?: string }) => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("marcaz_tzair");
  const [battalion, setBattalion] = useState("");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border border-dashed border-muted-foreground/30 text-muted-foreground text-sm hover:bg-muted/30 hover:border-muted-foreground/50 transition-all mt-2">
        <Plus className="w-4 h-4" /> הוסף חבר צוות
      </button>
    );
  }

  return (
    <div className="mt-2 p-3 rounded-xl border bg-muted/20 space-y-2">
      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="שם מלא"
          className="flex-1 min-w-32 h-8 text-sm"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && name.trim()) {
              onAdd({ name: name.trim(), role, battalion: battalion.trim() || undefined });
              setName(""); setBattalion(""); setOpen(false);
            }
          }}
          autoFocus
        />
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
        </Select>
        <Input
          placeholder="גדוד (אופציונלי)"
          className="w-32 h-8 text-sm"
          value={battalion}
          onChange={e => setBattalion(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          className="h-7 text-xs"
          disabled={!name.trim()}
          onClick={() => {
            onAdd({ name: name.trim(), role, battalion: battalion.trim() || undefined });
            setName(""); setBattalion(""); setOpen(false);
          }}>
          <Check className="w-3 h-3 ml-1" /> הוסף
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setOpen(false); setName(""); setBattalion(""); }}>
          <X className="w-3 h-3 ml-1" /> ביטול
        </Button>
      </div>
    </div>
  );
}

function UserCard({ user, canEdit, onRemove, onEdit }: {
  user: TribeUser;
  canEdit: boolean;
  onRemove: (id: number) => void;
  onEdit: (id: number, data: { name?: string; role?: string; battalion?: string | null }) => void;
}) {
  const meta = ROLE_META[user.role] || { label: user.role, color: "text-gray-700", bg: "bg-gray-50", border: "border-gray-200", icon: User, order: 9 };
  const Icon = meta.icon;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [battalion, setBattalion] = useState(user.battalion || "");
  const [editRole, setEditRole] = useState(user.role);

  const handleSave = () => {
    onEdit(user.id, { name: name.trim() || user.name, role: editRole, battalion: battalion.trim() || null });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className={`flex flex-col gap-2 px-3 py-2 rounded-xl border ${meta.border} ${meta.bg} shadow-sm`}>
        <div className="flex gap-2 flex-wrap">
          <Input value={name} onChange={e => setName(e.target.value)} className="h-7 text-sm flex-1 min-w-24"
            autoFocus onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }} />
          <Input value={battalion} onChange={e => setBattalion(e.target.value)} placeholder="גדוד" className="h-7 text-sm w-24" />
          <Select value={editRole} onValueChange={setEditRole}>
            <SelectTrigger className="h-7 text-sm w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} className="text-green-600 hover:bg-green-50 px-2 py-0.5 rounded text-xs flex items-center gap-1 border border-green-200"><Check className="w-3 h-3" /> שמור</button>
          <button onClick={() => { setEditing(false); setName(user.name); setBattalion(user.battalion || ""); setEditRole(user.role); }} className="text-muted-foreground hover:bg-muted px-2 py-0.5 rounded text-xs flex items-center gap-1 border"><X className="w-3 h-3" /> ביטול</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${meta.border} ${meta.bg} shadow-sm group`}>
      <div className={`w-9 h-9 rounded-full flex items-center justify-center bg-white border ${meta.border} shrink-0`}>
        <Icon className={`w-4 h-4 ${meta.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-tight">{user.name}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className={`text-xs font-medium ${meta.color}`}>{meta.label}</p>
          {user.battalion && (
            <span className="text-xs text-muted-foreground">· גדוד {user.battalion}</span>
          )}
        </div>
      </div>
      {canEdit && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
          <button onClick={() => setEditing(true)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-white/60 hover:text-foreground transition-all">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onRemove(user.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600 transition-all">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function LockToggle({ label, description, settingKey, value, onChange, locked }: {
  label: string; description: string; settingKey: string; value: boolean; onChange: (key: string, val: boolean) => void; locked: boolean;
}) {
  return (
    <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${value ? "border-amber-300 bg-amber-50" : "border-border bg-card"}`}>
      <div className="flex items-center gap-3">
        {value ? <Lock className="w-5 h-5 text-amber-600" /> : <Unlock className="w-5 h-5 text-muted-foreground" />}
        <div>
          <p className="font-semibold text-sm">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={value} onCheckedChange={v => onChange(settingKey, v)} disabled={locked} />
    </div>
  );
}

function ScoutAssignmentCard({
  scout,
  assignment,
  yearLabel,
  candidateType,
  onSave,
  isPending,
}: {
  scout: Scout;
  assignment?: NextYearAssignment;
  yearLabel: string;
  candidateType: "madrich" | "pael";
  onSave: (data: { scoutId: number; proposedRole: string; proposedBattalion?: string; notes?: string; yearLabel: string }) => void;
  isPending: boolean;
}) {
  const currentRole = assignment?.proposedRole || "lo_meshubach";
  const [expanded, setExpanded] = useState(false);
  const [role, setRole] = useState(currentRole);
  const [battalion, setBattalion] = useState(assignment?.proposedBattalion || "");
  const [notes, setNotes] = useState(assignment?.notes || "");
  const [dirty, setDirty] = useState(false);

  const roleMeta: Record<string, { label: string; color: string; bg: string; border: string }> = {
    madrich: { label: "מדריך", color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200" },
    pael: { label: "פעיל", color: "text-sky-700", bg: "bg-sky-50", border: "border-sky-200" },
    lo_meshubach: { label: "לא משובץ", color: "text-muted-foreground", bg: "bg-muted/30", border: "border-border" },
  };

  const meta = roleMeta[currentRole] || roleMeta.lo_meshubach;
  const isUnassigned = currentRole === "lo_meshubach";

  const handleSave = () => {
    onSave({ scoutId: scout.id, proposedRole: role, proposedBattalion: battalion || undefined, notes: notes || undefined, yearLabel });
    setDirty(false);
    setExpanded(false);
  };

  return (
    <div className={`rounded-xl border transition-all ${meta.border} ${isUnassigned ? "bg-card" : meta.bg}`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${meta.bg} border ${meta.border} ${meta.color}`}>
          {scout.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight">{scout.name}{scout.lastName ? ` ${scout.lastName}` : ""}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {scout.grade && <span className="text-xs text-muted-foreground">כיתה {scout.grade}</span>}
            {scout.battalion && <span className="text-xs text-muted-foreground">· גדוד {scout.battalion}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${meta.border} ${meta.bg} ${meta.color}`}>
            {roleMeta[currentRole]?.label || "לא משובץ"}
          </span>
          <button
            onClick={() => { setExpanded(!expanded); setRole(currentRole); setBattalion(assignment?.proposedBattalion || ""); setNotes(assignment?.notes || ""); setDirty(false); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-all">
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-border/50 pt-3 space-y-2">
          <div className="flex gap-2 flex-wrap">
            <Select value={role} onValueChange={v => { setRole(v); setDirty(true); }}>
              <SelectTrigger className="h-8 text-sm flex-1 min-w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NEXT_YEAR_ROLE_OPTIONS.filter(o =>
                  candidateType === "madrich" ? o.value !== "pael" : o.value !== "madrich"
                ).map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {role === "madrich" && (
              <Input
                placeholder="גדוד לשנה הבאה"
                value={battalion}
                onChange={e => { setBattalion(e.target.value); setDirty(true); }}
                className="h-8 text-sm w-36"
              />
            )}
          </div>
          <Input
            placeholder="הערות..."
            value={notes}
            onChange={e => { setNotes(e.target.value); setDirty(true); }}
            className="h-8 text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={isPending || !dirty}>
              <Check className="w-3 h-3 ml-1" /> שמור
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setExpanded(false); setDirty(false); }}>
              ביטול
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActivateConfirmDialog({
  yearLabel,
  madrichCount,
  paelCount,
  unassignedCount,
  onConfirm,
  onCancel,
  isPending,
}: {
  yearLabel: string;
  madrichCount: number;
  paelCount: number;
  unassignedCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-lg">הפעלת שיבוץ לשנה הבאה</h3>
            <p className="text-sm text-muted-foreground">פעולה זו תעדכן את מאגר החניכים</p>
          </div>
        </div>

        <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
          <p className="text-sm font-semibold">שנה: <span className="text-blue-700">{yearLabel}</span></p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2"><Flag className="w-4 h-4 text-rose-500" /> ישובצו כמדריכים</span>
              <span className="font-bold text-rose-700">{madrichCount}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2"><Shield className="w-4 h-4 text-sky-500" /> ישובצו כפעילים</span>
              <span className="font-bold text-sky-700">{paelCount}</span>
            </div>
            {unassignedCount > 0 && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>לא משובצים (יישארו ללא שינוי)</span>
                <span>{unassignedCount}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <p>פעולה זו תעדכן את תפקיד החניכים הנבחרים במסד הנתונים. פעולה זו אינה הפיכה.</p>
        </div>

        <div className="flex gap-3">
          <Button className="flex-1 bg-blue-700 hover:bg-blue-800" onClick={onConfirm} disabled={isPending}>
            {isPending ? "מפעיל..." : "אשר והפעל שיבוץ"}
          </Button>
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isPending}>
            ביטול
          </Button>
        </div>
      </div>
    </div>
  );
}

type YearArchive = {
  id: number;
  yearLabel: string;
  closedAt: string;
  scoutsData?: any[];
  staffData?: any[];
  notes?: string;
};

function ArchiveViewer({ archive }: { archive: YearArchive }) {
  const staff = (archive.staffData || []) as any[];
  const archivedScouts = (archive.scoutsData || []) as any[];

  const madrichim = staff.filter((s: any) => s.role === "madrich");
  const paelim = staff.filter((s: any) => s.role === "pael");
  const roshgadim = staff.filter((s: any) => s.role === "roshgad");

  const battalionGroups = new Map<string, any[]>();
  madrichim.forEach((m: any) => {
    const bn = m.battalion || "ללא גדוד";
    if (!battalionGroups.has(bn)) battalionGroups.set(bn, []);
    battalionGroups.get(bn)!.push(m);
  });

  const scoutsByBattalion = new Map<string, number>();
  archivedScouts.filter((s: any) => s.grade && CHANICHIM_GRADES.has(s.grade)).forEach((s: any) => {
    const bn = s.battalion || "ללא";
    scoutsByBattalion.set(bn, (scoutsByBattalion.get(bn) || 0) + 1);
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-rose-50 border-rose-200 p-3 text-center">
          <p className="text-xl font-bold text-rose-700">{madrichim.length}</p>
          <p className="text-xs text-rose-600">מדריכים</p>
        </div>
        <div className="rounded-xl border bg-purple-50 border-purple-200 p-3 text-center">
          <p className="text-xl font-bold text-purple-700">{paelim.length}</p>
          <p className="text-xs text-purple-600">פעילים</p>
        </div>
        <div className="rounded-xl border bg-sky-50 border-sky-200 p-3 text-center">
          <p className="text-xl font-bold text-sky-700">{archivedScouts.length}</p>
          <p className="text-xs text-sky-600">חניכים</p>
        </div>
      </div>

      {battalionGroups.size > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-2.5 bg-rose-50/60 border-b text-sm font-bold text-rose-800 flex items-center gap-2">
            <Flag className="w-4 h-4" />
            הדרכה לפי גדוד
          </div>
          <div className="divide-y">
            {[...battalionGroups.entries()].sort().map(([bn, members]) => {
              const rg = roshgadim.filter((r: any) => r.battalion === bn);
              const scoutCount = scoutsByBattalion.get(bn) || 0;
              return (
                <div key={bn} className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-semibold text-sm">{bn}</span>
                    {rg.length > 0 && (
                      <span className="text-xs text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">
                        ראשגד: {rg.map((r: any) => r.name).join(", ")}
                      </span>
                    )}
                    {scoutCount > 0 && (
                      <span className="text-xs text-muted-foreground">{scoutCount} חניכים</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {members.map((m: any, i: number) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-800">
                        {m.name}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {archive.notes && (
        <div className="rounded-xl border bg-amber-50/40 border-amber-200 p-4">
          <p className="text-xs font-semibold text-amber-700 mb-1">הערות</p>
          <p className="text-sm whitespace-pre-wrap">{archive.notes}</p>
        </div>
      )}
    </div>
  );
}

function NextYearView({ scouts }: { scouts: Scout[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { role } = useAuth();
  const isAdmin = role === "marcaz_boger";

  const [yearLabel, setYearLabel] = useState("שנה הבאה");
  const [showActivate, setShowActivate] = useState(false);
  const [selectedArchiveId, setSelectedArchiveId] = useState<number | null>(null);
  const [releaseDate, setReleaseDate] = useState("");

  const candidateMadrichim = scouts.filter(s => s.grade && CANDIDATE_MADRICH_GRADES.has(s.grade));
  const candidatePaelim = scouts.filter(s => s.grade && CANDIDATE_PAEL_GRADES.has(s.grade));

  const { data: assignments = [], isLoading } = useQuery<NextYearAssignment[]>({
    queryKey: ["next-year-assignments", yearLabel],
    queryFn: () => fetch(`${API_BASE}/api/next-year-assignments?year=${encodeURIComponent(yearLabel)}`).then(r => r.json()),
    enabled: yearLabel.trim().length > 0,
  });

  const { data: archives = [] } = useQuery<YearArchive[]>({
    queryKey: ["year-archives"],
    queryFn: () => fetch(`${API_BASE}/api/years`).then(r => r.json()),
  });

  const { data: selectedArchive } = useQuery<YearArchive>({
    queryKey: ["year-archive", selectedArchiveId],
    queryFn: () => fetch(`${API_BASE}/api/years/${selectedArchiveId}`).then(r => r.json()),
    enabled: selectedArchiveId !== null,
  });

  const saveAssignment = useMutation({
    mutationFn: async (data: { scoutId: number; proposedRole: string; proposedBattalion?: string; notes?: string; yearLabel: string }) => {
      const r = await fetch(`${API_BASE}/api/next-year-assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-role": role || "" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error((await r.json())?.error || "שגיאה בשמירת שיבוץ");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["next-year-assignments", yearLabel] });
      toast({ title: "שיבוץ נשמר" });
    },
    onError: (e: Error) => toast({ title: e.message || "שגיאה בשמירת שיבוץ", variant: "destructive" }),
  });

  const isLocked = assignments.length > 0 && assignments[0]?.locked;
  const isReleased = assignments.length > 0 && assignments[0]?.released;
  const approvedByName = assignments.length > 0 ? assignments[0]?.approvedBy : null;

  const lockMutation = useMutation({
    mutationFn: async (locked: boolean) => {
      const r = await fetch(`${API_BASE}/api/next-year-assignments/lock`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-user-role": role || "" },
        body: JSON.stringify({ yearLabel, locked }),
      });
      if (!r.ok) throw new Error((await r.json())?.error || "שגיאה");
      return r.json();
    },
    onSuccess: (_, locked) => {
      qc.invalidateQueries({ queryKey: ["next-year-assignments", yearLabel] });
      toast({ title: locked ? "תכנון ננעל" : "תכנון נפתח לעריכה" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API_BASE}/api/next-year-assignments/approve`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-user-role": role || "" },
        body: JSON.stringify({ yearLabel, approvedBy: "מרכז בוגר", releaseDate: releaseDate || null }),
      });
      if (!r.ok) throw new Error((await r.json())?.error || "שגיאה");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["next-year-assignments", yearLabel] });
      toast({ title: "תכנון אושר" + (releaseDate ? ` · שחרור ב-${new Date(releaseDate).toLocaleDateString("he-IL")}` : "") });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const releaseMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API_BASE}/api/next-year-assignments/release`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-user-role": role || "" },
        body: JSON.stringify({ yearLabel }),
      });
      if (!r.ok) throw new Error((await r.json())?.error || "שגיאה");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["next-year-assignments", yearLabel] });
      toast({ title: "שיבוץ שוחרר — גלוי לכולם" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const activateMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API_BASE}/api/next-year-assignments/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-role": role || "" },
        body: JSON.stringify({ yearLabel }),
      });
      if (!r.ok) throw new Error((await r.json())?.error || "שגיאה בהפעלת שיבוץ");
      return r.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["scouts-raw"] });
      setShowActivate(false);
      toast({ title: `שיבוץ הופעל! ${data.madrichim} מדריכים, ${data.paelim} פעילים עודכנו` });
    },
    onError: (e: Error) => toast({ title: e.message || "שגיאה בהפעלת שיבוץ", variant: "destructive" }),
  });

  const assignmentByScout = new Map(assignments.map(a => [a.scoutId, a]));

  const madrichAssignedCount = assignments.filter(a => a.proposedRole === "madrich").length;
  const paelAssignedCount = assignments.filter(a => a.proposedRole === "pael").length;
  const unassignedCount = [...candidateMadrichim, ...candidatePaelim].filter(s => {
    const a = assignmentByScout.get(s.id);
    return !a || a.proposedRole === "lo_meshubach";
  }).length;

  const battalions = [...new Set(candidateMadrichim.map(s => s.battalion).filter((b): b is string => Boolean(b)))];

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">טוען שיבוצים...</div>;
  }

  if (!isAdmin && !isReleased) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <Lock className="w-12 h-12 text-amber-400 opacity-60" />
        <h3 className="text-lg font-bold text-slate-600">תכנון שנתי פרטי</h3>
        <p className="text-sm text-muted-foreground max-w-sm">התכנון השנתי עדיין לא פורסם. פנה למרכז בוגר לפרטים.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Year label + controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-muted-foreground shrink-0">שנת שיבוץ:</label>
          <Input
            value={yearLabel}
            onChange={e => setYearLabel(e.target.value)}
            className="w-40 h-9 text-sm font-medium"
            placeholder='לדוגמה: תשפ"ז'
            disabled={isLocked}
          />
        </div>
        {isAdmin && (
          <div className="flex gap-2 flex-wrap">
            {!isLocked && (
              <Button variant="outline" className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => lockMutation.mutate(true)} disabled={assignments.length === 0}>
                <Lock className="w-4 h-4" /> נעל תכנון
              </Button>
            )}
            {isLocked && !approvedByName && (
              <>
                <Button variant="outline" className="gap-2" onClick={() => lockMutation.mutate(false)}>
                  <Lock className="w-4 h-4" /> בטל נעילה
                </Button>
                <div className="flex items-center gap-2">
                  <Input type="date" value={releaseDate} onChange={e => setReleaseDate(e.target.value)} className="w-40 h-9 text-sm" placeholder="תאריך שחרור" />
                  <Button className="bg-green-700 hover:bg-green-800 gap-2" onClick={() => approveMutation.mutate()}>
                    <Check className="w-4 h-4" /> אשר תכנון
                  </Button>
                </div>
              </>
            )}
            {approvedByName && !isReleased && (
              <Button className="bg-purple-700 hover:bg-purple-800 gap-2" onClick={() => releaseMutation.mutate()}>
                <Zap className="w-4 h-4" /> שחרר לצפייה
              </Button>
            )}
            {isReleased && (
              <Button
                className="bg-blue-700 hover:bg-blue-800 gap-2"
                onClick={() => setShowActivate(true)}
                disabled={(madrichAssignedCount + paelAssignedCount) === 0}>
                <Zap className="w-4 h-4" /> הפעל שיבוץ
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Status banner */}
      {isLocked && (
        <div className={`rounded-xl p-3 text-sm flex items-center gap-2 ${isReleased ? "bg-green-50 border border-green-200 text-green-700" : approvedByName ? "bg-purple-50 border border-purple-200 text-purple-700" : "bg-amber-50 border border-amber-200 text-amber-700"}`}>
          <Lock className="w-4 h-4 shrink-0" />
          {isReleased ? "שיבוץ פורסם — גלוי לכל המשתמשים" : approvedByName ? `תכנון אושר ע״י ${approvedByName}${assignments[0]?.releaseDate ? ` · שחרור ב-${new Date(assignments[0].releaseDate).toLocaleDateString("he-IL")}` : ""}` : "תכנון נעול — רק מרכז בוגר יכול לערוך"}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center">
          <p className="text-2xl font-bold text-rose-700">{madrichAssignedCount}</p>
          <p className="text-xs text-rose-600 mt-1">מועמדים למדריכים</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-center">
          <p className="text-2xl font-bold text-sky-700">{paelAssignedCount}</p>
          <p className="text-xs text-sky-600 mt-1">מועמדים לפעילים</p>
        </div>
        <div className="rounded-xl border bg-muted/30 p-4 text-center">
          <p className="text-2xl font-bold text-muted-foreground">{unassignedCount}</p>
          <p className="text-xs text-muted-foreground mt-1">לא משובצים</p>
        </div>
      </div>

      {/* Candidates for Madrichim — grade ט */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b bg-rose-50/60 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-rose-600" />
          </div>
          <div>
            <p className="font-bold text-sm text-rose-800">מועמדים למדריכים</p>
            <p className="text-xs text-rose-600">חניכי כיתה ט · {candidateMadrichim.length} מועמדים</p>
          </div>
        </div>
        <div className="p-4">
          {candidateMadrichim.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">אין חניכים בכיתה ט במאגר</p>
            </div>
          ) : battalions.length > 0 ? (
            <div className="space-y-5">
              {battalions.map(bn => {
                const bnScouts = candidateMadrichim.filter(s => s.battalion === bn);
                if (bnScouts.length === 0) return null;
                return (
                  <div key={bn}>
                    <div className="flex items-center gap-2 mb-2">
                      <Flag className="w-3.5 h-3.5 text-rose-400" />
                      <span className="text-sm font-semibold">גדוד {bn}</span>
                      <span className="text-xs text-muted-foreground">({bnScouts.length})</span>
                    </div>
                    <div className="space-y-2 mr-5">
                      {bnScouts.map(s => (
                        <ScoutAssignmentCard
                          key={s.id}
                          scout={s}
                          assignment={assignmentByScout.get(s.id)}
                          yearLabel={yearLabel}
                          candidateType="madrich"
                          onSave={data => saveAssignment.mutate(data)}
                          isPending={saveAssignment.isPending}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
              {/* Scouts without battalion */}
              {candidateMadrichim.filter(s => !s.battalion).length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm font-semibold text-muted-foreground">ללא גדוד</span>
                  </div>
                  <div className="space-y-2 mr-5">
                    {candidateMadrichim.filter(s => !s.battalion).map(s => (
                      <ScoutAssignmentCard
                        key={s.id}
                        scout={s}
                        assignment={assignmentByScout.get(s.id)}
                        yearLabel={yearLabel}
                        candidateType="madrich"
                        onSave={data => saveAssignment.mutate(data)}
                        isPending={saveAssignment.isPending}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {candidateMadrichim.map(s => (
                <ScoutAssignmentCard
                  key={s.id}
                  scout={s}
                  assignment={assignmentByScout.get(s.id)}
                  yearLabel={yearLabel}
                  candidateType="madrich"
                  onSave={data => saveAssignment.mutate(data)}
                  isPending={saveAssignment.isPending}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Candidates for Paelim — grades י, יא */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b bg-sky-50/60 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-sky-600" />
          </div>
          <div>
            <p className="font-bold text-sm text-sky-800">מועמדים לפעילים</p>
            <p className="text-xs text-sky-600">חניכי כיתות י–יא · {candidatePaelim.length} מועמדים</p>
          </div>
        </div>
        <div className="p-4">
          {candidatePaelim.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">אין חניכים בכיתות י–יא במאגר</p>
            </div>
          ) : (
            <div className="space-y-5">
              {["י", "יא"].map(grade => {
                const gradeScouts = candidatePaelim.filter(s => s.grade === grade);
                if (gradeScouts.length === 0) return null;
                return (
                  <div key={grade}>
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-3.5 h-3.5 text-sky-400" />
                      <span className="text-sm font-semibold">כיתה {grade}</span>
                      <span className="text-xs text-muted-foreground">({gradeScouts.length})</span>
                    </div>
                    <div className="space-y-2 mr-5">
                      {gradeScouts.map(s => (
                        <ScoutAssignmentCard
                          key={s.id}
                          scout={s}
                          assignment={assignmentByScout.get(s.id)}
                          yearLabel={yearLabel}
                          candidateType="pael"
                          onSave={data => saveAssignment.mutate(data)}
                          isPending={saveAssignment.isPending}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {archives.length > 0 && (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b bg-amber-50/60 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm text-amber-800">ארכיון שנים קודמות</p>
              <p className="text-xs text-amber-600">צפה בנתוני הדרכה ושיבוצים משנים קודמות</p>
            </div>
            <Select
              value={selectedArchiveId?.toString() || ""}
              onValueChange={v => setSelectedArchiveId(v ? parseInt(v) : null)}
            >
              <SelectTrigger className="w-44 h-9 text-sm">
                <SelectValue placeholder="בחר שנה..." />
              </SelectTrigger>
              <SelectContent>
                {archives.map(a => (
                  <SelectItem key={a.id} value={a.id.toString()}>
                    {a.yearLabel} ({new Date(a.closedAt).getFullYear()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedArchive && (
            <div className="p-5">
              <ArchiveViewer archive={selectedArchive} />
            </div>
          )}
        </div>
      )}

      {showActivate && (
        <ActivateConfirmDialog
          yearLabel={yearLabel}
          madrichCount={madrichAssignedCount}
          paelCount={paelAssignedCount}
          unassignedCount={unassignedCount}
          onConfirm={() => activateMutation.mutate()}
          onCancel={() => setShowActivate(false)}
          isPending={activateMutation.isPending}
        />
      )}
    </div>
  );
}

const CHANICHIM_GRADE_ORDER = ["ד", "ה", "ו", "ז", "ח"];
const PAELIM_GRADE_ORDER = ["י", "יא", "יב"];

function madrichMatchesGrade(madrichGrade: string | null | undefined, scoutGrade: string): boolean {
  if (!madrichGrade) return false;
  const mg = madrichGrade.replace(/['"׳]/g, "").trim();
  if (mg === scoutGrade) return true;
  if (mg.includes("-")) {
    const gradeOrder = ["ד", "ה", "ו", "ז", "ח", "ט", "י", "יא", "יב"];
    const parts = mg.split("-").map(p => p.trim());
    const startIdx = gradeOrder.indexOf(parts[0]);
    const endIdx = gradeOrder.indexOf(parts[1]);
    const targetIdx = gradeOrder.indexOf(scoutGrade);
    if (startIdx >= 0 && endIdx >= 0 && targetIdx >= 0) {
      return targetIdx >= startIdx && targetIdx <= endIdx;
    }
  }
  return false;
}

function ChanichimGridView({ scouts, users, onUserDrop, onScoutDrop }: {
  scouts: Scout[]; users: TribeUser[];
  onUserDrop: (userId: number, target: DropTarget) => void;
  onScoutDrop: (scoutId: number, target: ScoutDropTarget) => void;
}) {
  const chanichim = scouts.filter(s => s.grade && CHANICHIM_GRADES.has(s.grade));
  const madrichim = users.filter(u => u.role === "madrich" && u.battalion);
  const allBattalions = new Set<string>();
  chanichim.forEach(s => { if (s.battalion) allBattalions.add(s.battalion); });
  madrichim.forEach(u => { if (u.battalion) allBattalions.add(u.battalion); });
  const battalions = [...allBattalions].sort();
  const unassigned = chanichim.filter(s => !s.battalion);

  if (chanichim.length === 0 && madrichim.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground border rounded-2xl border-dashed">
        <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p className="font-medium">אין חניכים (ד-ח) ומדריכים בבסיס הנתונים</p>
        <p className="text-xs mt-1">ייבא שיבוצים או הוסף חניכים דרך מאגר חניכים</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
        <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
        <span>גרור מדריכים וחניכים בין גדודים</span>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {battalions.map(bn => {
          const bnScouts = chanichim.filter(s => s.battalion === bn);
          const bnMadrichim = madrichim.filter(u => u.battalion === bn);
          const schools = [...new Set(bnScouts.map(s => s.school).filter(Boolean))];
          const roshgadUser = users.find(u => u.role === "roshgad" && u.battalion === bn);
          return (
            <DropZone key={bn} target={{ role: "madrich", battalion: bn }} onDrop={onUserDrop} onScoutDrop={onScoutDrop}>
              <div className="rounded-xl border overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-yellow-300/70 flex items-center gap-2 flex-wrap">
                  <Flag className="w-4 h-4 text-yellow-900 shrink-0" />
                  <span className="font-bold text-yellow-900">{bn}</span>
                  {schools.length > 0 && (
                    <span className="text-yellow-800 text-sm">— {schools.join(" + ")}</span>
                  )}
                  {roshgadUser && (
                    <DraggableChip user={roshgadUser}>
                      <span className="mr-auto text-xs font-semibold bg-yellow-100/80 text-yellow-900 px-2 py-0.5 rounded-full border border-yellow-400/50 inline-flex items-center gap-1 hover:bg-yellow-200/80 transition-colors">
                        <GripVertical className="w-3 h-3 text-yellow-600" />
                        ראשגד: {roshgadUser.name}
                      </span>
                    </DraggableChip>
                  )}
                </div>
                <div className="px-3 py-2 bg-white border-b space-y-1">
                  <div className="text-[11px] font-bold text-muted-foreground">מדריכים:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {bnMadrichim.map(u => (
                      <DraggableChip key={u.id} user={u}>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-800 font-medium inline-flex items-center gap-1 hover:bg-rose-100 transition-colors">
                          <GripVertical className="w-3 h-3 text-rose-300" />
                          {u.name}
                          {u.grade && <span className="text-rose-400">({u.grade}׳)</span>}
                        </span>
                      </DraggableChip>
                    ))}
                    {bnMadrichim.length === 0 && <span className="text-xs text-muted-foreground/50 italic">גרור מדריכים לכאן</span>}
                  </div>
                </div>
                <table className="w-full text-sm bg-white">
                  <thead>
                    <tr className="bg-muted/40 border-b">
                      <th className="text-right px-3 py-1.5 font-semibold w-14 text-xs text-muted-foreground">כיתה</th>
                      <th className="text-right px-3 py-1.5 font-semibold text-xs text-muted-foreground">חניכים</th>
                      <th className="text-right px-3 py-1.5 font-semibold w-10 text-xs text-muted-foreground">מ׳</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CHANICHIM_GRADE_ORDER.map(grade => {
                      const gradeScouts = bnScouts.filter(s => s.grade === grade);
                      if (gradeScouts.length === 0) return null;
                      return (
                        <tr key={grade} className="border-t hover:bg-yellow-50/30 transition-colors">
                          <td className="px-3 py-2 font-bold text-yellow-800">{grade}׳</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {gradeScouts.map(s => (
                                <DraggableScoutChip key={s.id} scout={s}>
                                  <span className="text-xs text-gray-700 hover:text-blue-600 transition-colors cursor-grab">
                                    {s.name}{s.lastName ? ` ${s.lastName}` : ""}
                                  </span>
                                </DraggableScoutChip>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground text-xs text-center">{gradeScouts.length}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="px-3 py-1.5 bg-muted/20 border-t text-xs text-muted-foreground flex items-center justify-between">
                  <span>סה״כ: {bnScouts.length} חניכים · {bnMadrichim.length} מדריכים</span>
                  {schools.length > 0 && <span className="text-rose-500">{schools.join(", ")}</span>}
                </div>
              </div>
            </DropZone>
          );
        })}
      </div>

      {unassigned.length > 0 && (
        <ScoutDropZone target={{ battalion: "" }} onDrop={onScoutDrop}>
          <div className="rounded-xl border border-dashed border-muted-foreground/30 overflow-hidden">
            <div className="px-4 py-2 bg-muted/20 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-muted-foreground">ללא גדוד ({unassigned.length})</span>
            </div>
            <div className="p-3 flex flex-wrap gap-1.5">
              {unassigned.map(s => (
                <DraggableScoutChip key={s.id} scout={s}>
                  <span className="text-xs px-2 py-0.5 rounded bg-muted border text-muted-foreground hover:text-blue-600 transition-colors cursor-grab">
                    {s.name}{s.grade ? ` (${s.grade}׳)` : ""}
                  </span>
                </DraggableScoutChip>
              ))}
            </div>
          </div>
        </ScoutDropZone>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {battalions.map(bn => {
          const scoutCount = chanichim.filter(s => s.battalion === bn).length;
          const madrichCount = madrichim.filter(u => u.battalion === bn).length;
          return (
            <div key={bn} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-yellow-200 bg-yellow-50">
              <Flag className="w-3 h-3 text-yellow-600" />
              <span className="text-yellow-800 font-medium">{bn}</span>
              <span className="text-yellow-600">{scoutCount} ח׳ · {madrichCount} מד׳</span>
            </div>
          );
        })}
        <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50">
          <Users className="w-3 h-3 text-rose-600" />
          <span className="text-rose-800 font-medium">סה״כ</span>
          <span className="text-rose-600">{chanichim.length} חניכים · {madrichim.length} מדריכים</span>
        </div>
      </div>
    </div>
  );
}

function PaelimGridView({ scouts, users, onUserDrop, onTeamUpdate, onTeamRename, onTeamDelete, onSync, syncing }: {
  scouts: Scout[]; users: TribeUser[];
  onUserDrop: (userId: number, target: DropTarget) => void;
  onTeamUpdate: (userId: number, team: string | null) => void;
  onTeamRename: (oldName: string, newName: string) => Promise<void>;
  onTeamDelete: (teamName: string) => Promise<void>;
  onSync: () => void;
  syncing: boolean;
}) {
  const paelim = scouts.filter(s => s.grade && PAELIM_GRADES.has(s.grade));
  const roshatzUsers = users.filter(u => u.role === "roshatz");
  const paelUsers = users.filter(u => u.role === "pael");
  const allTeamNames = new Set<string>();
  paelUsers.forEach(u => { if (u.team) allTeamNames.add(u.team); });
  roshatzUsers.forEach(u => { if (u.team) allTeamNames.add(u.team); });
  const teams = [...allTeamNames].sort();
  const [viewMode, setViewMode] = useState<"teams" | "gizra">(teams.length > 0 ? "teams" : "gizra");
  const [addingTeam, setAddingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editTeamName, setEditTeamName] = useState("");
  const [pendingTeams, setPendingTeams] = useState<string[]>([]);

  const allTeams = [...new Set([...teams, ...pendingTeams])].sort();

  const gizrot = [...new Set(paelim.map(s => s.gizra || s.battalion).filter((g): g is string => Boolean(g)))].sort();
  const unassigned = paelim.filter(s => !s.gizra && !s.battalion);

  const handleAddTeam = () => {
    const name = newTeamName.trim();
    if (!name || allTeams.includes(name)) return;
    setPendingTeams(prev => [...prev, name]);
    setNewTeamName("");
    setAddingTeam(false);
  };

  const handleRenameTeam = async (oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) { setEditingTeam(null); return; }
    const isPending = pendingTeams.includes(oldName);
    if (isPending) {
      setPendingTeams(prev => prev.map(t => t === oldName ? newName.trim() : t));
    } else {
      await onTeamRename(oldName, newName.trim());
    }
    setEditingTeam(null);
  };

  const handleDeleteTeam = async (teamName: string) => {
    const isPending = pendingTeams.includes(teamName) && paelUsers.filter(u => u.team === teamName).length === 0 && roshatzUsers.filter(u => u.team === teamName).length === 0;
    if (isPending) {
      setPendingTeams(prev => prev.filter(t => t !== teamName));
    } else {
      await onTeamDelete(teamName);
      setPendingTeams(prev => prev.filter(t => t !== teamName));
    }
  };

  if (paelim.length === 0 && paelUsers.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground border rounded-2xl border-dashed">
        <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p className="font-medium">אין פעילים (י-יב) בבסיס הנתונים</p>
        <p className="text-xs mt-1">הוסף חניכים עם שכבה י-יב וקבוצה דרך מאגר חניכים</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 flex-wrap">
        <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
        <span>גרור פעילים וראשצ בין צוותים</span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs mr-auto gap-1.5"
          disabled={syncing}
          onClick={onSync}
        >
          {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          סנכרן עץ שיבוצים עם מאגר חניכים
        </Button>
      </div>

      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          onClick={() => setViewMode("teams")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === "teams" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          צוותים
        </button>
        <button
          onClick={() => setViewMode("gizra")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === "gizra" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          קבוצות
        </button>
      </div>

      {viewMode === "teams" ? (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allTeams.map(team => {
              const teamPaelim = paelUsers.filter(u => u.team === team);
              const teamRoshatz = roshatzUsers.filter(u => u.team === team);
              return (
                <DropZone key={team} target={{ role: "pael", battalion: "", team }} onDrop={(userId, t) => onTeamUpdate(userId, t.team || null)}>
                  <div className="rounded-xl border overflow-hidden shadow-sm">
                    <div className="px-4 py-3 bg-purple-200/60 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-purple-900 shrink-0" />
                      {editingTeam === team ? (
                        <div className="flex items-center gap-1 flex-1">
                          <Input
                            value={editTeamName}
                            onChange={e => setEditTeamName(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") handleRenameTeam(team, editTeamName); if (e.key === "Escape") setEditingTeam(null); }}
                            className="h-6 text-sm flex-1 min-w-20"
                            autoFocus
                          />
                          <button onClick={() => handleRenameTeam(team, editTeamName)} className="text-green-600 hover:bg-green-50 p-0.5 rounded"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditingTeam(null)} className="text-muted-foreground p-0.5 rounded"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <>
                          <span className="font-bold text-purple-900">{team}</span>
                          <span className="text-xs font-medium bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full border border-purple-300/50">
                            {teamPaelim.length}
                          </span>
                          <div className="mr-auto flex gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100">
                            <button onClick={() => { setEditingTeam(team); setEditTeamName(team); }} className="text-purple-600 hover:bg-purple-100 p-0.5 rounded"><Pencil className="w-3 h-3" /></button>
                            <button onClick={() => handleDeleteTeam(team)} className="text-red-400 hover:bg-red-50 p-0.5 rounded"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="p-3 space-y-1.5 bg-white">
                      {teamRoshatz.map(u => (
                        <DraggableChip key={u.id} user={u}>
                          <div className="flex items-center gap-2 text-sm px-2 py-1 rounded-lg bg-sky-50 border border-sky-200 hover:bg-sky-100 transition-colors">
                            <GripVertical className="w-3 h-3 text-sky-400 shrink-0" />
                            <Shield className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                            <span className="font-semibold text-sky-900">{u.name}</span>
                            <span className="text-[10px] text-sky-600 mr-auto">ראשצ</span>
                          </div>
                        </DraggableChip>
                      ))}
                      {teamPaelim.map(u => (
                        <DraggableChip key={u.id} user={u}>
                          <div className="flex items-center gap-2 text-sm px-2 py-1 rounded-lg hover:bg-purple-50/40 transition-colors group/chip">
                            <GripVertical className="w-3 h-3 text-muted-foreground/30 group-hover/chip:text-muted-foreground/60 shrink-0" />
                            <div className="w-6 h-6 rounded-full bg-purple-100 border border-purple-200 flex items-center justify-center text-[10px] font-bold text-purple-700 shrink-0">
                              {u.name.charAt(0)}
                            </div>
                            <span className="font-medium">{u.name}</span>
                            {u.grade && <span className="text-xs text-muted-foreground">({u.grade}׳)</span>}
                          </div>
                        </DraggableChip>
                      ))}
                      {teamPaelim.length === 0 && teamRoshatz.length === 0 && (
                        <p className="text-xs text-muted-foreground/50 italic text-center py-2">גרור פעילים לכאן</p>
                      )}
                    </div>
                  </div>
                </DropZone>
              );
            })}

            {(() => {
              const noTeam = paelUsers.filter(u => !u.team);
              const noTeamRoshatz = roshatzUsers.filter(u => !u.team);
              if (noTeam.length === 0 && noTeamRoshatz.length === 0 && !addingTeam) return null;
              return (
                <DropZone target={{ role: "pael", battalion: "", team: "" }} onDrop={(userId) => onTeamUpdate(userId, null)}>
                  <div className="rounded-xl border border-dashed border-muted-foreground/30 overflow-hidden">
                    <div className="px-4 py-3 bg-muted/30 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span className="font-medium text-muted-foreground text-sm">ללא צוות</span>
                      <span className="mr-auto text-xs text-muted-foreground">{noTeam.length + noTeamRoshatz.length}</span>
                    </div>
                    <div className="p-3 space-y-1 bg-white">
                      {noTeamRoshatz.map(u => (
                        <DraggableChip key={u.id} user={u}>
                          <div className="flex items-center gap-2 text-sm px-2 py-1 rounded-lg bg-sky-50/50 hover:bg-sky-50 transition-colors">
                            <GripVertical className="w-3 h-3 text-sky-400 shrink-0" />
                            <Shield className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                            <span className="font-medium text-sky-800">{u.name}</span>
                            <span className="text-[10px] text-sky-500">ראשצ</span>
                          </div>
                        </DraggableChip>
                      ))}
                      {noTeam.map(u => (
                        <DraggableChip key={u.id} user={u}>
                          <div className="flex items-center gap-2 text-sm px-2 py-0.5 text-muted-foreground hover:text-foreground transition-colors">
                            <GripVertical className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                            {u.name}
                          </div>
                        </DraggableChip>
                      ))}
                    </div>
                  </div>
                </DropZone>
              );
            })()}
          </div>

          {addingTeam ? (
            <div className="flex items-center gap-2">
              <Input
                placeholder="שם הצוות החדש..."
                value={newTeamName}
                onChange={e => setNewTeamName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleAddTeam(); if (e.key === "Escape") { setAddingTeam(false); setNewTeamName(""); } }}
                className="h-8 text-sm max-w-48"
                autoFocus
              />
              <Button size="sm" className="h-8 text-xs" disabled={!newTeamName.trim()} onClick={handleAddTeam}>
                <Check className="w-3 h-3 ml-1" /> צור
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setAddingTeam(false); setNewTeamName(""); }}>
                ביטול
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setAddingTeam(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-muted-foreground/30 text-muted-foreground text-sm hover:bg-muted/30 hover:border-muted-foreground/50 transition-all">
              <Plus className="w-4 h-4" /> הוסף צוות חדש
            </button>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {gizrot.map(gizra => {
            const gizraScouts = paelim.filter(s => (s.gizra || s.battalion) === gizra);
            return (
              <div key={gizra} className="rounded-xl border overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-sky-200/60 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-sky-900 shrink-0" />
                  <span className="font-bold text-sky-900">{gizra}</span>
                  <span className="mr-auto text-xs font-medium bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full border border-sky-300/50">
                    {gizraScouts.length} פעילים
                  </span>
                </div>
                <table className="w-full text-sm bg-white">
                  <thead>
                    <tr className="bg-muted/40 border-b">
                      <th className="text-right px-3 py-1.5 font-semibold w-14 text-xs text-muted-foreground">כיתה</th>
                      <th className="text-right px-3 py-1.5 font-semibold text-xs text-muted-foreground">שמות פעילים</th>
                      <th className="text-right px-3 py-1.5 font-semibold w-10 text-xs text-muted-foreground">מ׳</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PAELIM_GRADE_ORDER.map(grade => {
                      const gradeScouts = gizraScouts.filter(s => s.grade === grade);
                      if (gradeScouts.length === 0) return null;
                      return (
                        <tr key={grade} className="border-t hover:bg-sky-50/30 transition-colors">
                          <td className="px-3 py-2 font-bold text-sky-800">{grade}׳</td>
                          <td className="px-3 py-2 text-xs text-gray-700 leading-relaxed">
                            {gradeScouts.map(s => `${s.name}${s.lastName ? ` ${s.lastName}` : ""}`).join(", ")}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground text-xs text-center">{gradeScouts.length}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="px-3 py-1.5 bg-muted/20 border-t text-xs text-muted-foreground">
                  {PAELIM_GRADE_ORDER.filter(g => gizraScouts.some(s => s.grade === g)).map(g => {
                    const cnt = gizraScouts.filter(s => s.grade === g).length;
                    return <span key={g} className="ml-2">{g}׳: {cnt}</span>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === "gizra" && unassigned.length > 0 && (
        <div className="rounded-xl border border-dashed border-muted-foreground/30 overflow-hidden">
          <div className="px-4 py-2 bg-muted/20 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium text-muted-foreground">ללא קבוצה ({unassigned.length})</span>
          </div>
          <div className="p-3 flex flex-wrap gap-1.5">
            {unassigned.map(s => (
              <span key={s.id} className="text-xs px-2 py-0.5 rounded bg-muted border text-muted-foreground">
                {s.name}{s.grade ? ` (${s.grade}׳)` : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {["י", "יא", "יב"].map(g => {
          const cnt = paelim.filter(s => s.grade === g).length;
          if (cnt === 0) return null;
          return (
            <div key={g} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-sky-200 bg-sky-50">
              <span className="text-sky-800 font-medium">כיתה {g}׳</span>
              <span className="text-sky-600">{cnt}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-sky-300 bg-sky-100">
          <Users className="w-3 h-3 text-sky-700" />
          <span className="text-sky-900 font-medium">סה״כ פעילים</span>
          <span className="text-sky-700">{paelim.length}</span>
        </div>
        {allTeams.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-purple-300 bg-purple-100">
            <Zap className="w-3 h-3 text-purple-700" />
            <span className="text-purple-900 font-medium">צוותים</span>
            <span className="text-purple-700">{allTeams.length}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Moadal Grid View ────────────────────────────────────────────────────────

function SectionBlock({
  title, headerClass, children,
}: {
  title: string; headerClass: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border overflow-hidden shadow-sm">
      <div className={`px-4 py-2 border-b text-sm font-bold ${headerClass}`}>{title}</div>
      <div className="p-4 bg-white">{children}</div>
    </div>
  );
}

type DropTarget = { role: string; battalion: string; team?: string };
type ScoutDropTarget = { battalion: string };

function DraggableChip({ user, children, className }: { user: TribeUser; children: React.ReactNode; className?: string }) {
  return (
    <span
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/user-id", String(user.id));
        e.dataTransfer.setData("text/plain", user.name);
        e.dataTransfer.effectAllowed = "move";
        (e.currentTarget as HTMLElement).style.opacity = "0.4";
      }}
      onDragEnd={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
      className={`cursor-grab active:cursor-grabbing select-none ${className || ""}`}
    >
      {children}
    </span>
  );
}

function DraggableScoutChip({ scout, children, className }: { scout: Scout; children: React.ReactNode; className?: string }) {
  return (
    <span
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/scout-id", String(scout.id));
        e.dataTransfer.setData("text/plain", scout.name);
        e.dataTransfer.effectAllowed = "move";
        (e.currentTarget as HTMLElement).style.opacity = "0.4";
      }}
      onDragEnd={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
      className={`cursor-grab active:cursor-grabbing select-none ${className || ""}`}
    >
      {children}
    </span>
  );
}

function DropZone({ target, onDrop, children, className, onScoutDrop }: {
  target: DropTarget;
  onDrop: (userId: number, target: DropTarget) => void;
  onScoutDrop?: (scoutId: number, target: ScoutDropTarget) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const userId = parseInt(e.dataTransfer.getData("application/user-id"));
        if (userId) { onDrop(userId, target); return; }
        const scoutId = parseInt(e.dataTransfer.getData("application/scout-id"));
        if (scoutId && onScoutDrop) { onScoutDrop(scoutId, { battalion: target.battalion }); }
      }}
      className={`transition-all duration-150 rounded-lg ${over ? "ring-2 ring-blue-400 bg-blue-50/60 scale-[1.01]" : ""} ${className || ""}`}
    >
      {children}
    </div>
  );
}

function ScoutDropZone({ target, onDrop, children, className }: {
  target: ScoutDropTarget;
  onDrop: (scoutId: number, target: ScoutDropTarget) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const scoutId = parseInt(e.dataTransfer.getData("application/scout-id"));
        if (scoutId) onDrop(scoutId, target);
      }}
      className={`transition-all duration-150 rounded-lg ${over ? "ring-2 ring-blue-400 bg-blue-50/60 scale-[1.01]" : ""} ${className || ""}`}
    >
      {children}
    </div>
  );
}

function DroppableColCell({ label, users, target, onDrop }: {
  label: string; users: TribeUser[]; target: DropTarget; onDrop: (userId: number, target: DropTarget) => void;
}) {
  return (
    <DropZone target={target} onDrop={onDrop} className="p-1.5 -m-1.5">
      <div className="space-y-1 min-w-0">
        <div className="text-[11px] font-bold text-muted-foreground border-b pb-1 truncate">{label}</div>
        {users.length === 0
          ? <span className="text-xs text-muted-foreground/40 italic">גרור לכאן</span>
          : users.map((u) => (
            <DraggableChip key={u.id} user={u}>
              <div className="text-sm font-medium leading-tight truncate hover:text-blue-600 transition-colors flex items-center gap-1 group/chip">
                <GripVertical className="w-3 h-3 text-muted-foreground/30 group-hover/chip:text-muted-foreground/60 shrink-0" />
                {u.name}
              </div>
            </DraggableChip>
          ))
        }
      </div>
    </DropZone>
  );
}

function WingHeader({ wing, color, children }: { wing: string; color: "rose" | "sky"; children: React.ReactNode }) {
  const cls = color === "rose"
    ? { bg: "bg-rose-600", text: "text-white", sub: "bg-rose-50/80 border-rose-100" }
    : { bg: "bg-sky-600", text: "text-white", sub: "bg-sky-50/80 border-sky-100" };
  return (
    <div className="rounded-2xl border overflow-hidden shadow-sm">
      <div className={`px-5 py-2.5 ${cls.bg}`}>
        <span className={`font-bold text-base ${cls.text}`}>{wing}</span>
      </div>
      <div className={`p-4 ${cls.sub} space-y-3`}>{children}</div>
    </div>
  );
}

function MoadalGridView({ users, onUserDrop }: { users: TribeUser[]; onUserDrop: (userId: number, target: DropTarget) => void }) {
  const usersByRB = (role: string, battalion: string) =>
    users.filter(u => u.role === role && u.battalion === battalion);
  const byRole = (role: string) => users.filter(u => u.role === role);

  const bogerHadrachaU = byRole("marcaz_boger").filter(u => u.battalion === "הדרכה");
  const bogerPaelimU = byRole("marcaz_boger").filter(u => u.battalion === "פעילים");
  const bogerGeneralU = byRole("marcaz_boger").filter(u => !u.battalion || (u.battalion !== "הדרכה" && u.battalion !== "פעילים"));

  const tzairHadrachaU = byRole("marcaz_tzair").filter(u => u.battalion === "הדרכה");
  const tzairPaelimU = byRole("marcaz_tzair").filter(u => u.battalion === "פעילים");

  const roshgadBattalions = [...new Set(byRole("roshgad").map(u => u.battalion).filter((b): b is string => !!b && !["הדרכה","פעילים","קורס"].includes(b)))];
  const kursBattalions = [...new Set(byRole("roshgad").map(u => u.battalion).filter((b): b is string => !!b && b.startsWith("קורס")))];

  const hagbaraaUsers = users.filter(u => u.role === "roshatz" && u.battalion && HAGBARAA_COLS.some(c => u.battalion!.includes(c)));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
        <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
        <span>גרור שמות בין תפקידים כדי להזיז אנשים — השינוי יישמר אוטומטית</span>
      </div>

      <DropZone target={{ role: "marcaz_boger", battalion: "" }} onDrop={onUserDrop}>
        <div className="rounded-2xl border border-blue-200 bg-blue-50/60 px-5 py-3.5 flex items-center gap-3 flex-wrap">
          <Crown className="w-5 h-5 text-blue-600 shrink-0" />
          <span className="font-bold text-blue-900 text-sm">מרכז בוגר</span>
          {bogerGeneralU.length === 0 && bogerHadrachaU.length === 0 && bogerPaelimU.length === 0
            ? <span className="text-blue-500/60 italic text-sm">גרור לכאן</span>
            : <>
              {bogerGeneralU.map(u => (
                <DraggableChip key={u.id} user={u}>
                  <span className="px-3 py-1 rounded-full bg-blue-100 border border-blue-200 text-blue-900 text-sm font-semibold inline-flex items-center gap-1 hover:bg-blue-200/70 transition-colors">
                    <GripVertical className="w-3 h-3 text-blue-400" />
                    {u.name}
                  </span>
                </DraggableChip>
              ))}
              {bogerHadrachaU.map(u => (
                <DraggableChip key={u.id} user={u}>
                  <span className="px-3 py-1 rounded-full bg-blue-100 border border-blue-200 text-blue-900 text-sm font-semibold inline-flex items-center gap-1 hover:bg-blue-200/70 transition-colors">
                    <GripVertical className="w-3 h-3 text-blue-400" />
                    {u.name} (הדרכה)
                  </span>
                </DraggableChip>
              ))}
              {bogerPaelimU.map(u => (
                <DraggableChip key={u.id} user={u}>
                  <span className="px-3 py-1 rounded-full bg-blue-100 border border-blue-200 text-blue-900 text-sm font-semibold inline-flex items-center gap-1 hover:bg-blue-200/70 transition-colors">
                    <GripVertical className="w-3 h-3 text-blue-400" />
                    {u.name} (פעילים)
                  </span>
                </DraggableChip>
              ))}
            </>
          }
        </div>
      </DropZone>

      <div className="grid md:grid-cols-2 gap-4">
        <WingHeader wing="זרוע הדרכה" color="rose">
          <div className="flex flex-wrap gap-2 items-center min-h-[32px]">
            <DropZone target={{ role: "marcaz_boger", battalion: "הדרכה" }} onDrop={onUserDrop} className="inline-flex flex-wrap gap-1.5">
              {bogerHadrachaU.map(u => (
                <DraggableChip key={u.id} user={u}>
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 border border-blue-200 text-blue-900 text-xs font-semibold hover:bg-blue-200/70 transition-colors">
                    <GripVertical className="w-3 h-3 text-blue-400" />
                    <Crown className="w-3 h-3" /> {u.name}
                  </span>
                </DraggableChip>
              ))}
              {bogerHadrachaU.length === 0 && <span className="text-[10px] text-blue-400 italic px-1">מ.בוגר</span>}
            </DropZone>
            <DropZone target={{ role: "marcaz_tzair", battalion: "הדרכה" }} onDrop={onUserDrop} className="inline-flex flex-wrap gap-1.5">
              {tzairHadrachaU.map(u => (
                <DraggableChip key={u.id} user={u}>
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 border border-red-200 text-red-900 text-xs font-semibold hover:bg-red-200/70 transition-colors">
                    <GripVertical className="w-3 h-3 text-red-400" />
                    <Star className="w-3 h-3" /> {u.name}
                  </span>
                </DraggableChip>
              ))}
              {tzairHadrachaU.length === 0 && <span className="text-[10px] text-red-400 italic px-1">מ.צעיר</span>}
            </DropZone>
          </div>

          <div>
            <div className="text-xs font-bold text-rose-700 mb-2">ראשגדים</div>
            <div className="grid grid-cols-3 gap-x-3 gap-y-2">
              {HADRACHA_ROSHGAD_COLS.map(g => {
                const cellUsers = g === "קורס"
                  ? [...new Map([
                      ...kursBattalions.flatMap(b => usersByRB("roshgad", b)),
                      ...usersByRB("roshgad", "קורס"),
                    ].map(u => [u.id, u])).values()]
                  : usersByRB("roshgad", g);
                return <DroppableColCell key={g} label={g !== "קורס" ? `${g}׳` : "קורס"} users={cellUsers} target={{ role: "roshgad", battalion: g }} onDrop={onUserDrop} />;
              })}
              {roshgadBattalions.filter(b => !HADRACHA_ROSHGAD_COLS.includes(b)).map(b => (
                <DroppableColCell key={b} label={b} users={usersByRB("roshgad", b)} target={{ role: "roshgad", battalion: b }} onDrop={onUserDrop} />
              ))}
            </div>
          </div>
        </WingHeader>

        <WingHeader wing="זרוע פעילים" color="sky">
          <div className="flex flex-wrap gap-2 items-center min-h-[32px]">
            <DropZone target={{ role: "marcaz_boger", battalion: "פעילים" }} onDrop={onUserDrop} className="inline-flex flex-wrap gap-1.5">
              {bogerPaelimU.map(u => (
                <DraggableChip key={u.id} user={u}>
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 border border-blue-200 text-blue-900 text-xs font-semibold hover:bg-blue-200/70 transition-colors">
                    <GripVertical className="w-3 h-3 text-blue-400" />
                    <Crown className="w-3 h-3" /> {u.name}
                  </span>
                </DraggableChip>
              ))}
              {bogerPaelimU.length === 0 && <span className="text-[10px] text-blue-400 italic px-1">מ.בוגר</span>}
            </DropZone>
            <DropZone target={{ role: "marcaz_tzair", battalion: "פעילים" }} onDrop={onUserDrop} className="inline-flex flex-wrap gap-1.5">
              {tzairPaelimU.map(u => (
                <DraggableChip key={u.id} user={u}>
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 border border-red-200 text-red-900 text-xs font-semibold hover:bg-red-200/70 transition-colors">
                    <GripVertical className="w-3 h-3 text-red-400" />
                    <Star className="w-3 h-3" /> {u.name}
                  </span>
                </DraggableChip>
              ))}
              {tzairPaelimU.length === 0 && <span className="text-[10px] text-red-400 italic px-1">מ.צעיר</span>}
            </DropZone>
          </div>

          {PAELIM_ROSHATZ_GROUPS.map((grp, gi) => (
            <div key={gi}>
              <div className="text-xs font-bold text-sky-700 mb-2">{grp.label}</div>
              <div className="grid grid-cols-3 gap-x-3 gap-y-2">
                {grp.cols.map(col => (
                  <DroppableColCell key={col} label={col} users={usersByRB("roshatz", col)} target={{ role: "roshatz", battalion: col }} onDrop={onUserDrop} />
                ))}
              </div>
            </div>
          ))}

          {hagbaraaUsers.length > 0 && (
            <DropZone target={{ role: "roshatz", battalion: "הגברה וחשמל" }} onDrop={onUserDrop}>
              <div>
                <div className="text-xs font-bold text-amber-700 mb-2">הגברה וחשמל</div>
                <div className="flex flex-wrap gap-1.5">
                  {hagbaraaUsers.map(u => (
                    <DraggableChip key={u.id} user={u}>
                      <span className="px-2.5 py-1 rounded-full bg-amber-100 border border-amber-200 text-amber-900 text-xs font-medium inline-flex items-center gap-1 hover:bg-amber-200/70 transition-colors">
                        <GripVertical className="w-3 h-3 text-amber-400" />
                        {u.name}
                      </span>
                    </DraggableChip>
                  ))}
                </div>
              </div>
            </DropZone>
          )}
        </WingHeader>
      </div>
    </div>
  );
}

// ─── צוות ט View ─────────────────────────────────────────────────────────────

function TetView({ scouts, users, onUserDrop, onScoutDrop }: {
  scouts: Scout[]; users: TribeUser[];
  onUserDrop: (userId: number, target: DropTarget) => void;
  onScoutDrop: (scoutId: number, target: ScoutDropTarget) => void;
}) {
  const tetScouts = scouts.filter(s => s.grade === "ט").sort((a, b) => (a.battalion || "").localeCompare(b.battalion || "") || a.name.localeCompare(b.name));
  const tetMadrichim = users.filter(u => u.role === "madrich" && (u.grade === "ט" || u.battalion === "קורס"));
  const tetMarcazim = users.filter(u => u.role === "marcaz_tzair" && (u.grade === "ט" || u.battalion === "שכבה ט"));
  const battalions = [...new Set(tetScouts.map(s => s.battalion).filter((b): b is string => Boolean(b)))].sort();
  const unassigned = tetScouts.filter(s => !s.battalion);

  if (tetScouts.length === 0 && tetMadrichim.length === 0 && tetMarcazim.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground border rounded-2xl border-dashed">
        <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p className="font-medium">אין חניכי כיתה ט במאגר</p>
        <p className="text-xs mt-1">הוסף חניכים עם שכבה ט דרך מאגר החניכים</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
        <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
        <span>גרור חניכים ומדריכים בין גדודות</span>
      </div>

      <div className="rounded-2xl border border-purple-200 bg-purple-50/60 px-5 py-3.5 flex items-center gap-3 flex-wrap">
        <BookOpen className="w-5 h-5 text-purple-600 shrink-0" />
        <span className="font-bold text-purple-900">צוות ט — קורס מדריכים</span>
        <span className="text-purple-700 text-sm">·</span>
        <span className="text-purple-700 text-sm">{tetScouts.length} חניכים</span>
        <span className="mr-auto text-xs bg-purple-100 border border-purple-200 text-purple-800 px-2.5 py-1 rounded-full font-medium">
          מועמדים למדריכים לשנה הבאה
        </span>
      </div>

      {(tetMarcazim.length > 0 || tetMadrichim.length > 0) && (
        <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4 space-y-3">
          {tetMarcazim.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Star className="w-4 h-4 text-red-600 shrink-0" />
              <span className="font-semibold text-sm text-purple-900">מרכזים צעירים:</span>
              {tetMarcazim.map(u => (
                <DraggableChip key={u.id} user={u}>
                  <span className="px-2.5 py-0.5 rounded-full bg-white border border-red-200 text-red-800 text-sm font-medium shadow-sm inline-flex items-center gap-1 hover:bg-red-50 transition-colors">
                    <GripVertical className="w-3 h-3 text-red-300" />
                    {u.name}
                  </span>
                </DraggableChip>
              ))}
            </div>
          )}
          {tetMadrichim.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <User className="w-4 h-4 text-purple-600 shrink-0" />
              <span className="font-semibold text-sm text-purple-900">מדריכי קורס:</span>
              {tetMadrichim.map(u => (
                <DraggableChip key={u.id} user={u}>
                  <span className="px-2.5 py-0.5 rounded-full bg-white border border-purple-200 text-purple-800 text-sm font-medium shadow-sm inline-flex items-center gap-1 hover:bg-purple-50 transition-colors">
                    <GripVertical className="w-3 h-3 text-purple-300" />
                    {u.name}
                  </span>
                </DraggableChip>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {battalions.map(bn => {
          const bnScouts = tetScouts.filter(s => s.battalion === bn);
          return (
            <DropZone key={bn} target={{ role: "madrich", battalion: bn }} onDrop={onUserDrop} onScoutDrop={onScoutDrop}>
              <div className="rounded-xl border border-purple-200 overflow-hidden shadow-sm">
                <div className="px-4 py-2.5 bg-purple-100/60 flex items-center gap-2">
                  <Flag className="w-4 h-4 text-purple-700 shrink-0" />
                  <span className="font-bold text-purple-900">{bn}</span>
                  <span className="mr-auto text-xs text-purple-600 font-medium">{bnScouts.length}</span>
                </div>
                <div className="p-3 bg-white space-y-1.5">
                  {bnScouts.map(s => (
                    <DraggableScoutChip key={s.id} scout={s}>
                      <div className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-purple-50/50 transition-colors group/chip">
                        <GripVertical className="w-3 h-3 text-muted-foreground/30 group-hover/chip:text-muted-foreground/60 shrink-0" />
                        <div className="w-7 h-7 rounded-full bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 text-xs font-bold shrink-0">
                          {s.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{s.name}{s.lastName ? ` ${s.lastName}` : ""}</p>
                          {s.school && <p className="text-xs text-muted-foreground">{s.school}</p>}
                        </div>
                      </div>
                    </DraggableScoutChip>
                  ))}
                  {bnScouts.length === 0 && <p className="text-xs text-muted-foreground/50 italic text-center py-2">גרור חניכים לכאן</p>}
                </div>
              </div>
            </DropZone>
          );
        })}
      </div>

      {unassigned.length > 0 && (
        <ScoutDropZone target={{ battalion: "" }} onDrop={onScoutDrop}>
          <div className="rounded-xl border border-dashed border-muted-foreground/30 overflow-hidden">
            <div className="px-4 py-2 bg-muted/20 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-muted-foreground">ללא גדוד ({unassigned.length})</span>
            </div>
            <div className="p-3 flex flex-wrap gap-1.5">
              {unassigned.map(s => (
                <DraggableScoutChip key={s.id} scout={s}>
                  <span className="text-xs px-2 py-0.5 rounded bg-muted border text-muted-foreground hover:text-blue-600 transition-colors cursor-grab">
                    {s.name}{s.lastName ? ` ${s.lastName}` : ""}
                  </span>
                </DraggableScoutChip>
              ))}
            </div>
          </div>
        </ScoutDropZone>
      )}

      <div className="flex flex-wrap gap-2 pt-1 text-xs">
        {battalions.map(bn => (
          <div key={bn} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-purple-200 bg-purple-50">
            <Flag className="w-3 h-3 text-purple-600" />
            <span className="text-purple-800 font-medium">{bn}</span>
            <span className="text-purple-600">{tetScouts.filter(s => s.battalion === bn).length}</span>
          </div>
        ))}
        {tetMadrichim.length > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-purple-300 bg-purple-100">
            <User className="w-3 h-3 text-purple-700" />
            <span className="text-purple-900 font-medium">מדריכי קורס</span>
            <span className="text-purple-700">{tetMadrichim.length}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Battalion Settings Panel ─────────────────────────────────────────────────

function BattalionSettingsPanel({ scouts, onRename }: {
  scouts: Scout[];
  onRename: (oldName: string, newName: string) => void;
}) {
  const battalions = [...new Set(scouts.map(s => s.battalion).filter((b): b is string => Boolean(b)))].sort();
  const [editing, setEditing] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  if (battalions.length === 0) {
    return <p className="text-sm text-muted-foreground italic px-2">אין גדודים מוגדרים</p>;
  }

  return (
    <div className="space-y-2">
      {battalions.map(bn => (
        <div key={bn} className="flex items-center gap-2 p-2 rounded-lg border hover:border-muted-foreground/40 transition-colors group">
          <Flag className="w-4 h-4 text-yellow-600 shrink-0" />
          {editing === bn ? (
            <>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && newName.trim()) { onRename(bn, newName.trim()); setEditing(null); }
                  if (e.key === "Escape") setEditing(null);
                }}
                className="h-7 text-sm flex-1"
                autoFocus
              />
              <button
                onClick={() => { if (newName.trim()) { onRename(bn, newName.trim()); setEditing(null); } }}
                className="text-green-600 hover:bg-green-50 px-2 py-0.5 rounded text-xs flex items-center gap-1 border border-green-200">
                <Check className="w-3 h-3" /> שמור
              </button>
              <button onClick={() => setEditing(null)} className="text-muted-foreground text-xs px-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <span className="text-sm flex-1 font-medium">{bn}</span>
              <button
                onClick={() => { setEditing(bn); setNewName(bn); }}
                className="opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-transparent hover:border-border">
                <Pencil className="w-3 h-3" /> שנה שם
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export function StaffTree() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isAdmin = role === "marcaz_boger";

  const [activeTab, setActiveTab] = useState<"moadal" | "chanichim" | "paelim" | "tet" | "next-year">("moadal");

  const { data: users = [], isLoading: ul } = useQuery<TribeUser[]>({
    queryKey: ["tribe-users"],
    queryFn: () => fetch(`${API_BASE}/api/users`).then(r => r.json()),
  });

  const { data: scouts = [] } = useQuery<Scout[]>({
    queryKey: ["scouts-raw"],
    queryFn: () => fetch(`${API_BASE}/api/scouts`).then(r => r.json()),
  });

  const { data: settings = {} } = useQuery<AppSettings>({
    queryKey: ["app-settings"],
    queryFn: () => fetch(`${API_BASE}/api/settings`).then(r => r.json()),
  });

  const addUser = useMutation({
    mutationFn: (data: { name: string; role: string; battalion?: string }) =>
      fetch(`${API_BASE}/api/users`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: (u: TribeUser) => {
      qc.invalidateQueries({ queryKey: ["tribe-users"] });
      toast({ title: `${u.name} נוסף לצוות` });
    },
    onError: () => toast({ title: "שגיאה ביצירת משתמש", variant: "destructive" }),
  });

  const editUser = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; name?: string; role?: string; battalion?: string | null; team?: string | null; grade?: string | null }) => {
      const res = await fetch(`${API_BASE}/api/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "שגיאה בעדכון משתמש");
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tribe-users"] });
      toast({ title: "משתמש עודכן" });
    },
    onError: (err: Error) => toast({ title: err.message || "שגיאה בעדכון משתמש", variant: "destructive" }),
  });

  const editScout = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; battalion?: string | null }) => {
      const res = await fetch(`${API_BASE}/api/scouts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "שגיאה בעדכון חניך");
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scouts-raw"] });
      toast({ title: "חניך עודכן" });
    },
    onError: (err: Error) => toast({ title: err.message || "שגיאה בעדכון חניך", variant: "destructive" }),
  });

  const syncStaffToScouts = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/users/sync-staff-to-scouts`, { method: "POST", headers: { "Content-Type": "application/json" } });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "שגיאה בסנכרון");
      return result;
    },
    onSuccess: (data: { scoutsCreated: number; scoutsLinked: number; usersUpdated: number; teamMapping: Record<string, string[]> }) => {
      qc.invalidateQueries({ queryKey: ["scouts-raw"] });
      qc.invalidateQueries({ queryKey: ["tribe-users"] });
      const mappingStr = Object.entries(data.teamMapping).map(([team, leaders]) => `${team}: ${leaders.join(", ")}`).join("\n");
      toast({
        title: "סנכרון הושלם",
        description: `${data.scoutsCreated} חניכים נוצרו · ${data.scoutsLinked} קושרו · ${data.usersUpdated} ראשצ עודכנו${mappingStr ? `\n${mappingStr}` : ""}`,
      });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const renameTeam = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      const res = await fetch(`${API_BASE}/api/users/rename-team`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ oldName, newName }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "שגיאה בשינוי שם צוות");
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tribe-users"] });
      toast({ title: "צוות שונה בהצלחה" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const clearTeam = useMutation({
    mutationFn: async (teamName: string) => {
      const res = await fetch(`${API_BASE}/api/users/clear-team`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamName }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "שגיאה במחיקת צוות");
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tribe-users"] });
      toast({ title: "צוות נמחק" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const removeUser = useMutation({
    mutationFn: (id: number) => fetch(`${API_BASE}/api/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tribe-users"] });
      toast({ title: "משתמש הוסר מהצוות" });
    },
  });

  const updateSetting = useMutation({
    mutationFn: ({ key, value }: { key: string; value: boolean }) =>
      fetch(`${API_BASE}/api/settings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value: String(value) }) }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-settings"] });
    },
  });

  const renameBattalion = useMutation({
    mutationFn: ({ oldName, newName }: { oldName: string; newName: string }) =>
      fetch(`${API_BASE}/api/users/rename-battalion`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ oldName, newName }) }).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["scouts-raw"] });
      qc.invalidateQueries({ queryKey: ["tribe-users"] });
      toast({ title: `גדוד שונה — ${data.scoutsUpdated} חניכים, ${data.usersUpdated} משתמשים עודכנו` });
    },
    onError: () => toast({ title: "שגיאה בשינוי שם גדוד", variant: "destructive" }),
  });

  const handleSettingChange = (key: string, val: boolean) => {
    updateSetting.mutate({ key, value: val });
  };

  /* ─── Excel import for assignments ─── */
  const assignFileRef = useRef<HTMLInputElement>(null);
  const [assignRows, setAssignRows] = useState<{ name: string; role: string; battalion: string; team?: string; grade?: string }[] | null>(null);
  const [assignFileName, setAssignFileName] = useState<string | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignResult, setAssignResult] = useState<{ created: number; updated: number; skipped: number; cleared: number } | null>(null);
  const [assignParseMode, setAssignParseMode] = useState<"shibuzim" | "generic" | null>(null);
  const [clearBeforeImport, setClearBeforeImport] = useState(true);
  const [deleteTreeConfirm, setDeleteTreeConfirm] = useState(false);

  /* ── helpers ── */
  function cleanName(s: unknown): string {
    return (s || "").toString().trim().replace(/\s+/g, " ").replace(/["'()]/g, "").trim();
  }
  function splitInstructors(str: string): string[] {
    if (!str || typeof str !== "string") return [];
    return str
      .split(/\+|,\s*|\n/)
      .flatMap(part => part.split(/\s+ו(?=[א-ת])/))
      .map(s => cleanName(s))
      .filter(s => s.length > 1 && !/^\d+$/.test(s) && !s.includes("מדריכים") && !s.includes("קודמים"));
  }

  /* ── parser: specific שיבוצים multi-sheet format ── */
  type ParsedRow = { name: string; role: string; battalion: string; team?: string; grade?: string };

  function parseShevatzimWorkbook(wb: XLSX.WorkBook): ParsedRow[] {
    const rows: ParsedRow[] = [];

    // ===== צוות מוביל =====
    const ws1Name = wb.SheetNames.find(n => n.includes("צוות מוביל") || n.includes("צוות מובל")) || "צוות מוביל";
    const ws1 = wb.Sheets[ws1Name];
    if (!ws1) return rows;
    const d1: any[][] = XLSX.utils.sheet_to_json(ws1, { header: 1, defval: "" });

    // Row 0 header: מרכזים,ד',ה',ו' - ט',ז' - ח',לוגיסטיקה+מפעלים,...
    // Row 1: names → marcaz_boger
    const marcazGrades = ["ד", "ה", "ו-ט", "ז-ח", "לוגיסטיקה", "שכבג+פעילים", "קהילה"];
    if (d1[1]) d1[1].slice(1, 8).forEach((cell: any, i: number) => {
      const n = cleanName(cell);
      if (n.length > 1) rows.push({ name: n, role: "marcaz_boger", battalion: marcazGrades[i] || "מרכזים" });
    });

    // Rows 3-11: קורס section
    for (let r = 3; r <= 11; r++) {
      if (!d1[r]) continue;
      const col1 = cleanName(d1[r][1]);
      const col2 = cleanName(d1[r][2]);
      if (col1.length > 1 && !col1.includes("שכבה") && !col1.includes("קורס"))
        rows.push({ name: col1, role: "marcaz_tzair", battalion: "שכבה ט", grade: "ט" });
      if (col2.length > 1 && !col2.includes("שכבה") && !col2.includes("קורס"))
        rows.push({ name: col2, role: "madrich", battalion: "קורס", grade: "ט" });
    }

    // Rows 13-17: ראשגדים
    const gadGrades = ["ד", "ה", "ו", "ז", "ח", "חוץ"];
    for (let r = 0; r < d1.length; r++) {
      const rowStr = String(d1[r]?.[0] || "").trim();
      if (!rowStr.includes("ראשג")) continue;
      for (let r2 = r; r2 < Math.min(r + 5, d1.length); r2++) {
        if (!d1[r2]) continue;
        for (let c = 1; c <= 6; c++) {
          const n = cleanName(d1[r2][c]);
          if (n.length > 1 && !n.includes("ראשג"))
            rows.push({ name: n, role: "roshgad", battalion: gadGrades[c - 1], grade: gadGrades[c - 1] });
        }
      }
      break;
    }

    // ראשצים — scan for sections
    for (let r = 0; r < d1.length; r++) {
      const rowStr = String(d1[r]?.[0] || "").trim();
      if (!rowStr.includes("ראשצ")) continue;
      for (let r2 = r + 1; r2 < Math.min(r + 3, d1.length); r2++) {
        if (!d1[r2]) continue;
        for (let c = 1; c < d1[r2].length; c++) {
          const n = cleanName(d1[r2][c]);
          const hdr = String(d1[r]?.[c] || "").trim();
          if (!hdr || n.length < 2 || n.includes("ראשצ")) continue;
          rows.push({ name: n, role: "roshatz", battalion: hdr });
        }
      }
    }

    // Additional sections: שכב"ג, פעילים, domain heads
    for (let r = 0; r < d1.length; r++) {
      if (!d1[r]) continue;
      const cells = d1[r].map((c: any) => String(c || "").trim());
      const hasSubHeader = cells.some((c: string) =>
        c.includes("שכב") || c.includes("פעילים") || c.includes("צפ") ||
        c.includes("צופים") || c.includes("קהילה") || c.includes("לה") ||
        c.includes("מועדון") || c.includes("אור כתום") || c.includes("גזברות") || c.includes("מפעלים")
      );
      if (!hasSubHeader || cells[0]?.includes("מרכז") || cells[0]?.includes("ראשג") || cells[0]?.includes("ראשצ")) continue;
      for (let r2 = r + 1; r2 < Math.min(r + 3, d1.length); r2++) {
        if (!d1[r2]) continue;
        for (let c = 1; c < d1[r2].length; c++) {
          const n = cleanName(d1[r2][c]);
          const hdr = String(cells[c] || "").trim();
          if (!hdr || n.length < 2) continue;
          rows.push({ name: n, role: "roshatz", battalion: hdr });
        }
      }
    }

    // ===== הדרכה sheets — extract grade + battalion + instructor names =====
    function gradeFromSheetName(name: string): string {
      const clean = name.replace(/['"׳]/g, "").replace("הדרכה", "").trim();
      if (/^[דהוזחט]$/.test(clean)) return clean;
      const rangeMatch = clean.match(/^([דהוזחט])\s*-\s*([דהוזחט])$/);
      if (rangeMatch) return `${rangeMatch[1]}-${rangeMatch[2]}`;
      if (clean.includes("ד-ה") || clean.includes("ד'-ה'")) return "ד-ה";
      if (clean.includes("ו-ח") || clean.includes("ו'-ח'")) return "ו-ח";
      if (clean.includes("ז-ח") || clean.includes("ז'-ח'")) return "ז-ח";
      return "";
    }

    function parseHadrachaSheet(data: any[][], sheetName: string) {
      let currentGrade = gradeFromSheetName(sheetName);

      for (let r = 0; r < data.length; r++) {
        const row = data[r];
        if (!row) continue;

        // Extract מרכז צעיר from hadracha sheets
        for (let c = 0; c < row.length; c++) {
          const cell = String(row[c] || "").trim();
          if (cell === "מרכז צעיר") {
            for (let c2 = c + 1; c2 < Math.min(c + 3, row.length); c2++) {
              const n = cleanName(row[c2]);
              if (n.length > 1)
                rows.push({ name: n, role: "marcaz_tzair", battalion: currentGrade || sheetName, grade: currentGrade });
            }
          }
        }

        // Detect grade markers in leftmost columns
        for (let c = 0; c <= 1; c++) {
          const cell = String(row[c] || "").trim().replace(/['"׳]/g, "");
          if (/^[דהוזח]$/.test(cell)) currentGrade = cell;
        }

        // Scan for battalion headers: "גדוד N - schools - ראשגד name"
        const batCols: { col: number; bat: string; roshgad: string; grade: string }[] = [];
        for (let c = 0; c < row.length; c++) {
          const cell = String(row[c] || "").trim();
          if (cell.includes("גדוד")) {
            const batName = cell.split("-")[0].trim();
            const roshgadMatch = cell.match(/-\s*([^-]+)$/);
            const roshgad = roshgadMatch ? roshgadMatch[1].trim() : "";
            batCols.push({ col: c, bat: batName, roshgad, grade: currentGrade });
          }
        }
        if (batCols.length === 0) continue;

        // Find the "מדריכים" column for each battalion
        const nextRow = data[r + 1];
        const mdrichCols: { batIdx: number; col: number }[] = [];
        if (nextRow) {
          for (let bc = 0; bc < batCols.length; bc++) {
            const startCol = batCols[bc].col;
            const endCol = bc < batCols.length - 1 ? batCols[bc + 1].col : row.length;
            for (let c = startCol; c < endCol; c++) {
              const h = String(nextRow[c] || "").trim();
              if (h === "מדריכים") {
                mdrichCols.push({ batIdx: bc, col: c });
                break;
              }
            }
          }
        }

        // Read rows below for instructor names
        for (let r2 = r + 2; r2 < data.length && r2 < r + 30; r2++) {
          const row2 = data[r2];
          if (!row2) continue;
          const hasNewBattalion = row2.some((c: any) => String(c || "").trim().includes("גדוד"));
          if (hasNewBattalion) break;

          if (mdrichCols.length > 0) {
            for (const { batIdx, col } of mdrichCols) {
              const cell = String(row2[col] || "").trim();
              if (!cell || cell.includes("קודמים") || cell === "מדריכים") continue;
              splitInstructors(cell).forEach(n => {
                if (n.length > 1) rows.push({ name: n, role: "madrich", battalion: batCols[batIdx].bat, grade: batCols[batIdx].grade });
              });
            }
          } else {
            batCols.forEach(({ col, bat, grade }) => {
              for (const nameCol of [col, col + 1]) {
                if (nameCol >= row2.length) continue;
                const cell = String(row2[nameCol] || "").trim();
                if (!cell || cell.includes("קודמים") || cell.includes("מדריכים נוכחיים") || cell === "מדריכים" || cell.includes("קבוצה")) continue;
                splitInstructors(cell).forEach(n => {
                  if (n.length > 1) rows.push({ name: n, role: "madrich", battalion: bat, grade });
                });
              }
            });
          }
        }
      }
    }

    wb.SheetNames.filter(n => n.startsWith("הדרכה") || n.includes("הדרכה")).forEach(sheetName => {
      const d: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" });
      parseHadrachaSheet(d, sheetName);
    });

    // ===== צוותי פעילים — multi-section parser =====
    const paelimSheetName = wb.SheetNames.find(n => n.includes("פעילים"));
    if (paelimSheetName && wb.Sheets[paelimSheetName]) {
      const d4: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[paelimSheetName], { header: 1, defval: "" });
      if (d4.length > 0) {
        let currentHeaders: string[] = [];

        for (let r = 0; r < d4.length; r++) {
          if (!d4[r]) continue;
          const cells = d4[r].map((c: any) => String(c || "").trim());

          // Detect header rows: rows with multiple non-empty cells that look like team names
          const nonEmpty = cells.filter(c => c.length > 1);
          const looksLikeHeader = nonEmpty.length >= 3 && nonEmpty.some(c =>
            /^(ראשגד|מחסן|קיוסק|שכב|חברי|קהילה|צופי|צפ|לה|פעילים|צוות|תחזוקה)/.test(c)
          );

          if (looksLikeHeader) {
            currentHeaders = cells;
            continue;
          }

          if (currentHeaders.length === 0) continue;

          for (let c = 0; c < cells.length; c++) {
            const hdr = currentHeaders[c] || "";
            if (!hdr) continue;
            const n = cleanName(cells[c]);
            if (n.length < 2) continue;
            if (/^(ראשגד|מחסן|קיוסק|שכב|חברי|קהילה|צופי|צפ|לה|פעילים|שם|צוות|תחזוקה|מועדון|אור כתום|גזברות)/.test(n)) continue;
            const role = hdr.includes("ראשגד") ? "roshgad" : "pael";
            rows.push({ name: n, role, battalion: "", team: hdr });
          }
        }
      }
    }

    // Deduplicate — first occurrence = most senior role
    const seen = new Set<string>();
    return rows.filter(r => {
      const key = r.name.trim().toLowerCase().replace(/\s+/g, " ");
      if (seen.has(key)) return false;
      seen.add(key);
      return r.name.trim().length > 1;
    });
  }

  /* ── parser: generic flat table ── */
  const ROLE_IMPORT_MAP: Record<string, string> = {
    "מרכז בוגר": "marcaz_boger", "מרכז צעיר": "marcaz_tzair",
    "ראשצ": "roshatz", "ראש צוות": "roshatz",
    "ראשגד": "roshgad", "ראש גדוד": "roshgad",
    "מדריך": "madrich", "פעיל": "pael",
  };
  function parseGenericWorkbook(wb: XLSX.WorkBook): ParsedRow[] {
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
    return data.map(row => {
      const firstName = (row["שם פרטי"] || row["שם"] || row["name"] || "").toString().trim();
      const lastName = (row["שם משפחה"] || row["lastName"] || "").toString().trim();
      const name = [firstName, lastName].filter(Boolean).join(" ");
      const rawRole = (row["תפקיד"] || row["role"] || "").toString().trim();
      const role = ROLE_IMPORT_MAP[rawRole] || rawRole;
      const battalion = (row["גדוד"] || row["battalion"] || "").toString().trim();
      return { name, role, battalion };
    }).filter(r => r.name && r.role);
  }

  const handleAssignFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAssignFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const sheetNames = wb.SheetNames;
        const hasLeaderSheet = sheetNames.some(n => n.includes("צוות מוביל") || n.includes("צוות מובל"));
        const hasHadrachaSheet = sheetNames.some(n => n.includes("הדרכה"));
        const isShevatzim = hasLeaderSheet && (hasHadrachaSheet || sheetNames.some(n => n.includes("פעילים")));
        if (isShevatzim) {
          const rows = parseShevatzimWorkbook(wb);
          setAssignRows(rows);
          setAssignParseMode("shibuzim");
        } else {
          const rows = parseGenericWorkbook(wb);
          setAssignRows(rows);
          setAssignParseMode("generic");
        }
        setAssignResult(null);
      } catch (err) {
        toast({ title: "שגיאה בקריאת הקובץ", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const handleAssignSubmit = async () => {
    if (!assignRows) return;
    setAssignLoading(true);
    try {
      const rolesInImport = [...new Set(assignRows.map(r => r.role))];
      const clearRoles = clearBeforeImport ? rolesInImport.filter(r => ["madrich", "roshgad", "pael"].includes(r)) : [];
      const res = await fetch(`${API_BASE}/api/users/import-assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: assignRows, clearRoles }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "שגיאה בייבוא");
      setAssignResult(data);
      setAssignRows(null);
      setAssignFileName(null);
      setAssignParseMode(null);
      qc.invalidateQueries({ queryKey: ["tribe-users"] });
      toast({ title: `שיבוץ הושלם — ${data.created} נוצרו, ${data.updated} עודכנו` });
    } catch {
      toast({ title: "שגיאה בייבוא שיבוצים", variant: "destructive" });
    } finally {
      setAssignLoading(false);
    }
  };

  const planningLocked = settings["planningLocked"] === "true";
  const executionLocked = settings["executionLocked"] === "true";
  const nextYearLocked = settings["nextYearLocked"] === "true";

  const byRole = (r: string) => users.filter(u => u.role === r);

  const chanichimScouts = scouts.filter(s => s.grade && CHANICHIM_GRADES.has(s.grade));
  const paelimScouts = scouts.filter(s => s.grade && PAELIM_GRADES.has(s.grade));
  const tetScouts = scouts.filter(s => s.grade === "ט");

  if (ul) {
    return <div className="text-center py-16 text-muted-foreground">טוען עץ צוות...</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold">עץ שיבוצים</h2>
          <p className="text-muted-foreground">
            {activeTab === "moadal" && "מבנה היררכי של צוות השבט הבוגר"}
            {activeTab === "chanichim" && "חניכים (ד-ח) לפי גדוד, בית ספר ומדריך"}
            {activeTab === "paelim" && "פעילים (י-יב) לפי קבוצה ושכבה"}
            {activeTab === "tet" && "צוות ט — חניכי כיתה ט, קורס מדריכים"}
            {activeTab === "next-year" && "תכנון שיבוצים לשנה הבאה ממאגר חניכים"}
          </p>
        </div>
        {activeTab === "moadal" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{users.length} חברי צוות</span>
          </div>
        )}
      </div>

      {/* Tab toggle */}
      <div className="flex p-1 bg-muted rounded-xl w-fit gap-1 flex-wrap">
        <button
          onClick={() => setActiveTab("moadal")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "moadal" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}>
          <Crown className="w-4 h-4" />
          צוות מובל
        </button>
        <button
          onClick={() => setActiveTab("chanichim")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "chanichim" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}>
          <Flag className="w-4 h-4" />
          הדרכה ד-ח
        </button>
        <button
          onClick={() => setActiveTab("tet")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "tet" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}>
          <BookOpen className="w-4 h-4" />
          צוות ט{tetScouts.length > 0 && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">{tetScouts.length}</span>}
        </button>
        <button
          onClick={() => setActiveTab("paelim")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "paelim" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}>
          <Shield className="w-4 h-4" />
          צוות פעילים
        </button>
        {(!nextYearLocked || isAdmin) && (
          <button
            onClick={() => setActiveTab("next-year")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "next-year" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}>
            <UserPlus className="w-4 h-4" />
            שנה הבאה
            {nextYearLocked && <Lock className="w-3.5 h-3.5 text-amber-500" />}
          </button>
        )}
      </div>

      {activeTab === "next-year" && (!nextYearLocked || isAdmin) ? (
        <NextYearView scouts={scouts} />
      ) : activeTab === "chanichim" ? (
        <ChanichimGridView scouts={scouts} users={users}
          onUserDrop={(userId, target) => {
            const user = users.find(u => u.id === userId);
            if (!user) return;
            if ((user.battalion || "") === target.battalion) return;
            editUser.mutate({ id: userId, battalion: target.battalion || null });
          }}
          onScoutDrop={(scoutId, target) => {
            const scout = scouts.find(s => s.id === scoutId);
            if (!scout) return;
            if ((scout.battalion || "") === target.battalion) return;
            editScout.mutate({ id: scoutId, battalion: target.battalion || null });
          }}
        />
      ) : activeTab === "paelim" ? (
        <PaelimGridView scouts={scouts} users={users}
          onUserDrop={(userId, target) => {
            const user = users.find(u => u.id === userId);
            if (!user) return;
            editUser.mutate({ id: userId, team: target.team || null });
          }}
          onTeamUpdate={(userId, team) => {
            editUser.mutate({ id: userId, team });
          }}
          onTeamRename={async (oldName, newName) => {
            await renameTeam.mutateAsync({ oldName, newName });
          }}
          onTeamDelete={async (teamName) => {
            await clearTeam.mutateAsync(teamName);
          }}
          onSync={() => syncStaffToScouts.mutate()}
          syncing={syncStaffToScouts.isPending}
        />
      ) : activeTab === "tet" ? (
        <TetView scouts={scouts} users={users}
          onUserDrop={(userId, target) => {
            const user = users.find(u => u.id === userId);
            if (!user) return;
            if ((user.battalion || "") === target.battalion) return;
            editUser.mutate({ id: userId, battalion: target.battalion || null });
          }}
          onScoutDrop={(scoutId, target) => {
            const scout = scouts.find(s => s.id === scoutId);
            if (!scout) return;
            if ((scout.battalion || "") === target.battalion) return;
            editScout.mutate({ id: scoutId, battalion: target.battalion || null });
          }}
        />
      ) : (
        <>
          {/* Lock Controls + Battalion Settings — admin only */}
          {isAdmin && (
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b bg-muted/30 flex items-center gap-2">
                <Settings className="w-4 h-4 text-muted-foreground" />
                <p className="font-semibold text-sm">הגדרות מנהל</p>
              </div>

              {/* Lock toggles */}
              <div className="p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">נעילות מערכת</p>
                <div className="grid md:grid-cols-3 gap-3">
                  <LockToggle
                    label="נעל תכנון"
                    description="מסתיר נתוני תכנון מתפקידים נמוכים"
                    settingKey="planningLocked"
                    value={planningLocked}
                    onChange={handleSettingChange}
                    locked={updateSetting.isPending}
                  />
                  <LockToggle
                    label="נעל ביצוע"
                    description="מסתיר נתוני ביצוע מתפקידים נמוכים"
                    settingKey="executionLocked"
                    value={executionLocked}
                    onChange={handleSettingChange}
                    locked={updateSetting.isPending}
                  />
                  <LockToggle
                    label="נעל שנה הבאה"
                    description="רק מרכז בוגר יוכל לגשת לתכנון שנה הבאה"
                    settingKey="nextYearLocked"
                    value={nextYearLocked}
                    onChange={handleSettingChange}
                    locked={updateSetting.isPending}
                  />
                </div>
              </div>

              {/* Battalion name editor */}
              <div className="px-4 pb-4 space-y-2 border-t pt-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">שמות גדודים</p>
                <p className="text-xs text-muted-foreground">לחץ על "שנה שם" ליד כל גדוד לעדכון — ישנה בכל החניכים והמשתמשים</p>
                <BattalionSettingsPanel
                  scouts={scouts}
                  onRename={(oldName, newName) => renameBattalion.mutate({ oldName, newName })}
                />
              </div>

              {/* Delete tree */}
              <div className="px-4 pb-4 space-y-2 border-t pt-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">מחיקת עץ שיבוצים</p>
                {!deleteTreeConfirm ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10 w-full gap-2"
                    onClick={() => setDeleteTreeConfirm(true)}
                  >
                    <Trash2 className="w-4 h-4" /> מחק את כל העץ
                  </Button>
                ) : (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                    <p className="text-sm font-medium text-destructive">האם למחוק את כל אנשי הצוות? הפעולה בלתי הפיכה.</p>
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                        onClick={async () => {
                          await fetch(`${API_BASE}/api/users`, { method: "DELETE" });
                          qc.invalidateQueries({ queryKey: ["tribe-users"] });
                          setDeleteTreeConfirm(false);
                          toast({ title: "עץ השיבוצים נמחק" });
                        }}
                      >
                        כן, מחק הכל
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setDeleteTreeConfirm(false)}>ביטול</Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Excel assignments import */}
              <div className="px-4 pb-4 space-y-3 border-t pt-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">ייבוא שיבוצים מאקסל</p>
                <p className="text-xs text-muted-foreground">
                  תומך בפורמט קובץ השיבוצים הרב-שלוני (כל הטאבים: צוות מוביל, הדרכה, צוותי פעילים)
                  או בטבלה רגילה עם עמודות <span className="font-mono bg-muted px-1 rounded">שם פרטי, שם משפחה, תפקיד, גדוד</span>
                </p>
                {/* Clear before import toggle */}
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <Switch checked={clearBeforeImport} onCheckedChange={setClearBeforeImport} />
                  <span className="text-sm">
                    נקה מדריכים, ראשגדים ופעילים קיימים לפני הייבוא
                  </span>
                </label>
                <input ref={assignFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleAssignFile} />

                {/* Drop zone / file picker */}
                {!assignRows && !assignResult && (
                  <button
                    type="button"
                    onClick={() => assignFileRef.current?.click()}
                    className="w-full border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="w-8 h-8 text-muted-foreground" />
                    <span className="text-sm font-medium">לחץ לבחירת קובץ Excel</span>
                    <span className="text-xs text-muted-foreground">.xlsx</span>
                  </button>
                )}

                {/* Preview after parse */}
                {assignRows && (() => {
                  const byRole: Record<string, number> = {};
                  assignRows.forEach(r => { byRole[r.role] = (byRole[r.role] || 0) + 1; });
                  const roleMeta: Record<string, { label: string; color: string; bg: string }> = {
                    marcaz_boger: { label: "מרכז בוגר", color: "text-blue-700", bg: "bg-blue-50" },
                    marcaz_tzair: { label: "מרכז צעיר", color: "text-red-700", bg: "bg-red-50" },
                    roshatz: { label: "ראשצ", color: "text-sky-700", bg: "bg-sky-50" },
                    roshgad: { label: "ראשגד", color: "text-rose-700", bg: "bg-rose-50" },
                    madrich: { label: "מדריך", color: "text-green-700", bg: "bg-green-50" },
                    pael: { label: "פעיל", color: "text-purple-700", bg: "bg-purple-50" },
                  };
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium text-green-700">{assignFileName}</span>
                          {assignParseMode === "shibuzim" && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">פורמט שיבוצים</span>
                          )}
                        </div>
                        <button type="button" onClick={() => { setAssignRows(null); setAssignFileName(null); setAssignParseMode(null); }} className="text-xs text-muted-foreground hover:text-foreground">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-sm font-medium">זוהו {assignRows.length} אנשי צוות:</div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {Object.entries(byRole).map(([role, count]) => {
                          const m = roleMeta[role] || { label: role, color: "text-foreground", bg: "bg-muted" };
                          return (
                            <div key={role} className={`text-center rounded-lg p-2 ${m.bg}`}>
                              <p className={`text-lg font-bold ${m.color}`}>{count}</p>
                              <p className={`text-xs ${m.color}`}>{m.label}</p>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleAssignSubmit} disabled={assignLoading} className="flex-1">
                          <Upload className="w-4 h-4 ml-1" />
                          {assignLoading ? "מייבא..." : `ייבא ${assignRows.length} אנשי צוות`}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => assignFileRef.current?.click()}>
                          קובץ אחר
                        </Button>
                      </div>
                    </div>
                  );
                })()}

                {/* Result after import */}
                {assignResult && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-green-700">הייבוא הושלם בהצלחה</p>
                    <div className="grid grid-cols-4 gap-2">
                      {assignResult.cleared > 0 && (
                        <div className="text-center border rounded-lg p-2 bg-orange-50">
                          <p className="text-lg font-bold text-orange-600">{assignResult.cleared}</p>
                          <p className="text-xs text-muted-foreground">הוסרו</p>
                        </div>
                      )}
                      <div className="text-center border rounded-lg p-2 bg-green-50">
                        <p className="text-lg font-bold text-green-600">{assignResult.created}</p>
                        <p className="text-xs text-muted-foreground">נוצרו</p>
                      </div>
                      <div className="text-center border rounded-lg p-2 bg-blue-50">
                        <p className="text-lg font-bold text-blue-600">{assignResult.updated}</p>
                        <p className="text-xs text-muted-foreground">עודכנו</p>
                      </div>
                      <div className="text-center border rounded-lg p-2 bg-muted">
                        <p className="text-lg font-bold text-muted-foreground">{assignResult.skipped}</p>
                        <p className="text-xs text-muted-foreground">דולגו</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => { setAssignResult(null); }}>
                      <FileSpreadsheet className="w-4 h-4 ml-1" /> ייבא קובץ נוסף
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Org Grid — two-wing view */}
          <MoadalGridView users={users} onUserDrop={(userId, target) => {
            const user = users.find(u => u.id === userId);
            if (!user) return;
            if (user.role === target.role && (user.battalion || "") === target.battalion) return;
            editUser.mutate({ id: userId, role: target.role, battalion: target.battalion || null });
          }} />

          {/* Summary footer */}
          <div className="flex flex-wrap gap-3 text-sm">
            {Object.entries(ROLE_META).map(([roleKey, meta]) => {
              const count = byRole(roleKey).length;
              return (
                <div key={roleKey} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${meta.border} ${meta.bg}`}>
                  <meta.icon className={`w-3.5 h-3.5 ${meta.color}`} />
                  <span className={`font-medium text-xs ${meta.color}`}>{meta.label}</span>
                  <span className="text-xs text-muted-foreground">{count}</span>
                </div>
              );
            })}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50">
              <BookOpen className="w-3.5 h-3.5 text-purple-600" />
              <span className="font-medium text-xs text-purple-700">צוות ט</span>
              <span className="text-xs text-muted-foreground">{tetScouts.length}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-sky-200 bg-sky-50">
              <Users className="w-3.5 h-3.5 text-sky-600" />
              <span className="font-medium text-xs text-sky-700">פעילים</span>
              <span className="text-xs text-muted-foreground">{paelimScouts.length}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50">
              <Users className="w-3.5 h-3.5 text-rose-600" />
              <span className="font-medium text-xs text-rose-700">חניכים</span>
              <span className="text-xs text-muted-foreground">{chanichimScouts.length}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
