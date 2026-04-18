import { useState, useRef } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useAuth, ROLE_NAMES } from "@/hooks/use-auth";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldAlert, Plus, Trash2, Shield, ChevronDown, Pencil,
  KeyRound, Crown, X, Check, Flag, Star, Info,
  Lock, Unlock, Eye, EyeOff, Users, RefreshCw, Loader2, Upload, FileSpreadsheet
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import * as XLSX from "xlsx";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const SECTIONS = [
  {
    id: "hadracha", label: "מדור הדרכה", desc: "ניהול חניכים, נוכחות, פעולות",
    features: [
      { id: "scouts", label: "מאגר חניכים" },
      { id: "attendance", label: "נוכחות" },
      { id: "activities", label: "הגשת פעולות" },
    ],
  },
  {
    id: "logistics", label: "מדור לוגיסטיקה", desc: "מפעלים, תקציב, הזמנות רכש",
    features: [
      { id: "events", label: "מפעלים" },
      { id: "budget", label: "תקציב" },
      { id: "procurement", label: "הזמנות רכש" },
    ],
  },
];

const ROLE_KEYS = ["marcaz_tzair", "roshatz", "roshgad", "madrich"];

type TribeUser = { id: number; name: string; role: string; battalion?: string | null; active: boolean; hasPin: boolean };

const ROLE_CONFIG: Record<string, {
  label: string;
  icon: React.ElementType;
  headerBg: string;
  headerText: string;
  headerBorder: string;
  cardBg: string;
  avatarBg: string;
  badgeBg: string;
  badgeText: string;
  isAdmin?: boolean;
}> = {
  marcaz_boger: {
    label: "מרכז בוגר",
    icon: Crown,
    headerBg: "bg-blue-600",
    headerText: "text-white",
    headerBorder: "border-blue-700",
    cardBg: "bg-blue-50/40 border-blue-200",
    avatarBg: "bg-blue-600",
    badgeBg: "bg-blue-100",
    badgeText: "text-blue-800",
    isAdmin: true,
  },
  marcaz_tzair: {
    label: "מרכז צעיר",
    icon: Star,
    headerBg: "bg-red-500",
    headerText: "text-white",
    headerBorder: "border-red-600",
    cardBg: "bg-red-50/30 border-red-200",
    avatarBg: "bg-red-500",
    badgeBg: "bg-red-100",
    badgeText: "text-red-800",
  },
  roshatz: {
    label: "ראשצ",
    icon: Shield,
    headerBg: "bg-sky-500",
    headerText: "text-white",
    headerBorder: "border-sky-600",
    cardBg: "bg-sky-50/30 border-sky-200",
    avatarBg: "bg-sky-500",
    badgeBg: "bg-sky-100",
    badgeText: "text-sky-800",
  },
  roshgad: {
    label: "ראשגד",
    icon: Flag,
    headerBg: "bg-rose-500",
    headerText: "text-white",
    headerBorder: "border-rose-600",
    cardBg: "bg-rose-50/30 border-rose-200",
    avatarBg: "bg-rose-500",
    badgeBg: "bg-rose-100",
    badgeText: "text-rose-800",
  },
  madrich: {
    label: "מדריך",
    icon: Users,
    headerBg: "bg-emerald-500",
    headerText: "text-white",
    headerBorder: "border-emerald-600",
    cardBg: "bg-emerald-50/30 border-emerald-200",
    avatarBg: "bg-emerald-500",
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-800",
  },
  pael: {
    label: "פעיל",
    icon: Users,
    headerBg: "bg-teal-500",
    headerText: "text-white",
    headerBorder: "border-teal-600",
    cardBg: "bg-teal-50/30 border-teal-200",
    avatarBg: "bg-teal-500",
    badgeBg: "bg-teal-100",
    badgeText: "text-teal-800",
  },
};

