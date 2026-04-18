import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldAlert, Archive, BookOpen, CalendarRange, Users,
  Wallet, ShoppingCart, CalendarCheck, AlertTriangle,
  CheckCircle2, Loader2, RefreshCw, Lightbulb, GitBranch
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}/api${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "שגיאה" }));
    throw new Error(err.error || "שגיאת שרת");
  }
  return res.json();
}

export function Years() {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [yearLabel, setYearLabel] = useState('תשפ"ה (2024-2025)');
  const [notes, setNotes] = useState("");
  const [highlights, setHighlights] = useState("");
  const [confirmText, setConfirmText] = useState("");

  const { data: archives = [], isLoading } = useQuery({
    queryKey: ["years"],
    queryFn: () => apiFetch("/years"),
    enabled: role === "marcaz_boger",
  });

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch("/years/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearLabel,
          closedBy: user?.name || role || "",
          notes,
          highlights,
        }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["years"] });
      queryClient.invalidateQueries({ queryKey: ["tribe-users"] });
      toast({
        title: "השנה נסגרה בהצלחה!",
        description: `${data.summary?.scouts || 0} חניכים, ${data.summary?.events || 0} מפעלים נשמרו. ${data.usersReset || 0} משתמשים אופסו.`,
      });
      setOpen(false);
      setConfirmText("");
      setNotes("");
      setHighlights("");
    },
    onError: (err: Error) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  if (role !== "marcaz_boger") {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <ShieldAlert className="w-16 h-16 text-destructive opacity-80" />
        <h2 className="text-2xl font-bold">אין גישה</h2>
        <p className="text-muted-foreground text-center">עמוד זה מיועד למרכז בוגר בלבד.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Archive className="w-8 h-8 text-primary" />
            ארכיון שנים ושימור ידע
          </h2>
          <p className="text-muted-foreground max-w-xl">
            סגירת שנה שומרת את כל נתוני השבט לצמיתות כדי שהבאים אחריך יוכלו ללמוד ולהתמצא.
            לאחר הסגירה — המשתמשים מאופסים ואפשר להוסיף צוות חדש לשנה הבאה.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="gap-2 shadow-md">
              <Archive className="w-5 h-5" />
              סגור שנה
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader className="text-right">
              <DialogTitle className="text-xl flex items-center gap-2 justify-end">
                <Archive className="w-5 h-5" />
                סגירת שנה שוטפת
              </DialogTitle>
              <DialogDescription className="text-right">
                כל הנתונים יישמרו בארכיון. המשתמשים יאופסו כדי לאפשר הוספת צוות חדש לשנה הבאה.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>שם השנה *</Label>
                <Input value={yearLabel} onChange={e => setYearLabel(e.target.value)} placeholder='תשפ"ה (2024-2025)' className="text-right" />
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  נקודות בולטות לשנה זו (שימור ידע)
                </Label>
                <Textarea
                  value={highlights}
                  onChange={e => setHighlights(e.target.value)}
                  placeholder="מה הצליח במיוחד? מה כדאי לעשות שוב? מה לשנות? מה חשוב שהבאים אחריכם ידעו?"
                  rows={4}
                  className="text-right resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label>הערות כלליות</Label>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="הערות נוספות לארכיון..."
                  rows={2}
                  className="text-right resize-none"
                />
              </div>

              <div className="p-4 rounded-lg border-2 border-destructive/30 bg-destructive/5 space-y-2">
                <div className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-destructive">לאחר הסגירה:</p>
                    <ul className="text-muted-foreground mt-1 space-y-0.5 text-xs">
                      <li>• כל הנתונים יישמרו בארכיון לצמיתות</li>
                      <li>• המשתמשים יאופסו — יש להוסיף צוות חדש</li>
                    </ul>
                  </div>
                </div>
                <p className="text-sm font-medium text-destructive">הקלד "סגור שנה" לאישור:</p>
                <Input
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder='סגור שנה'
                  className="text-right border-destructive/40"
                />
              </div>
            </div>

            <DialogFooter className="flex gap-2 flex-row-reverse">
              <Button
                onClick={() => mutation.mutate()}
                disabled={confirmText !== "סגור שנה" || !yearLabel.trim() || mutation.isPending}
                variant="destructive" className="gap-2"
              >
                {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                סגור שנה + אפס משתמשים
              </Button>
              <Button variant="outline" onClick={() => { setOpen(false); setConfirmText(""); }}>ביטול</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>טוען ארכיון...</p>
        </div>
      ) : archives.length === 0 ? (
        <Card className="border-dashed border-2 border-muted">
          <CardContent className="py-16 text-center space-y-3">
            <BookOpen className="w-14 h-14 mx-auto text-muted-foreground/40" />
            <p className="text-lg font-medium text-muted-foreground">אין שנים בארכיון עדיין</p>
            <p className="text-sm text-muted-foreground/70">
              בסגירת שנה, כל הנתונים וה"שימור ידע" יישמרו כאן לצמיתות.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {[...archives].reverse().map((archive: any) => (
            <Card key={archive.id} className="border-2 hover:border-primary/30 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                      {archive.yearLabel}
                    </CardTitle>
                    <CardDescription>
                      נסגר ב-{new Date(archive.closedAt).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {archive.closedBy && ` · על ידי ${archive.closedBy}`}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">ארכיון</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {[
                    { icon: Users, label: "חניכים", count: archive.scoutsData?.length ?? 0, color: "text-blue-600" },
                    { icon: CalendarRange, label: "מפעלים", count: archive.eventsData?.length ?? 0, color: "text-red-600" },
                    { icon: CalendarCheck, label: "נוכחות", count: archive.attendanceData?.length ?? 0, color: "text-sky-600" },
                    { icon: Wallet, label: "תקציב", count: archive.budgetData?.length ?? 0, color: "text-rose-600" },
                    { icon: ShoppingCart, label: "הזמנות", count: archive.procurementData?.length ?? 0, color: "text-indigo-600" },
                    { icon: GitBranch, label: "צוות", count: archive.staffData?.length ?? 0, color: "text-emerald-600" },
                  ].map(({ icon: Icon, label, count, color }) => (
                    <div key={label} className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-muted/40 border">
                      <Icon className={`w-4 h-4 ${color}`} />
                      <span className="text-base font-bold">{count}</span>
                      <span className="text-xs text-muted-foreground text-center">{label}</span>
                    </div>
                  ))}
                </div>
                {archive.notes && (
                  <div className="p-3 rounded-lg bg-muted/30 border space-y-1">
                    {archive.notes.includes("✨ נקודות בולטות:") ? (
                      <>
                        {archive.notes.split("✨ נקודות בולטות:").map((part: string, i: number) => (
                          i === 0 && part.trim() ? (
                            <p key={0} className="text-sm text-muted-foreground">{part.trim()}</p>
                          ) : i === 1 ? (
                            <div key={1} className="space-y-1">
                              <p className="text-sm font-semibold text-amber-700 flex items-center gap-1.5">
                                <Lightbulb className="w-3.5 h-3.5" />
                                נקודות בולטות לשנה הבאה:
                              </p>
                              <p className="text-sm text-muted-foreground whitespace-pre-line">{part.trim()}</p>
                            </div>
                          ) : null
                        ))}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">{archive.notes}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
