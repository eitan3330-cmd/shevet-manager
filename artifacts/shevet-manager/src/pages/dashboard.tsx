import { useAuth, ROLE_NAMES } from "@/hooks/use-auth";
import { useListPermissions } from "@/lib/api-hooks";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import {
  Users, CalendarCheck, CalendarRange, Wallet, ShoppingCart,
  ShieldCheck, Archive, ChevronLeft, Activity, AlertCircle,
  CalendarDays, ClipboardList, GitBranch, FileText, Plus, TrendingUp,
  BookOpen,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const GRADE_LEVEL_MAP: Record<string, string> = {
  "ד": "חניכים", "ה": "חניכים", "ו": "חניכים",
  "ז": "חניכים בכירים", "ח": "חניכים בכירים",
  "ט": "שכבה ט",
  "י": "פעילים", "יא": "פעילים", "יב": "פעילים",
};

interface Tile {
  num: string;
  href: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  variant: "gradient" | "tinted" | "navy";
  gradient?: string;
  tint?: string;
  iconColor?: string;
  show: boolean;
  span?: boolean;
}

export function Dashboard() {
  const { user, role } = useAuth();
  const [, setLocation] = useLocation();
  const { data: permissions = [] } = useListPermissions({ query: { enabled: !!role } });

  const canHadracha = role === "marcaz_boger" || permissions.some(p => p.role === role && p.section === "hadracha" && p.canAccess);
  const canLogistics = role === "marcaz_boger" || permissions.some(p => p.role === role && p.section === "logistics" && p.canAccess);
  const isAdmin = role === "marcaz_boger";

  const { data: scouts = [] } = useQuery({
    queryKey: ["scouts-raw"],
    queryFn: () => fetch(`${API_BASE}/api/scouts`).then(r => r.json()),
    enabled: canHadracha,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => fetch(`${API_BASE}/api/events`).then(r => r.json()),
    enabled: canLogistics,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["global-tasks"],
    queryFn: () => fetch(`${API_BASE}/api/global-tasks`).then(r => r.json()),
  });

  const { data: annualBudget = null } = useQuery({
    queryKey: ["annual-budget"],
    queryFn: () => fetch(`${API_BASE}/api/annual-budget`).then(r => r.json()),
    enabled: isAdmin,
  });

  const displayName = user?.name || (role ? ROLE_NAMES[role] : "");

  const scoutArr = scouts as any[];
  const eventArr = events as any[];
  const taskArr = tasks as any[];

  const totalScouts = scoutArr.length;
  const upcomingEvents = eventArr.filter(e => e.status === "upcoming" || e.status === "active").length;
  const myOpenTasks = taskArr.filter(t => t.assigneeName === user?.name && t.status !== "done").length;
  const withMedical = scoutArr.filter(s => s.medicalIssues).length;

  const gizrot = [...new Set(scoutArr.map(s => s.gizra).filter(Boolean))];
  const totalBudget = annualBudget ? parseFloat(String((annualBudget as any).totalBudget || 0)) : 0;

  const gradeGroups: Record<string, number> = {};
  scoutArr.forEach(s => {
    const level = GRADE_LEVEL_MAP[s.grade] || "אחר";
    gradeGroups[level] = (gradeGroups[level] || 0) + 1;
  });

  const tiles: Tile[] = [
    {
      num: "01", href: "/tasks", title: "משימות", icon: ClipboardList,
      subtitle: myOpenTasks > 0 ? `${myOpenTasks} משימות פתוחות שלי` : "אין משימות פתוחות",
      variant: "gradient", gradient: "from-emerald-500 to-emerald-700",
      show: true,
    },
    {
      num: "02", href: "/schedule", title: "לוז מפעלים", icon: CalendarDays,
      subtitle: "לוח זמנים שבטי ומפגשים",
      variant: "gradient", gradient: "from-sky-500 to-blue-600",
      show: true,
    },
    {
      num: "03", href: "/logistics/events", title: "מפעלים", icon: CalendarRange,
      subtitle: `תכנון ומעקב · ${upcomingEvents} קרובים`,
      variant: "navy",
      show: canLogistics, span: true,
    },
    {
      num: "04", href: "/hadracha/attendance", title: "נוכחות", icon: CalendarCheck,
      subtitle: "רישום ומעקב נוכחות",
      variant: "gradient", gradient: "from-rose-500 to-rose-700",
      show: canHadracha,
    },
    {
      num: "05", href: "/hadracha/scouts", title: "מאגר חניכים", icon: Users,
      subtitle: totalScouts > 0 ? `${totalScouts} חניכים · ${gizrot.length} קבוצות` : "ניהול חניכות ומדריכים",
      variant: "tinted", tint: "violet", iconColor: "bg-violet-500",
      show: canHadracha,
    },
    {
      num: "06", href: "/hadracha/activities", title: "מערכי הדרכה", icon: FileText,
      subtitle: "הגשת פעולות ואישורים",
      variant: "tinted", tint: "amber", iconColor: "bg-amber-500",
      show: canHadracha,
    },
    {
      num: "07", href: "/logistics/budget", title: "תקציב ופיננסים", icon: Wallet,
      subtitle: totalBudget > 0 ? `תקציב שנתי: ₪${totalBudget.toLocaleString("he-IL")}` : "ניהול תקציב והוצאות",
      variant: "tinted", tint: "teal", iconColor: "bg-teal-500",
      show: canLogistics,
    },
    {
      num: "08", href: "/logistics/procurement", title: "רכש וציוד", icon: ShoppingCart,
      subtitle: "רכישות, ספקים וציוד",
      variant: "tinted", tint: "orange", iconColor: "bg-orange-500",
      show: canLogistics,
    },
    {
      num: "09", href: "/teams", title: "קבוצות וצוותים", icon: Users,
      subtitle: gizrot.length > 0 ? `${gizrot.length} קבוצות פעילות` : "חיפוש וניהול לפי צוות",
      variant: "tinted", tint: "cyan", iconColor: "bg-cyan-500",
      show: canHadracha,
    },
    {
      num: "10", href: "/years", title: "ארכיון", icon: Archive,
      subtitle: "שמירת ידע וסגירת שנה",
      variant: "tinted", tint: "slate", iconColor: "bg-slate-500",
      show: isAdmin,
    },
    {
      num: "11", href: "/staffing", title: "עץ שיבוצים", icon: GitBranch,
      subtitle: "ניהול שיבוצים וצוותים",
      variant: "tinted", tint: "indigo", iconColor: "bg-indigo-500",
      show: isAdmin,
    },
    {
      num: "12", href: "/admin", title: "ניהול משתמשים", icon: ShieldCheck,
      subtitle: "ניהול גישות, הרשאות ו-PIN",
      variant: "tinted", tint: "pink", iconColor: "bg-pink-500",
      show: isAdmin,
    },
  ];

  const visible = tiles.filter(t => t.show);

  return (
    <div className="space-y-8 py-2 animate-in fade-in duration-300" dir="rtl">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#00327d] via-[#003d99] to-[#001a4d] p-7 md:p-10 shadow-xl">
        {/* decorative circles */}
        <div className="absolute -top-10 -left-10 w-56 h-56 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute top-4 left-16 w-28 h-28 rounded-full bg-white/4 pointer-events-none" />
        <div className="absolute -bottom-8 left-32 w-40 h-40 rounded-full bg-blue-400/10 pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-6 rounded-full bg-white/90" />
                <div className="w-2.5 h-6 rounded-full bg-red-400" />
              </div>
              <span className="text-white/70 text-sm font-medium tracking-wide">מרכז שליטה שבטי</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-white leading-none tracking-tight" style={{ fontFamily: "Manrope, Assistant, sans-serif" }}>
              ניהול<br />
              <span className="text-blue-200">השבט</span>
            </h1>
            {displayName && (
              <p className="text-white/60 text-sm mt-3">
                מחובר כ: <span className="font-bold text-white/90">{displayName}</span>
              </p>
            )}
          </div>

          {/* Pulse stats */}
          {totalScouts > 0 && (
            <div className="flex flex-wrap gap-6 md:gap-8 shrink-0">
              {totalScouts > 0 && <StatPulse value={totalScouts} label="חניכים" />}
              {upcomingEvents > 0 && <StatPulse value={upcomingEvents} label="מפעלים" accent="text-green-300" />}
              {gizrot.length > 0 && <StatPulse value={gizrot.length} label="קבוצות" accent="text-blue-300" />}
              {withMedical > 0 && <StatPulse value={withMedical} label="רפואי" accent="text-red-300" />}
              {myOpenTasks > 0 && <StatPulse value={myOpenTasks} label="משימות" accent="text-amber-300" />}
            </div>
          )}
        </div>
      </div>

      {/* Tiles grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {visible.map(tile => (
          <TileCard key={tile.href} tile={tile} onClick={() => setLocation(tile.href)} />
        ))}

        <div className="rounded-2xl border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-2 p-5 min-h-[140px] text-muted-foreground/50 cursor-default select-none hover:border-border transition-colors">
          <Plus className="w-6 h-6" />
          <span className="text-xs font-medium text-center">מודולים נוספים בקרוב</span>
        </div>
      </div>

      {/* Teams quick preview */}
      {canHadracha && gizrot.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-base text-foreground">קבוצות</h2>
            <Link href="/teams" className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
              לכל הקבוצות
              <ChevronLeft className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {gizrot.slice(0, 8).map(g => {
              const gScouts = scoutArr.filter(s => s.gizra === g);
              const pailim = gScouts.filter(s => ["י", "יא", "יב"].includes(s.grade)).length;
              const chanichim = gScouts.filter(s => !["י", "יא", "יב"].includes(s.grade) && s.grade).length;
              return (
                <button
                  key={g}
                  onClick={() => setLocation("/teams")}
                  className="text-right p-3.5 rounded-xl border border-card-border bg-card hover:shadow-md hover:-translate-y-0.5 transition-all group shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-8 h-8 rounded-lg bg-[#00327d] flex items-center justify-center text-white font-black text-xs shadow-sm">
                      {g.charAt(0)}
                    </div>
                    <span className="font-bold text-sm truncate">{g}</span>
                  </div>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    {chanichim > 0 && <span>{chanichim} חניכים</span>}
                    {pailim > 0 && <span className="text-blue-600 font-semibold">{pailim} פעילים</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {visible.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>אין גישה. פנה למרכז בוגר להגדרת הרשאות.</p>
        </div>
      )}
    </div>
  );
}

function StatPulse({ value, label, accent }: { value: number; label: string; accent?: string }) {
  return (
    <div className="text-right">
      <div className={`text-3xl md:text-4xl font-black leading-none ${accent || "text-white"}`} style={{ fontFamily: "Manrope, sans-serif" }}>
        {value.toLocaleString("he-IL")}
      </div>
      <div className="text-[10px] text-white/50 font-bold tracking-widest uppercase mt-1">{label}</div>
    </div>
  );
}

const TINT_CLASSES: Record<string, { bg: string; border: string; text: string; sub: string }> = {
  violet: { bg: "bg-violet-50 hover:bg-violet-100", border: "border-violet-200 hover:border-violet-300", text: "text-violet-950", sub: "text-violet-600" },
  amber:  { bg: "bg-amber-50 hover:bg-amber-100",   border: "border-amber-200 hover:border-amber-300",   text: "text-amber-950",  sub: "text-amber-600" },
  teal:   { bg: "bg-teal-50 hover:bg-teal-100",     border: "border-teal-200 hover:border-teal-300",     text: "text-teal-950",   sub: "text-teal-600" },
  orange: { bg: "bg-orange-50 hover:bg-orange-100", border: "border-orange-200 hover:border-orange-300", text: "text-orange-950", sub: "text-orange-600" },
  cyan:   { bg: "bg-cyan-50 hover:bg-cyan-100",     border: "border-cyan-200 hover:border-cyan-300",     text: "text-cyan-950",   sub: "text-cyan-600" },
  slate:  { bg: "bg-slate-50 hover:bg-slate-100",   border: "border-slate-200 hover:border-slate-300",   text: "text-slate-900",  sub: "text-slate-500" },
  indigo: { bg: "bg-indigo-50 hover:bg-indigo-100", border: "border-indigo-200 hover:border-indigo-300", text: "text-indigo-950", sub: "text-indigo-600" },
  pink:   { bg: "bg-pink-50 hover:bg-pink-100",     border: "border-pink-200 hover:border-pink-300",     text: "text-pink-950",   sub: "text-pink-600" },
};

function TileCard({ tile, onClick }: { tile: Tile; onClick: () => void }) {
  const Icon = tile.icon;

  if (tile.variant === "gradient" && tile.gradient) {
    return (
      <button
        onClick={onClick}
        className={`group relative text-right rounded-2xl bg-gradient-to-br ${tile.gradient} p-4 md:p-5 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 focus:outline-none shadow-md`}
      >
        <div className="flex items-start justify-between mb-3">
          <span className="text-2xl font-black leading-none text-white/20" style={{ fontFamily: "Manrope, sans-serif" }}>
            {tile.num}
          </span>
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
        <div>
          <h3 className="font-bold text-base leading-tight text-white">{tile.title}</h3>
          <p className="text-xs mt-1 leading-relaxed text-white/70">{tile.subtitle}</p>
        </div>
        <ChevronLeft className="absolute bottom-3 left-3 w-4 h-4 text-white opacity-0 group-hover:opacity-60 transition-opacity" />
      </button>
    );
  }

  if (tile.variant === "navy") {
    return (
      <button
        onClick={onClick}
        className={`group relative text-right rounded-2xl bg-gradient-to-br from-[#00327d] to-[#001a4d] p-4 md:p-5 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 focus:outline-none shadow-lg ${tile.span ? "col-span-2" : ""}`}
      >
        <div className="absolute -top-4 -left-4 w-32 h-32 rounded-full bg-blue-400/10 pointer-events-none" />
        <div className="flex items-start justify-between mb-3 relative">
          <span className="text-2xl font-black leading-none text-white/20" style={{ fontFamily: "Manrope, sans-serif" }}>
            {tile.num}
          </span>
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
        <div className="relative">
          <h3 className="font-bold text-lg leading-tight text-white">{tile.title}</h3>
          <p className="text-xs mt-1 leading-relaxed text-white/65">{tile.subtitle}</p>
        </div>
        <ChevronLeft className="absolute bottom-3 left-3 w-4 h-4 text-white opacity-0 group-hover:opacity-50 transition-opacity" />
      </button>
    );
  }

  // tinted
  const c = TINT_CLASSES[tile.tint || "slate"];
  return (
    <button
      onClick={onClick}
      className={`group relative text-right rounded-2xl border-2 ${c.bg} ${c.border} p-4 md:p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 focus:outline-none shadow-sm`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className={`text-2xl font-black leading-none opacity-25 ${c.text}`} style={{ fontFamily: "Manrope, sans-serif" }}>
          {tile.num}
        </span>
        <div className={`w-10 h-10 rounded-xl ${tile.iconColor || "bg-slate-500"} flex items-center justify-center shadow-sm`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <div>
        <h3 className={`font-bold text-base leading-tight ${c.text}`}>{tile.title}</h3>
        <p className={`text-xs mt-1 leading-relaxed ${c.sub}`}>{tile.subtitle}</p>
      </div>
      <ChevronLeft className={`absolute bottom-3 left-3 w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity ${c.text}`} />
    </button>
  );
}
