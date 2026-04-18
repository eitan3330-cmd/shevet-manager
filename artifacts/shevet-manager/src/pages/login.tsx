import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth, ROLE_NAMES, Role } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Loader2, Shield, ChevronLeft, Crown, Eye, EyeOff, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const PRIMARY = "#00327d";
const SECONDARY = "#da3433";

type DbUser = {
  id: number;
  name: string;
  role: string;
  battalion: string | null;
  hasPin: boolean;
};

const ROLE_THEMES: Record<string, {
  bg: string; iconBg: string; text: string; subText: string; border: string; label: string;
}> = {
  marcaz_boger: { bg: "bg-blue-50", iconBg: "bg-blue-600", text: "text-blue-900", subText: "text-blue-700/70", border: "border-blue-200", label: "מרכז בוגר" },
  marcaz_tzair: { bg: "bg-red-50", iconBg: "bg-red-600", text: "text-red-900", subText: "text-red-700/70", border: "border-red-200", label: "מרכז צעיר" },
  roshatz: { bg: "bg-sky-50", iconBg: "bg-sky-600", text: "text-sky-900", subText: "text-sky-700/70", border: "border-sky-200", label: "ראשצ" },
  roshgad: { bg: "bg-rose-50", iconBg: "bg-rose-600", text: "text-rose-900", subText: "text-rose-700/70", border: "border-rose-200", label: "ראשגד" },
  madrich: { bg: "bg-emerald-50", iconBg: "bg-emerald-600", text: "text-emerald-900", subText: "text-emerald-700/70", border: "border-emerald-200", label: "מדריך" },
  pael: { bg: "bg-teal-50", iconBg: "bg-teal-500", text: "text-teal-900", subText: "text-teal-700/70", border: "border-teal-200", label: "פעיל" },
};

type Step = "name" | "pin";

