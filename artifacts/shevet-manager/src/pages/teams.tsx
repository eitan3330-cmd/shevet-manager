import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Search, Users, ChevronDown, ChevronUp, Phone, UserCheck, BookOpen, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const GRADE_ORDER = ["ד", "ה", "ו", "ז", "ח", "ט", "י", "יא", "יב"];

const GRADE_LEVEL: Record<string, string> = {
  "ד": "חניכים", "ה": "חניכים", "ו": "חניכים",
  "ז": "חניכים בכירים", "ח": "חניכים בכירים",
  "ט": "שכבה ט",
  "י": "פעילים", "יא": "פעילים", "יב": "פעילים",
};

const LEVEL_COLOR: Record<string, string> = {
  "פעילים": "bg-blue-100 text-blue-700 border-blue-200",
  "שכבה ט": "bg-violet-100 text-violet-700 border-violet-200",
  "חניכים בכירים": "bg-amber-100 text-amber-700 border-amber-200",
  "חניכים": "bg-emerald-100 text-emerald-700 border-emerald-200",
};

type FilterType = "all" | "pailim" | "chanichim" | "madrichim";

interface Scout {
  id: number;
  name: string;
  lastName: string | null;
  grade: string | null;
  gizra: string;
  battalion: string | null;
  phone: string | null;
  parentPhone: string | null;
  instructorName: string | null;
  medicalIssues: string | null;
  role: string;
}

interface DbUser {
  id: number;
  name: string;
  role: string;
  battalion: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  marcaz_boger: "מרכז בוגר",
  marcaz_tzair: "מרכז צעיר",
  roshatz: "ראשצ",
  roshgad: "ראשגד",
};

