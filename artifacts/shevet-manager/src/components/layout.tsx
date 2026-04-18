import { ReactNode, useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth, ROLE_NAMES } from "@/hooks/use-auth";
import {
  LogOut, KeyRound, Loader2, Home, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const ROUTE_TITLES: Record<string, string> = {
  "/dashboard": "דף הבית",
  "/tasks": "משימות",
  "/schedule": "לוז מפעלים",
  "/teams": "גיזרות וצוותים",
  "/hadracha": "הדרכה",
  "/hadracha/scouts": "מאגר חניכים",
  "/hadracha/attendance": "נוכחות",
  "/hadracha/activities": "מערכי הדרכה",
  "/logistics": "לוגיסטיקה",
  "/logistics/events": "מפעלים",
  "/logistics/budget": "תקציב ופיננסים",
  "/logistics/procurement": "רכש וציוד",
  "/staffing": "עץ שיבוצים",
  "/admin": "ניהול משתמשים",
  "/years": "ארכיון שנים",
  "/management": "ניהול",
};

function getPageTitle(location: string): string {
  if (ROUTE_TITLES[location]) return ROUTE_TITLES[location];
  if (location.startsWith("/logistics/events/")) return "סביבת עבודה - מפעל";
  if (location.startsWith("/hadracha/")) return "הדרכה";
  if (location.startsWith("/logistics/")) return "לוגיסטיקה";
  if (location.startsWith("/management/")) return "ניהול";
  return "מנהל השבט";
}

function PinDialog({
  open, onClose, userId, hasPin, onPinSet,
}: {
  open: boolean;
  onClose: () => void;
  userId: number;
  hasPin: boolean;
  onPinSet: () => void;
}) {
  const initialStep = hasPin ? "current" : "new";
  const [step, setStep] = useState<"current" | "new" | "confirm">(initialStep);
  const [currentPin, setCurrentPin] = useState(["", "", "", ""]);
  const [newPin, setNewPin] = useState(["", "", "", ""]);
  const [confirmPin, setConfirmPin] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const ref0 = useRef<HTMLInputElement>(null);
  const ref1 = useRef<HTMLInputElement>(null);
  const ref2 = useRef<HTMLInputElement>(null);
  const ref3 = useRef<HTMLInputElement>(null);
  const pinRefs = [ref0, ref1, ref2, ref3];

  const reset = () => {
    setStep(hasPin ? "current" : "new");
    setCurrentPin(["","","",""]); setNewPin(["","","",""]); setConfirmPin(["","","",""]);
    setError(""); setLoading(false); setSuccess(false);
  };

  const handleInput = (arr: string[], setArr: (v: string[]) => void, idx: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...arr]; next[idx] = value;
    setArr(next);
    if (value && idx < 3) pinRefs[idx + 1].current?.focus();
  };

  const handleKeyDown = (arr: string[], setArr: (v: string[]) => void, idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !arr[idx] && idx > 0) pinRefs[idx - 1].current?.focus();
    if (e.key === "Enter" && arr.every(d => d)) advance(arr);
  };

  const advance = async (_arr: string[]) => {
    if (step === "current") { setStep("new"); setTimeout(() => pinRefs[0].current?.focus(), 80); }
    else if (step === "new") { setStep("confirm"); setTimeout(() => pinRefs[0].current?.focus(), 80); }
    else {
      const np = newPin.join(""), cp = confirmPin.join("");
      if (np !== cp) { setError("קוד ה-PIN החדש לא תואם"); setConfirmPin(["","","",""]); return; }
      setLoading(true); setError("");
      try {
        const body: Record<string, string> = { pin: np };
        if (hasPin) body.currentPin = currentPin.join("");
        const res = await fetch(`${API_BASE}/api/users/${userId}/pin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          setSuccess(true);
          onPinSet();
          setTimeout(() => { onClose(); reset(); }, 1200);
        } else {
          const e = await res.json();
          setError(e.error || "שגיאה");
          if (hasPin) { setCurrentPin(["","","",""]); setStep("current"); }
          else { setNewPin(["","","",""]); setStep("new"); }
        }
      } finally { setLoading(false); }
    }
  };

  const activeArr = step === "current" ? currentPin : step === "new" ? newPin : confirmPin;
  const setActiveArr = step === "current" ? setCurrentPin : step === "new" ? setNewPin : setConfirmPin;
  const labels = {
    current: "הכנס PIN נוכחי",
    new: hasPin ? "PIN חדש (4 ספרות)" : "הגדר PIN (4 ספרות)",
    confirm: "אמת PIN",
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); reset(); } }}>
      <DialogContent className="max-w-xs" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            {hasPin ? "שינוי PIN" : "הגדרת PIN"}
          </DialogTitle>
        </DialogHeader>
        {success ? (
          <div className="text-center py-6 text-green-600 font-bold">
            {hasPin ? "PIN עודכן בהצלחה ✓" : "PIN הוגדר בהצלחה ✓"}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground text-center">{labels[step]}</p>
            <div className="flex justify-center gap-3">
              {activeArr.map((digit, idx) => (
                <input key={idx} ref={pinRefs[idx]} type="password" inputMode="numeric" maxLength={1}
                  value={digit} onChange={e => handleInput(activeArr, setActiveArr, idx, e.target.value)}
                  onKeyDown={e => handleKeyDown(activeArr, setActiveArr, idx, e)}
                  className={`w-12 h-12 text-center text-2xl font-bold border-2 rounded-xl bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary transition-all ${error ? "border-red-400" : digit ? "border-primary" : "border-border"}`}
                />
              ))}
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <Button className="w-full" onClick={() => advance(activeArr)} disabled={loading || activeArr.some(d => !d)}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : step === "confirm" ? "שמור" : "המשך"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { role, user, logout, setUser } = useAuth();
  const [location] = useLocation();
  const [pinDialogOpen, setPinDialogOpen] = useState(false);

  const isHome = location === "/dashboard" || location === "/";
  const pageTitle = getPageTitle(location);

  return (
    <>
      <div className="flex flex-col h-screen overflow-hidden bg-background" dir="rtl">
        {/* ─── Top header bar ─────────────────────────────────────── */}
        <header className="flex items-center gap-3 px-4 py-2.5 text-white z-20 shrink-0 border-b border-white/10"
          style={{ background: "linear-gradient(135deg, #00327d 0%, #0042a0 100%)" }}>
          {/* Right: logo + back button */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Logo mark */}
            <div className="flex items-center gap-1.5 shrink-0 select-none">
              <div className="w-2 h-6 rounded-full bg-white" style={{ boxShadow: "0 0 8px rgba(255,255,255,0.4)" }} />
              <span className="text-sm font-black tracking-tight hidden sm:inline text-white/95 letter-spacing-tight">מנהל השבט</span>
              <div className="w-2 h-6 rounded-full bg-red-400" style={{ boxShadow: "0 0 8px rgba(248,113,113,0.5)" }} />
            </div>

            {/* Separator */}
            {!isHome && <div className="w-px h-5 bg-white/20 hidden sm:block" />}

            {!isHome && (
              <Link href="/dashboard">
                <span className="flex items-center gap-1.5 bg-white/12 hover:bg-white/22 border border-white/15 transition-all rounded-lg px-2.5 py-1.5 text-xs font-semibold cursor-pointer">
                  <Home className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">ראשי</span>
                  <ChevronRight className="w-3 h-3 opacity-60" />
                </span>
              </Link>
            )}

            {!isHome && (
              <span className="text-sm font-bold text-white/95 truncate">{pageTitle}</span>
            )}
          </div>

          {/* Left: user info + actions */}
          <div className="flex items-center gap-2 shrink-0">
            {user && (
              <button
                onClick={() => user.id ? setPinDialogOpen(true) : undefined}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl px-3 py-1.5 transition-all group"
              >
                <div className="text-right leading-tight">
                  <p className="text-xs font-bold text-white leading-none">{user.name}</p>
                  <p className="text-[10px] text-white/55 leading-none mt-0.5">{role ? ROLE_NAMES[role] : ""}</p>
                </div>
                {user.id && <KeyRound className="w-3.5 h-3.5 text-white/40 group-hover:text-white/70 transition-colors" />}
              </button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="text-white/60 hover:text-white hover:bg-white/12 w-8 h-8 rounded-lg"
              onClick={() => logout()}
              title="התנתק"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* ─── Main content (full width, no sidebar) ──────────────── */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-6xl animate-in fade-in duration-300">
            {children}
          </div>
        </main>
      </div>

      {user?.id && (
        <PinDialog
          open={pinDialogOpen}
          onClose={() => setPinDialogOpen(false)}
          userId={user.id}
          hasPin={!!user.hasPin}
          onPinSet={() => setUser({ ...user, hasPin: true } as typeof user)}
        />
      )}
    </>
  );
}