function PinManager({
  userId,
  hasPin,
  onSet,
  onRemove,
}: {
  userId: number;
  hasPin: boolean;
  onSet: (id: number, pin: string) => void;
  onRemove: (id: number) => void;
}) {
  const [mode, setMode] = useState<"idle" | "set" | "remove">("idle");
  const [pin, setPin] = useState(["", "", "", ""]);
  const [show, setShow] = useState(false);
  const refs = [
    useState<HTMLInputElement | null>(null),
    useState<HTMLInputElement | null>(null),
    useState<HTMLInputElement | null>(null),
    useState<HTMLInputElement | null>(null),
  ];

  const handleDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, "").slice(-1);
    const next = [...pin];
    next[i] = d;
    setPin(next);
    if (d && i < 3) {
      const nextInput = document.querySelector<HTMLInputElement>(`[data-pin-uid="${userId}-${i + 1}"]`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[i] && i > 0) {
      const prevInput = document.querySelector<HTMLInputElement>(`[data-pin-uid="${userId}-${i - 1}"]`);
      prevInput?.focus();
    }
  };

  const submitPin = () => {
    const code = pin.join("");
    if (code.length === 4) {
      onSet(userId, code);
      setPin(["", "", "", ""]);
      setMode("idle");
    }
  };

  if (mode === "set") {
    return (
      <div className="space-y-2 pt-1">
        <p className="text-xs text-muted-foreground">{hasPin ? "הזן PIN חדש (4 ספרות):" : "הגדר PIN חדש (4 ספרות):"}</p>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            {pin.map((d, i) => (
              <input
                key={i}
                data-pin-uid={`${userId}-${i}`}
                type={show ? "text" : "password"}
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => handleDigit(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                className="w-9 h-9 text-center text-lg font-bold border-2 rounded-lg focus:border-primary focus:outline-none bg-background"
              />
            ))}
          </div>
          <button onClick={() => setShow(!show)} className="text-muted-foreground hover:text-foreground p-1">
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="h-7 text-xs" onClick={submitPin} disabled={pin.join("").length !== 4}>
            <Check className="w-3 h-3 ml-1" /> שמור PIN
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setMode("idle"); setPin(["", "", "", ""]); }}>
            <X className="w-3 h-3 ml-1" /> ביטול
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "remove") {
    return (
      <div className="space-y-2 pt-1">
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          ה-PIN יוסר — כניסה ללא אימות
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => { onRemove(userId); setMode("idle"); }}>
            <Trash2 className="w-3 h-3 ml-1" /> הסר PIN
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setMode("idle")}>
            ביטול
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {hasPin ? (
        <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
          <Lock className="w-3 h-3" /> PIN מוגדר
        </span>
      ) : (
        <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          <Unlock className="w-3 h-3" /> ללא PIN
        </span>
      )}
      <button
        onClick={() => setMode("set")}
        className="text-xs text-blue-600 hover:underline">
        {hasPin ? "שנה" : "הגדר"}
      </button>
      {hasPin && (
        <button onClick={() => setMode("remove")} className="text-xs text-red-500 hover:underline">
          הסר
        </button>
      )}
    </div>
  );
}

