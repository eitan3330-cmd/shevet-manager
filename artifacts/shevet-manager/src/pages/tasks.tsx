import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, CheckCircle2, Circle, AlertCircle, Clock, User, Users, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { useAppSettings } from "@/lib/api-hooks";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  high: { label: "דחוף", color: "text-red-600 bg-red-50 border-red-200", icon: AlertCircle },
  normal: { label: "רגיל", color: "text-blue-600 bg-blue-50 border-blue-200", icon: Clock },
  low: { label: "נמוך", color: "text-slate-500 bg-slate-50 border-slate-200", icon: Circle },
};

const ROLE_OPTIONS = [
  { value: "marcaz_tzair", label: "מרכז צעיר" },
  { value: "roshatz", label: "ראשצ" },
  { value: "roshgad", label: "ראשגד" },
];

type TaskForm = {
  title: string; description: string; assignedTo: string; assignedRole: string;
  priority: string; dueDate: string; notes: string;
};

const EMPTY_FORM: TaskForm = { title: "", description: "", assignedTo: "", assignedRole: "", priority: "normal", dueDate: "", notes: "" };

export function Tasks() {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);
  const [viewMode, setViewMode] = useState<"mine" | "all">("mine");
  const { toast } = useToast();
  const { user, role } = useAuth();
  const qc = useQueryClient();

  const isManager = ["marcaz_boger", "marcaz_tzair", "roshgad"].includes(role || "");
  const { executionBlocked } = useAppSettings();

  const { data: users = [] } = useQuery({
    queryKey: ["tribe-users"],
    queryFn: () => fetch(`${API_BASE}/api/users`).then(r => r.json()),
  });

  const { data: allTasks = [], isLoading } = useQuery({
    queryKey: ["global-tasks"],
    queryFn: () => fetch(`${API_BASE}/api/global-tasks`).then(r => r.json()),
  });

  const createTask = useMutation({
    mutationFn: (data: any) => fetch(`${API_BASE}/api/global-tasks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["global-tasks"] }); setIsOpen(false); setForm(EMPTY_FORM); toast({ title: "משימה נוספה" }); },
  });

  const toggleTask = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) =>
      fetch(`${API_BASE}/api/global-tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["global-tasks"] }),
  });

  const deleteTask = useMutation({
    mutationFn: (id: number) => fetch(`${API_BASE}/api/global-tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["global-tasks"] }); toast({ title: "משימה נמחקה" }); },
  });

  const handleSubmit = () => {
    if (!form.title) return;
    createTask.mutate({
      ...form,
      createdBy: user?.name || "לא ידוע",
      dueDate: form.dueDate || null,
      assignedRole: form.assignedRole === "none" ? null : form.assignedRole || null,
      assignedTo: form.assignedTo || null,
    });
  };

  const myTasks = (allTasks as any[]).filter(t =>
    t.assignedTo === user?.name || t.assignedRole === role
  );

  const displayTasks = viewMode === "mine" || !isManager ? myTasks : (allTasks as any[]);

  const groupByAssignee: Record<string, any[]> = {};
  displayTasks.forEach(t => {
    const key = t.assignedTo || t.assignedRole || "ללא שיבוץ";
    if (!groupByAssignee[key]) groupByAssignee[key] = [];
    groupByAssignee[key].push(t);
  });

  const doneTasks = displayTasks.filter((t: any) => t.done).length;
  const totalTasks = displayTasks.length;
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  if (executionBlocked) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
        <Lock className="w-14 h-14 text-amber-500 opacity-70" />
        <h2 className="text-2xl font-bold">ביצוע נעול</h2>
        <p className="text-muted-foreground max-w-sm">משימות השבט נעולות על ידי מרכז בוגר. פנה למרכז בוגר לפתיחת הגישה.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold">משימות</h2>
          <p className="text-muted-foreground">ניהול ומעקב משימות לפי אנשים</p>
        </div>
        <div className="flex gap-2">
          {isManager && (
            <div className="flex rounded-lg border overflow-hidden text-sm">
              {[{ id: "mine", label: "שלי" }, { id: "all", label: "הכל" }].map(m => (
                <button key={m.id} onClick={() => setViewMode(m.id as any)}
                  className={`px-3 py-1.5 ${viewMode === m.id ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}>
                  {m.label}
                </button>
              ))}
            </div>
          )}
          {isManager && (
            <Button onClick={() => setIsOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> ממסר משימה</Button>
          )}
        </div>
      </div>

      {totalTasks > 0 && (
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">התקדמות</span>
            <span className="font-semibold text-sm">{doneTasks}/{totalTasks} ({pct}%)</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2.5">
            <div className="bg-primary h-2.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">טוען...</div>
      ) : displayTasks.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-xl">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">{viewMode === "mine" ? "אין משימות שהוקצו לי" : "אין משימות"}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupByAssignee).map(([assignee, tasks]) => {
            const groupDone = tasks.filter(t => t.done).length;
            const groupPct = tasks.length > 0 ? Math.round((groupDone / tasks.length) * 100) : 0;
            return (
              <div key={assignee} className="border rounded-xl overflow-hidden">
                <div className="bg-muted/30 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">ממוסרות ל{assignee} ({groupDone}/{tasks.length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-muted rounded-full h-1.5">
                      <div className="bg-primary h-1.5 rounded-full" style={{ width: `${groupPct}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{groupPct}%</span>
                  </div>
                </div>
                <div className="divide-y divide-border/50">
                  {tasks.map(task => {
                    const cfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.normal;
                    const PIcon = cfg.icon;
                    return (
                      <div key={task.id} className={`flex items-start gap-3 p-3 ${task.done ? "opacity-60 bg-muted/20" : "bg-card"}`}>
                        <Checkbox
                          checked={task.done}
                          onCheckedChange={() => toggleTask.mutate({ id: task.id, done: !task.done })}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`font-medium text-sm ${task.done ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
                            <span className={`text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border ${cfg.color}`}>
                              <PIcon className="w-2.5 h-2.5" />{cfg.label}
                            </span>
                          </div>
                          {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
                          <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                            {task.dueDate && <span>עד: {new Date(task.dueDate).toLocaleDateString('he-IL')}</span>}
                            {task.createdBy && <span>הוקצה ע״י: {task.createdBy}</span>}
                          </div>
                        </div>
                        {isManager && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={() => deleteTask.mutate(task.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>ממסר משימה</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="כותרת המשימה *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            <Textarea placeholder="תיאור המשימה..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">שיבוץ לאדם</label>
                <Select value={form.assignedTo || "none"} onValueChange={v => setForm(p => ({ ...p, assignedTo: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="בחר אדם" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ללא</SelectItem>
                    {(users as any[]).map(u => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">שיבוץ לתפקיד</label>
                <Select value={form.assignedRole || "none"} onValueChange={v => setForm(p => ({ ...p, assignedRole: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="בחר תפקיד" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ללא</SelectItem>
                    {ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">עדיפות</label>
                <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">דחוף</SelectItem>
                    <SelectItem value="normal">רגיל</SelectItem>
                    <SelectItem value="low">נמוך</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">תאריך יעד</label>
                <Input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} />
              </div>
            </div>
            <Input placeholder="הערות" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            <Button className="w-full" onClick={handleSubmit} disabled={!form.title || createTask.isPending}>
              ממסר משימה
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
