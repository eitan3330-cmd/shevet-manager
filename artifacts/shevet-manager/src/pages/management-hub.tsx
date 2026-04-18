import { useLocation } from "wouter";
import { ShieldCheck, Archive, ChevronLeft, GitBranch } from "lucide-react";

const tiles = [
  {
    href: "/admin",
    title: "משתמשים והרשאות",
    subtitle: "ניהול משתמשי השבט והרשאות גישה",
    icon: ShieldCheck,
    gradient: "from-amber-600 to-amber-700",
    iconBg: "bg-amber-500/30",
  },
  {
    href: "/staffing",
    title: "עץ צוות",
    subtitle: "מבנה היררכי של הצוות, גדודים ומדריכים",
    icon: GitBranch,
    gradient: "from-emerald-600 to-emerald-700",
    iconBg: "bg-emerald-500/30",
  },
  {
    href: "/years",
    title: "ארכיון שנים",
    subtitle: "שמירת ידע, סגירת שנה ואיפוס צוות",
    icon: Archive,
    gradient: "from-slate-600 to-slate-700",
    iconBg: "bg-slate-500/30",
  },
];

export function ManagementHub() {
  const [, setLocation] = useLocation();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">ניהול</h2>
        <p className="text-muted-foreground">כלי ניהול מתקדמים</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 max-w-2xl">
        {tiles.map(tile => {
          const Icon = tile.icon;
          return (
            <button
              key={tile.href}
              onClick={() => setLocation(tile.href)}
              className={`group relative overflow-hidden text-right rounded-3xl bg-gradient-to-br ${tile.gradient} text-white shadow-lg transition-all duration-200 hover:shadow-2xl hover:-translate-y-1 p-8 min-h-[180px] w-full focus:outline-none`}
            >
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div className={`${tile.iconBg} rounded-2xl p-3 w-fit mb-4`}>
                  <Icon className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">{tile.title}</h3>
                  <p className="text-white/75 mt-1 text-sm">{tile.subtitle}</p>
                </div>
              </div>
              <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronLeft className="w-5 h-5 text-white/80" />
              </div>
              <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