function InlineUserRow({
  user,
  cfg,
  onSave,
  onPinSet,
  onPinRemove,
  onRemove,
}: {
  user: TribeUser;
  cfg: typeof ROLE_CONFIG[string];
  onSave: (id: number, data: { name: string; battalion?: string | null }) => void;
  onPinSet: (id: number, pin: string) => void;
  onPinRemove: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [battalion, setBattalion] = useState(user.battalion || "");

  const handleSave = () => {
    onSave(user.id, {
      name: name.trim() || user.name,
      battalion: battalion.trim() || null,
    });
    setEditing(false);
  };

  const handleCancel = () => {
    setName(user.name);
    setBattalion(user.battalion || "");
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="rounded-xl border-2 border-primary/20 bg-card p-3 space-y-3 shadow-sm">
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSave()}
            placeholder="שם מלא"
            className="flex-1 h-8 text-sm"
            autoFocus
          />
          {user.role === "roshgad" && (
            <Input
              value={battalion}
              onChange={e => setBattalion(e.target.value)}
              placeholder="גדוד"
              className="w-24 h-8 text-sm"
            />
          )}
        </div>
        <PinManager
          userId={user.id}
          hasPin={user.hasPin}
          onSet={onPinSet}
          onRemove={onPinRemove}
        />
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
            <Check className="w-3 h-3 ml-1" /> שמור
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleCancel}>
            <X className="w-3 h-3 ml-1" /> ביטול
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border bg-card hover:bg-muted/10 transition-colors group">
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-full ${cfg.avatarBg} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
          {user.name.charAt(0)}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{user.name}</span>
            {user.battalion && (
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                גדוד: {user.battalion}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {user.hasPin ? (
              <span className="text-xs text-green-600 flex items-center gap-0.5">
                <Lock className="w-2.5 h-2.5" /> PIN מוגדר
              </span>
            ) : (
              <span className="text-xs text-muted-foreground/60 flex items-center gap-0.5">
                <Unlock className="w-2.5 h-2.5" /> ללא PIN
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
        <button
          onClick={() => setEditing(true)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => { if (confirm(`למחוק את ${user.name}?`)) onRemove(user.id); }}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function AddUserInline({
  role,
  cfg,
  onAdd,
}: {
  role: string;
  cfg: typeof ROLE_CONFIG[string];
  onAdd: (data: { name: string; role: string; battalion?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [battalion, setBattalion] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), role, battalion: battalion.trim() || undefined });
    setName(""); setBattalion(""); setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-xl border border-dashed border-muted-foreground/25 text-muted-foreground text-xs hover:border-muted-foreground/50 hover:bg-muted/30 transition-all mt-2">
        <Plus className="w-3.5 h-3.5" /> הוסף {cfg.label}
      </button>
    );
  }

  return (
    <div className="mt-2 p-3 rounded-xl border-2 border-primary/20 bg-muted/20 space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="שם מלא"
          className="flex-1 h-8 text-sm"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
          autoFocus
        />
        {role === "roshgad" && (
          <Input
            placeholder="גדוד"
            className="w-24 h-8 text-sm"
            value={battalion}
            onChange={e => setBattalion(e.target.value)}
          />
        )}
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs" disabled={!name.trim()} onClick={handleSubmit}>
          <Check className="w-3 h-3 ml-1" /> הוסף
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setOpen(false); setName(""); setBattalion(""); }}>
          <X className="w-3 h-3 ml-1" /> ביטול
        </Button>
      </div>
    </div>
  );
}

function RoleCard({
  roleKey,
  users,
  onAdd,
  onSave,
  onPinSet,
  onPinRemove,
  onRemove,
}: {
  roleKey: string;
  users: TribeUser[];
  onAdd: (data: { name: string; role: string; battalion?: string }) => void;
  onSave: (id: number, data: { name: string; battalion?: string | null }) => void;
  onPinSet: (id: number, pin: string) => void;
  onPinRemove: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  const cfg = ROLE_CONFIG[roleKey];
  const Icon = cfg.icon;

  return (
    <div className={`rounded-2xl border-2 overflow-hidden ${cfg.cardBg}`}>
      <div className={`px-4 py-3 ${cfg.headerBg} flex items-center gap-2`}>
        <Icon className={`w-4 h-4 ${cfg.headerText}`} />
        <span className={`font-bold text-sm ${cfg.headerText}`}>{cfg.label}</span>
        {cfg.isAdmin && (
          <span className="mr-auto text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">
            מנהל על
          </span>
        )}
        {!cfg.isAdmin && (
          <span className="mr-auto text-xs text-white/60">{users.length} משתמשים</span>
        )}
      </div>
      <div className="p-3 space-y-1.5">
        {users.length === 0 && (
          <p className="text-xs text-muted-foreground italic text-center py-2">
            אין משתמשים בתפקיד זה
          </p>
        )}
        {users.map(u => (
          <InlineUserRow
            key={u.id}
            user={u}
            cfg={cfg}
            onSave={onSave}
            onPinSet={onPinSet}
            onPinRemove={onPinRemove}
            onRemove={onRemove}
          />
        ))}
        <AddUserInline role={roleKey} cfg={cfg} onAdd={onAdd} />
      </div>
    </div>
  );
}

export function Admin() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  const { data: permissions = [], isLoading: permLoading } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => fetch(`${API_BASE}/api/permissions`).then(r => r.json()),
  });

  const updatePerm = useMutation({
    mutationFn: (data: { role: string; section: string; feature?: string | null; canAccess: boolean }) =>
      fetch(`${API_BASE}/api/permissions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["permissions"] }); toast({ title: "הרשאה עודכנה" }); },
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<TribeUser[]>({
    queryKey: ["tribe-users"],
    queryFn: () => fetch(`${API_BASE}/api/users`).then(r => r.json()),
    enabled: role === "marcaz_boger",
  });

  const addUser = useMutation({
    mutationFn: (data: { name: string; role: string; battalion?: string }) =>
      fetch(`${API_BASE}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: (u: TribeUser) => {
      qc.invalidateQueries({ queryKey: ["tribe-users"] });
      toast({ title: `"${u.name}" נוסף למערכת` });
    },
    onError: () => toast({ title: "שגיאה ביצירת משתמש", variant: "destructive" }),
  });

  const editUser = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string; battalion?: string | null } }) =>
      fetch(`${API_BASE}/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tribe-users"] }); toast({ title: "משתמש עודכן" }); },
    onError: () => toast({ title: "שגיאה בעדכון משתמש", variant: "destructive" }),
  });

  const adminPinReset = useMutation({
    mutationFn: ({ id, pin }: { id: number; pin: string | null }) =>
      fetch(`${API_BASE}/api/users/${id}/pin/admin-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-role": "marcaz_boger" },
        body: JSON.stringify({ pin }),
      }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tribe-users"] }); toast({ title: "PIN עודכן" }); },
    onError: () => toast({ title: "שגיאה בעדכון PIN", variant: "destructive" }),
  });

  const removeUser = useMutation({
    mutationFn: (id: number) => fetch(`${API_BASE}/api/users/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tribe-users"] }); toast({ title: "משתמש הוסר" }); },
  });

  // Excel import for users
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importRows, setImportRows] = useState<{ name: string; role: string; battalion: string }[] | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ added: number; skipped: number } | null>(null);

  const ROLE_IMPORT_MAP: Record<string, string> = {
    "מרכז צעיר": "marcaz_tzair", "מרכז בוגר": "marcaz_boger",
    "ראשצ": "roshatz", "ראשגד": "roshgad", "מדריך": "madrich", "פעיל": "pael",
    "marcaz_tzair": "marcaz_tzair", "marcaz_boger": "marcaz_boger",
    "roshatz": "roshatz", "roshgad": "roshgad", "madrich": "madrich", "pael": "pael",
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const wb = XLSX.read(ev.target?.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const rows = data.map(row => {
        const name = (row["שם"] || row["name"] || "").toString().trim();
        const rawRole = (row["תפקיד"] || row["role"] || "").toString().trim();
        const role = ROLE_IMPORT_MAP[rawRole] || rawRole;
        const battalion = (row["גדוד"] || row["battalion"] || "").toString().trim();
        return { name, role, battalion };
      }).filter(r => r.name && r.role);
      setImportRows(rows);
      setImportResult(null);
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const handleImportSubmit = async () => {
    if (!importRows) return;
    setImportLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/import-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: importRows }),
      });
      const data = await res.json();
      setImportResult(data);
      setImportRows(null);
      qc.invalidateQueries({ queryKey: ["tribe-users"] });
      toast({ title: `ייבוא הושלם — ${data.added} נוספו` });
    } catch {
      toast({ title: "שגיאה בייבוא", variant: "destructive" });
    } finally {
      setImportLoading(false);
    }
  };

  // Assignments import (comprehensive — creates+updates users by role)
  const assignFileRef = useRef<HTMLInputElement>(null);
  const [assignRows, setAssignRows] = useState<{ name: string; lastName?: string; role: string; battalion: string }[] | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignResult, setAssignResult] = useState<{ created: number; updated: number; skipped: number } | null>(null);

  const handleAssignFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const wb = XLSX.read(ev.target?.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const rows = data.map(row => {
        const name = (row["שם פרטי"] || row["שם"] || row["name"] || "").toString().trim();
        const lastName = (row["שם משפחה"] || row["lastName"] || "").toString().trim();
        const rawRole = (row["תפקיד"] || row["role"] || "").toString().trim();
        const role = ROLE_IMPORT_MAP[rawRole] || rawRole;
        const battalion = (row["גדוד"] || row["battalion"] || "").toString().trim();
        return { name, lastName, role, battalion };
      }).filter(r => r.name && r.role);
      setAssignRows(rows);
      setAssignResult(null);
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const handleAssignSubmit = async () => {
    if (!assignRows) return;
    setAssignLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/import-assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: assignRows }),
      });
      const data = await res.json();
      setAssignResult(data);
      setAssignRows(null);
      qc.invalidateQueries({ queryKey: ["tribe-users"] });
      toast({ title: `שיבוץ הושלם — ${data.created} נוצרו, ${data.updated} עודכנו` });
    } catch {
      toast({ title: "שגיאה בייבוא שיבוצים", variant: "destructive" });
    } finally {
      setAssignLoading(false);
    }
  };

  const [syncResult, setSyncResult] = useState<{ created: number; updated: number; skipped: number; total: number } | null>(null);
  const syncPaelim = useMutation({
    mutationFn: () =>
      fetch(`${API_BASE}/api/users/sync-paelim`, {
        method: "POST",
        headers: { "x-user-role": "marcaz_boger" },
      }).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["tribe-users"] });
      setSyncResult(data);
      toast({ title: `סנכרון הושלם — ${data.created} נוצרו, ${data.updated} עודכנו` });
    },
    onError: () => toast({ title: "שגיאה בסנכרון", variant: "destructive" }),
  });

  if (role !== "marcaz_boger") {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <ShieldAlert className="w-16 h-16 text-destructive opacity-80" />
        <h2 className="text-2xl font-bold">אין גישה</h2>
        <p className="text-muted-foreground">עמוד זה מיועד למרכז בוגר בלבד.</p>
      </div>
    );
  }

  const getPerm = (r: string, section: string, feature?: string | null) =>
    (permissions as any[]).find((p: any) => p.role === r && p.section === section && (feature ? p.feature === feature : p.feature === null))?.canAccess ?? true;

  const handleToggle = (r: string, section: string, feature: string | null, current: boolean) =>
    updatePerm.mutate({ role: r, section, feature, canAccess: !current });

  const usersArr = users as TribeUser[];
  const byRole = (r: string) => usersArr.filter(u => u.role === r);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">ניהול מערכת</h2>
        <p className="text-muted-foreground">משתמשים, הרשאות גישה והגדרות</p>
      </div>

      {/* Info notice */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-blue-200 bg-blue-50/50 text-sm text-blue-800">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-600" />
        <div>
          <span className="font-semibold">משתמשי מערכת — עצמאיים ממאגר החניכים.</span>
          <span className="text-blue-700 mr-1">
            הוספת משתמש כאן לא מוסיפה אותו למאגר החניכים, ולהיפך.
            מרכז בוגר הוא מנהל על עם גישה מלאה.
          </span>
        </div>
      </div>

      {/* Sync paelim from scouts */}
      <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-teal-600" />
          <h3 className="font-semibold text-teal-900">סנכרון פעילים ומדריכים ממאגר החניכים</h3>
        </div>
        <p className="text-sm text-teal-800">
          כל חניך/ה בשכבות י–יב במאגר החניכים יקבל חשבון כניסה למערכת אוטומטית.
          פעיל שתפקידו במאגר הוא "מדריך" ייכנס עם תפקיד מדריך, שאר הפעילים ייכנסו כ"פעיל".
          ניתן להפעיל סנכרון חוזר בכל שינוי במאגר.
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          <Button
            onClick={() => { setSyncResult(null); syncPaelim.mutate(); }}
            disabled={syncPaelim.isPending}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            {syncPaelim.isPending
              ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />מסנכרן...</>
              : <><RefreshCw className="w-4 h-4 ml-2" />סנכרן עכשיו</>}
          </Button>
          {syncResult && (
            <div className="text-sm text-teal-900 font-medium flex gap-4">
              <span>✓ נוצרו: <strong>{syncResult.created}</strong></span>
              <span>↻ עודכנו: <strong>{syncResult.updated}</strong></span>
              <span>= דילוגים: <strong>{syncResult.skipped}</strong></span>
              <span className="text-teal-600">סה"כ: {syncResult.total}</span>
            </div>
          )}
        </div>
      </div>

      {/* Excel import for users */}
      <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-violet-600" />
          <h3 className="font-semibold text-violet-900">ייבוא משתמשים מקובץ אקסל</h3>
        </div>
        <p className="text-sm text-violet-800">
          העלה קובץ Excel עם עמודות: <strong>שם</strong>, <strong>תפקיד</strong>, <strong>גדוד</strong> (אופציונלי).
          ערכי תפקיד מקובלים: מרכז צעיר, ראשצ, ראשגד, מדריך, פעיל.
          משתמשים קיימים (לפי שם) ידולגו.
        </p>
        <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={() => importFileRef.current?.click()}
            variant="outline"
            className="border-violet-300 text-violet-700 hover:bg-violet-50"
          >
            <Upload className="w-4 h-4 ml-2" /> בחר קובץ
          </Button>
          {importResult && (
            <div className="text-sm text-violet-900 font-medium flex gap-4">
              <span>✓ נוספו: <strong>{importResult.added}</strong></span>
              <span>= דילוגים: <strong>{importResult.skipped}</strong></span>
            </div>
          )}
        </div>

        {importRows && importRows.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-violet-800">{importRows.length} שורות נמצאו — תצוגה מקדימה:</p>
            <div className="rounded-xl border border-violet-200 overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-violet-100">
                  <tr>
                    <th className="px-3 py-1.5 text-right font-semibold text-violet-900">שם</th>
                    <th className="px-3 py-1.5 text-right font-semibold text-violet-900">תפקיד</th>
                    <th className="px-3 py-1.5 text-right font-semibold text-violet-900">גדוד</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-violet-100 bg-white">
                  {importRows.slice(0, 10).map((row, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5">{row.name}</td>
                      <td className="px-3 py-1.5">{ROLE_NAMES[row.role as keyof typeof ROLE_NAMES] || row.role}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{row.battalion || "—"}</td>
                    </tr>
                  ))}
                  {importRows.length > 10 && (
                    <tr><td colSpan={3} className="px-3 py-1.5 text-center text-violet-500">...ועוד {importRows.length - 10}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleImportSubmit}
                disabled={importLoading}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                {importLoading
                  ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />מייבא...</>
                  : <><Check className="w-4 h-4 ml-2" />ייבא {importRows.length} משתמשים</>}
              </Button>
              <Button variant="ghost" onClick={() => setImportRows(null)}>ביטול</Button>
            </div>
          </div>
        )}
      </div>

      {/* Assignments Excel Import */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          <h3 className="font-semibold text-emerald-900">ייבוא שיבוצים מאקסל</h3>
        </div>
        <p className="text-sm text-emerald-800">
          העלה קובץ Excel עם עמודות: <strong>שם פרטי</strong>, <strong>שם משפחה</strong> (אופציונלי), <strong>תפקיד</strong>, <strong>גדוד</strong>.
          <br />תפקידים: מרכז צעיר, ראשצ, ראשגד, מדריך, פעיל.
          <br /><span className="font-semibold">בניגוד לייבוא רגיל — מעדכן גם משתמשים קיימים (תפקיד + גדוד) ומסנכרן עם מאגר החניכים.</span>
        </p>
        <input ref={assignFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleAssignFile} />
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={() => assignFileRef.current?.click()}
            variant="outline"
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          >
            <Upload className="w-4 h-4 ml-2" /> בחר קובץ שיבוצים
          </Button>
          {assignResult && (
            <div className="text-sm text-emerald-900 font-medium flex gap-4">
              <span>✓ נוצרו: <strong>{assignResult.created}</strong></span>
              <span>↻ עודכנו: <strong>{assignResult.updated}</strong></span>
              <span>= דילוגים: <strong>{assignResult.skipped}</strong></span>
            </div>
          )}
        </div>

        {assignRows && assignRows.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-emerald-800">{assignRows.length} שורות נמצאו — תצוגה מקדימה:</p>
            <div className="rounded-xl border border-emerald-200 overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-emerald-100">
                  <tr>
                    <th className="px-3 py-1.5 text-right font-semibold text-emerald-900">שם</th>
                    <th className="px-3 py-1.5 text-right font-semibold text-emerald-900">תפקיד</th>
                    <th className="px-3 py-1.5 text-right font-semibold text-emerald-900">גדוד</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50 bg-white">
                  {assignRows.slice(0, 10).map((row, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5">{row.name}{row.lastName ? ` ${row.lastName}` : ""}</td>
                      <td className="px-3 py-1.5">{ROLE_NAMES[row.role as keyof typeof ROLE_NAMES] || row.role}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{row.battalion || "—"}</td>
                    </tr>
                  ))}
                  {assignRows.length > 10 && (
                    <tr><td colSpan={3} className="px-3 py-1.5 text-center text-emerald-500">...ועוד {assignRows.length - 10}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleAssignSubmit}
                disabled={assignLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {assignLoading
                  ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />מייבא...</>
                  : <><Check className="w-4 h-4 ml-2" />שבץ {assignRows.length} אנשים</>}
              </Button>
              <Button variant="ghost" onClick={() => setAssignRows(null)}>ביטול</Button>
            </div>
          </div>
        )}
      </div>

      {/* User management */}
      <div className="space-y-3">
        <h3 className="font-semibold text-lg">משתמשי כניסה</h3>
        {usersLoading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {["marcaz_boger", "marcaz_tzair", "roshatz", "roshgad", "madrich", "pael"].map(rk => (
              <RoleCard
                key={rk}
                roleKey={rk}
                users={byRole(rk)}
                onAdd={data => addUser.mutate(data)}
                onSave={(id, data) => editUser.mutate({ id, data })}
                onPinSet={(id, pin) => adminPinReset.mutate({ id, pin })}
                onPinRemove={id => adminPinReset.mutate({ id, pin: null })}
                onRemove={id => removeUser.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Permissions */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Shield className="w-5 h-5 text-primary" />
            הרשאות גישה
          </CardTitle>
          <CardDescription>
            שלוט מה כל תפקיד רואה — ברמת מדור ובתוך כל מדור בנפרד.
            למרכז בוגר יש גישה מלאה תמיד.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* מרכז בוגר — always full access */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 flex items-center gap-3">
            <Crown className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <p className="font-semibold text-sm text-blue-800">מרכז בוגר</p>
              <p className="text-xs text-blue-600">גישה מלאה לכל מדורי המערכת — לא ניתן להגביל</p>
            </div>
            <div className="mr-auto flex gap-1">
              {SECTIONS.map(s => (
                <span key={s.id} className="text-xs bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">{s.label}</span>
              ))}
            </div>
          </div>

          {permLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)
          ) : ROLE_KEYS.map(rk => {
            const cfg = ROLE_CONFIG[rk];
            const Icon = cfg.icon;
            return (
              <div key={rk} className="border rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-4 bg-muted/20 hover:bg-muted/40 transition-colors text-right"
                  onClick={() => setExpandedRole(expandedRole === rk ? null : rk)}
                >
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expandedRole === rk ? "rotate-180" : ""}`} />
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${cfg.badgeText.replace("text-", "text-")}`} />
                    <p className="font-semibold">{ROLE_NAMES[rk] || rk}</p>
                  </div>
                </button>

                {expandedRole === rk && (
                  <div className="p-4 space-y-4 border-t">
                    {SECTIONS.map(sec => {
                      const sectionOn = getPerm(rk, sec.id, null);
                      return (
                        <div key={sec.id} className="space-y-2">
                          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                            <div>
                              <p className="font-medium text-sm">{sec.label}</p>
                              <p className="text-xs text-muted-foreground">{sec.desc}</p>
                            </div>
                            <Switch checked={sectionOn} onCheckedChange={() => handleToggle(rk, sec.id, null, sectionOn)} disabled={updatePerm.isPending} />
                          </div>
                          {sectionOn && (
                            <div className="mr-3 space-y-1.5 border-r border-muted pr-3">
                              {sec.features.map(feat => {
                                const featOn = getPerm(rk, sec.id, feat.id);
                                return (
                                  <div key={feat.id} className="flex items-center justify-between px-3 py-2 rounded-md bg-background border hover:bg-muted/10 transition-colors">
                                    <span className="text-sm">{feat.label}</span>
                                    <Switch checked={featOn} onCheckedChange={() => handleToggle(rk, sec.id, feat.id, featOn)} disabled={updatePerm.isPending} />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
