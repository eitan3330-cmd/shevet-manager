import { useLocation } from "wouter";
import { Users, CalendarCheck, FileText, ChevronLeft } from "lucide-react";

const tiles = [
  {
    href: "/hadracha/scouts",
    title: "מאגר חניכים",
    subtitle: "רשימות חניכים, פעילים ומדריכים לפי שכבה וכיתה",
    icon: Users,
    gradient: "from-blue-600 to-blue-700",
    iconBg: "bg-blue-500/30",
  },
  {
    href: "/hadracha/attendance",
    title: "נוכחות",
    subtitle: "סימון ומעקב נוכחות בפעילויות",
    icon: CalendarCheck,
    gradient: "from-sky-500 to-sky-600",
    iconBg: "bg-sky-400/30",
  },
  {
    href: "/hadracha/activities",
    title: "הגשת פעולות",
    subtitle: "הגשה, ניהול ואישור תוכניות פעולות",
    icon: FileText,
    gradient: "from-indigo-500 to-indigo-600",
    iconBg: "bg-indigo-400/30",
  },
];

export function HadracheHub() {
  const [, setLocation] = useLocation();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">הדרכה</h2>
        <p className="text-muted-foreground">בחר את הכלי שברצונך להשתמש</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
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