export function Login() {
  const { role, setUser } = useAuth();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<Step>("name");
  const [nameInput, setNameInput] = useState("");
  const [selectedUser, setSelectedUser] = useState<DbUser | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [pin, setPin] = useState(["", "", "", ""]);
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const pinRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    if (role) setLocation("/dashboard");
  }, [role]);

  useEffect(() => {
    if (step === "name") {
      setTimeout(() => nameRef.current?.focus(), 80);
    } else if (step === "pin") {
      setTimeout(() => pinRefs[0].current?.focus(), 80);
    }
  }, [step]);

  const { data: dbUsers = [], isLoading: usersLoading } = useQuery<DbUser[]>({
    queryKey: ["tribe-users-login"],
    queryFn: () => fetch(`${API_BASE}/api/users`).then(r => r.json()),
  });

  const suggestions = useMemo(() => {
    if (!nameInput.trim()) return [];
    const q = nameInput.trim().toLowerCase();
    return (dbUsers as DbUser[]).filter(u =>
      u.name.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [nameInput, dbUsers]);

  const handleSelectUser = (u: DbUser) => {
    setSelectedUser(u);
    setNameInput(u.name);
    setShowSuggestions(false);
    setError("");
    if (!u.hasPin) {
      // No PIN — log in directly
      setUser({
        id: u.id,
        name: u.name,
        role: u.role as Role,
        hasPin: false,
        battalion: u.battalion,
      });
    } else {
      setStep("pin");
      setPin(["", "", "", ""]);
    }
  };

  const handleNameSubmit = () => {
    const q = nameInput.trim().toLowerCase();
    if (!q) return;
    const match = (dbUsers as DbUser[]).find(u => u.name.toLowerCase() === q);
    if (match) {
      handleSelectUser(match);
    } else if (suggestions.length === 1) {
      handleSelectUser(suggestions[0]);
    } else {
      setError("לא נמצא משתמש עם השם הזה. בדוק את האיות ונסה שוב.");
    }
  };

  const handlePinInput = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...pin]; next[idx] = val; setPin(next);
    if (val && idx < 3) pinRefs[idx + 1].current?.focus();
    if (!val && idx > 0) pinRefs[idx - 1].current?.focus();
  };

  const handlePinKey = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[idx] && idx > 0) {
      const next = [...pin]; next[idx - 1] = ""; setPin(next);
      pinRefs[idx - 1].current?.focus();
    }
    if (e.key === "Enter" && pin.every(d => d)) handlePinSubmit();
  };

  const handlePinSubmit = async () => {
    if (!selectedUser || pin.some(d => !d)) return;
    setLoading(true);
    setError("");
    try {
      const enteredPin = pin.join("");
      const res = await fetch(`${API_BASE}/api/users/${selectedUser.id}/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: enteredPin }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError("קוד PIN שגוי. נסה שוב.");
        setPin(["", "", "", ""]);
        setTimeout(() => pinRefs[0].current?.focus(), 50);
      } else {
        setUser({
          id: selectedUser.id,
          name: selectedUser.name,
          role: selectedUser.role as Role,
          hasPin: true,
          battalion: selectedUser.battalion,
        });
      }
    } catch {
      setError("שגיאת חיבור. נסה שוב.");
    } finally {
      setLoading(false);
    }
  };

  const theme = selectedUser ? (ROLE_THEMES[selectedUser.role] || ROLE_THEMES.madrich) : null;

  return (
    <div className="min-h-screen flex" style={{ background: "hsl(216,32%,93%)", fontFamily: "Inter, sans-serif" }} dir="rtl">

      {/* Left hero panel */}
      <div
        className="hidden lg:flex flex-col justify-between flex-1 p-16 relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, #00327d 0%, #00276a 40%, #001a4d 100%)" }}
      >
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-10" style={{ background: "white" }} />
        <div className="absolute top-24 -left-16 w-64 h-64 rounded-full opacity-5" style={{ background: "white" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5" style={{ background: SECONDARY }} />
        <div className="absolute top-1/4 right-8 w-48 h-48 rounded-full opacity-5" style={{ background: "white" }} />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-white/80 font-bold text-lg" style={{ fontFamily: "Manrope, sans-serif" }}>מנהל השבט</span>
        </div>

        <div className="relative z-10 space-y-8">
          <div className="inline-flex items-center gap-2 bg-white/10 text-white/90 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            מערכת בקרה פעילה
          </div>
          <div>
            <h1 className="text-7xl xl:text-8xl font-black text-white tracking-tighter leading-none mb-6" style={{ fontFamily: "Manrope, sans-serif" }}>
              ניהול<br />השבט
            </h1>
            <p className="text-white/70 text-xl leading-relaxed font-medium max-w-md">
              מרכז שליטה דיגיטלי לניהול פעילות שוטפת, תיאום משימות ומעקב חניכים בזמן אמת.
            </p>
          </div>
          <div className="flex gap-10 pt-4 border-t border-white/10">
            {[{ n: "6", label: "תפקידי גישה" }, { n: "11", label: "מודולי ניהול" }, { n: "∞", label: "רישומים שנתיים" }].map(s => (
              <div key={s.label}>
                <div className="text-3xl font-black text-white" style={{ fontFamily: "Manrope, sans-serif" }}>{s.n}</div>
                <div className="text-xs text-white/50 font-bold tracking-widest uppercase mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-white/40 text-sm font-bold">© 2024 — כל הזכויות שמורות</div>
      </div>

      {/* Right login panel */}
      <div className="flex flex-col justify-center w-full lg:w-[480px] xl:w-[520px] shrink-0 p-8 lg:p-12 bg-white overflow-y-auto" style={{ boxShadow: "-8px 0 40px rgba(0,20,80,0.18)" }}>

        {/* Mobile logo */}
        <div className="flex items-center gap-3 mb-10 lg:hidden">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: PRIMARY }}>
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-black text-xl" style={{ color: PRIMARY, fontFamily: "Manrope, sans-serif" }}>מנהל השבט</span>
        </div>

        {step === "name" ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-black mb-1" style={{ color: PRIMARY, fontFamily: "Manrope, sans-serif" }}>
                כניסה למערכת
              </h2>
              <p className="text-slate-400 font-medium">הכנס את שמך להתחברות</p>
            </div>

            <div className="space-y-4">
              {/* Name input */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-600">שם מלא</label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    ref={nameRef}
                    type="text"
                    value={nameInput}
                    onChange={e => {
                      setNameInput(e.target.value);
                      setSelectedUser(null);
                      setShowSuggestions(true);
                      setError("");
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    onKeyDown={e => {
                      if (e.key === "Enter") { e.preventDefault(); handleNameSubmit(); }
                      if (e.key === "Escape") setShowSuggestions(false);
                    }}
                    placeholder="הקלד את שמך..."
                    className="w-full pr-10 pl-4 py-3.5 rounded-2xl border-2 border-slate-200 focus:border-[#00327d] focus:outline-none focus:shadow-[0_0_0_3px_rgba(0,50,125,0.12)] text-slate-800 font-semibold text-base transition-all"
                    style={{ fontFamily: "Manrope, sans-serif" }}
                    autoComplete="off"
                    autoCorrect="off"
                  />
                  {/* Autocomplete suggestions */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-10 top-full mt-1 w-full bg-white rounded-2xl border-2 border-slate-100 shadow-xl overflow-hidden">
                      {suggestions.map(u => {
                        const t = ROLE_THEMES[u.role] || ROLE_THEMES.madrich;
                        return (
                          <button
                            key={u.id}
                            onMouseDown={() => handleSelectUser(u)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-right hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                          >
                            <div className={`w-9 h-9 rounded-xl ${t.iconBg} flex items-center justify-center text-white text-sm font-black shrink-0`}>
                              {u.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-slate-800 text-sm">{u.name}</p>
                              <p className="text-xs text-slate-400">
                                {ROLE_NAMES[u.role] || u.role}
                                {u.battalion ? ` · ${u.battalion}` : ""}
                                {u.hasPin ? " 🔒" : ""}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {usersLoading && (
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> טוען משתמשים...
                  </p>
                )}
              </div>

              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">
                  {error}
                </div>
              )}

              <button
                onClick={handleNameSubmit}
                disabled={!nameInput.trim()}
                className="w-full py-4 rounded-2xl font-black text-white text-base transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
                style={{ background: PRIMARY, fontFamily: "Manrope, sans-serif" }}
              >
                המשך ←
              </button>
            </div>

            {/* Hint */}
            <p className="text-xs text-slate-400 text-center">
              הקלד את שמך המלא כפי שהוגדר במערכת
            </p>
          </div>
        ) : (
          /* PIN step */
          <div className="space-y-6">
            <button
              onClick={() => { setStep("name"); setPin(["", "", "", ""]); setError(""); }}
              className="flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors mb-2"
            >
              <ChevronLeft className="w-4 h-4" /> חזור
            </button>

            {/* Who's logging in */}
            {selectedUser && theme && (
              <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${theme.border} ${theme.bg}`}>
                <div className={`w-11 h-11 rounded-xl ${theme.iconBg} flex items-center justify-center text-white text-base font-black shrink-0`}>
                  {selectedUser.name.charAt(0)}
                </div>
                <div>
                  <p className={`font-bold ${theme.text}`}>{selectedUser.name}</p>
                  <p className={`text-xs ${theme.subText}`}>
                    {ROLE_NAMES[selectedUser.role] || selectedUser.role}
                    {selectedUser.battalion ? ` · ${selectedUser.battalion}` : ""}
                  </p>
                </div>
              </div>
            )}

            <div>
              <h2 className="text-2xl font-black mb-1" style={{ color: PRIMARY, fontFamily: "Manrope, sans-serif" }}>
                הכנס קוד PIN
              </h2>
              <p className="text-slate-400 text-sm font-medium">קוד 4 ספרות אישי</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-600">קוד PIN</label>
              <div className="relative">
                <input
                  ref={pinRefs[0]}
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  maxLength={4}
                  value={pin.join("")}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                    const arr = val.split("").concat(["", "", "", ""]).slice(0, 4);
                    setPin(arr);
                    setError("");
                  }}
                  onKeyDown={e => { if (e.key === "Enter" && pin.every(d => d)) handlePinSubmit(); }}
                  placeholder="• • • •"
                  className={`w-full px-4 py-4 rounded-2xl border-2 text-center text-3xl font-black tracking-[0.5em] focus:outline-none transition-all
                    ${error ? "border-red-400 bg-red-50" : "border-slate-200 focus:border-[#00327d] focus:shadow-[0_0_0_3px_rgba(0,50,125,0.12)]"}`}
                  style={{ fontFamily: "Manrope, sans-serif", letterSpacing: "0.4em" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(p => !p)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Big dot PIN display */}
              <div className="flex justify-center gap-3 pt-2">
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                      pin[i] ? "scale-100" : "scale-75 opacity-30"
                    }`}
                    style={{ background: pin[i] ? PRIMARY : "#cbd5e1" }}
                  />
                ))}
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">
                {error}
              </div>
            )}

            <button
              onClick={handlePinSubmit}
              disabled={loading || pin.some(d => !d)}
              className="w-full py-4 rounded-2xl font-black text-white text-base transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
              style={{ background: PRIMARY, fontFamily: "Manrope, sans-serif" }}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin inline" /> : "כניסה למערכת ←"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