function ScoutRow({ scout }: { scout: Scout }) {
  const [open, setOpen] = useState(false);
  const level = scout.grade ? (GRADE_LEVEL[scout.grade] || scout.grade) : null;
  const fullName = [scout.name, scout.lastName].filter(Boolean).join(" ");

  return (
    <div className="border-b border-border/40 last:border-0">
      <button
        className="w-full text-right flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
          {scout.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{fullName}</span>
            {level && (
              <span className={`text-xs px-1.5 py-0.5 rounded-md border font-medium ${LEVEL_COLOR[level] || "bg-muted text-muted-foreground border-border"}`}>
                {level}{scout.grade ? ` · כיתה ${scout.grade}` : ""}
              </span>
            )}
            {scout.medicalIssues && (
              <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
            )}
          </div>
          {scout.battalion && (
            <p className="text-xs text-muted-foreground mt-0.5">{scout.battalion}</p>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-3 pt-1 bg-muted/20 space-y-1.5 text-sm">
          {scout.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-3.5 h-3.5" />
              <span>טל׳ חניך: <a href={`tel:${scout.phone}`} className="text-primary hover:underline">{scout.phone}</a></span>
            </div>
          )}
          {scout.parentPhone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-3.5 h-3.5" />
              <span>טל׳ הורה: <a href={`tel:${scout.parentPhone}`} className="text-primary hover:underline">{scout.parentPhone}</a></span>
            </div>
          )}
          {scout.instructorName && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <UserCheck className="w-3.5 h-3.5" />
              <span>מדריך/ה: {scout.instructorName}</span>
            </div>
          )}
          {scout.medicalIssues && (
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>הערות רפואיות: {scout.medicalIssues}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GizraCard({ gizra, scouts }: { gizra: string; scouts: Scout[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const pailim = scouts.filter(s => ["י", "יא", "יב"].includes(s.grade || "")).length;
  const tet = scouts.filter(s => s.grade === "ט").length;
  const bkiim = scouts.filter(s => ["ז", "ח"].includes(s.grade || "")).length;
  const chanichim = scouts.filter(s => ["ד", "ה", "ו"].includes(s.grade || "")).length;
  const noGrade = scouts.filter(s => !s.grade).length;

  const sorted = [...scouts].sort((a, b) => {
    const ai = GRADE_ORDER.indexOf(a.grade || "");
    const bi = GRADE_ORDER.indexOf(b.grade || "");
    if (ai !== bi) return bi - ai;
    const fa = [a.name, a.lastName].filter(Boolean).join(" ");
    const fb = [b.name, b.lastName].filter(Boolean).join(" ");
    return fa.localeCompare(fb, "he");
  });

  return (
    <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
      <button
        className="w-full text-right flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="w-10 h-10 rounded-xl bg-[#00327d] flex items-center justify-center text-white font-black text-base shrink-0"
          style={{ fontFamily: "Manrope, sans-serif" }}>
          {gizra.charAt(0)}
        </div>
        <div className="flex-1 min-w-0 text-right">
          <h3 className="font-bold text-base leading-tight">{gizra}</h3>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-muted-foreground">{scouts.length} חברי קבוצה</span>
            {pailim > 0 && <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 border-0 px-1.5 py-0 h-5">{pailim} פעילים</Badge>}
            {tet > 0 && <Badge variant="secondary" className="text-xs bg-violet-100 text-violet-700 border-0 px-1.5 py-0 h-5">{tet} ט׳</Badge>}
            {bkiim > 0 && <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 border-0 px-1.5 py-0 h-5">{bkiim} בכירים</Badge>}
            {chanichim > 0 && <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700 border-0 px-1.5 py-0 h-5">{chanichim} חניכים</Badge>}
            {noGrade > 0 && <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">{noGrade} ללא כיתה</Badge>}
          </div>
        </div>
        {collapsed
          ? <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
          : <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />}
      </button>

      {!collapsed && (
        <div className="border-t border-border/40">
          {sorted.map(s => <ScoutRow key={s.id} scout={s} />)}
        </div>
      )}
    </div>
  );
}

export function Teams() {
  const { role } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const { data: scouts = [], isLoading: loadingScouts } = useQuery<Scout[]>({
    queryKey: ["scouts-teams"],
    queryFn: () => fetch(`${API_BASE}/api/scouts`).then(r => r.json()),
  });

  const { data: users = [] } = useQuery<DbUser[]>({
    queryKey: ["tribe-users-teams"],
    queryFn: () => fetch(`${API_BASE}/api/users`).then(r => r.json()),
    enabled: filter === "madrichim" || filter === "all",
  });

  const filteredScouts = useMemo(() => {
    let arr = scouts;

    if (filter === "pailim") {
      arr = arr.filter(s => ["י", "יא", "יב"].includes(s.grade || ""));
    } else if (filter === "chanichim") {
      arr = arr.filter(s => ["ד", "ה", "ו", "ז", "ח", "ט"].includes(s.grade || ""));
    } else if (filter === "madrichim") {
      arr = [];
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter(s => {
        const full = [s.name, s.lastName].filter(Boolean).join(" ").toLowerCase();
        return full.includes(q) || s.gizra?.toLowerCase().includes(q) || s.battalion?.toLowerCase().includes(q);
      });
    }

    return arr;
  }, [scouts, filter, search]);

  const filteredUsers = useMemo(() => {
    if (filter !== "madrichim" && filter !== "all") return [];
    let arr = users;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter(u => u.name.toLowerCase().includes(q) || (ROLE_LABEL[u.role] || u.role).toLowerCase().includes(q));
    }
    return arr;
  }, [users, filter, search]);

  const gizrot = useMemo(() => {
    const map: Record<string, Scout[]> = {};
    filteredScouts.forEach(s => {
      const g = s.gizra || "ללא קבוצה";
      if (!map[g]) map[g] = [];
      map[g].push(s);
    });
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [filteredScouts]);

  const totalPailim = scouts.filter(s => ["י", "יא", "יב"].includes(s.grade || "")).length;
  const totalChanichim = scouts.filter(s => ["ד", "ה", "ו", "ז", "ח", "ט"].includes(s.grade || "")).length;
  const totalGizrot = [...new Set(scouts.map(s => s.gizra).filter(Boolean))].length;

  const FILTERS: { key: FilterType; label: string; count: number }[] = [
    { key: "all", label: "הכל", count: scouts.length },
    { key: "pailim", label: "פעילים", count: totalPailim },
    { key: "chanichim", label: "חניכים", count: totalChanichim },
    { key: "madrichim", label: "מדריכים", count: users.length },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-300" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">קבוצות וצוותים</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {totalGizrot} קבוצות · {totalPailim} פעילים · {totalChanichim} חניכים · {users.length} מדריכים
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="חיפוש לפי שם, קבוצה או גדוד..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pr-10 text-right rounded-xl"
          autoComplete="off"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              filter === f.key
                ? "bg-[#00327d] text-white border-[#00327d] shadow-sm"
                : "bg-card text-muted-foreground border-border hover:bg-muted/50"
            }`}
          >
            {f.label}
            <span className={`mr-1.5 text-xs ${filter === f.key ? "text-white/70" : "text-muted-foreground/60"}`}>
              ({f.count})
            </span>
          </button>
        ))}
      </div>

      {loadingScouts ? (
        <div className="text-center py-16 text-muted-foreground">טוען נתונים...</div>
      ) : (
        <>
          {/* Scouts by gizra */}
          {filter !== "madrichim" && (
            <>
              {gizrot.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>{search ? "לא נמצאו תוצאות לחיפוש" : "אין נתונים"}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {gizrot.map(([g, s]) => <GizraCard key={g} gizra={g} scouts={s} />)}
                </div>
              )}
            </>
          )}

          {/* Instructors view */}
          {(filter === "madrichim" || (filter === "all" && filteredUsers.length > 0)) && (
            <div className="space-y-2">
              <h2 className="font-bold text-base pt-2 border-t border-border/50">
                מדריכות ומדריכים
              </h2>
              {filteredUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {search ? "לא נמצאו מדריכים לחיפוש" : "אין מדריכים רשומים"}
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {filteredUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl border bg-card">
                      <div className="w-9 h-9 rounded-lg bg-[#00327d] flex items-center justify-center text-white font-black text-sm shrink-0"
                        style={{ fontFamily: "Manrope, sans-serif" }}>
                        {u.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{u.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {ROLE_LABEL[u.role] || u.role}
                          {u.battalion ? ` · ${u.battalion}` : ""}
                        </p>
                      </div>
                      <BookOpen className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
