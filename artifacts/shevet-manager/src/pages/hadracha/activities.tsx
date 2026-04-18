import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, CheckCircle2, Clock, XCircle, FileText, Send, Download, Paperclip, MessageSquare, UserPlus, Eye, ArrowRight, FolderOpen, ChevronDown, ChevronLeft, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useAppSettings } from "@/lib/api-hooks";
import { Lock } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const ACTIVITY_TYPES = [
  { value: "peula", label: "פעולה" },
  { value: "tiyul", label: "טיול" },
  { value: "erev", label: "ערב" },
  { value: "shabaton", label: "שבתון" },
  { value: "special", label: "אירוע מיוחד" },
];

const GRADE_LEVELS = [
  { value: "chanichim", label: "חניכים (ד-ו)" },
  { value: "chanichim_bechirim", label: "חניכים בכירים (ז-ט)" },
  { value: "paelim", label: "פעילים (י-יב)" },
  { value: "madrichim", label: "מדריכים" },
  { value: "all", label: "כלל השבט" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; step: number }> = {
  draft:     { label: "טיוטה",   color: "bg-slate-100 text-slate-700 border-slate-200",  icon: Clock,        step: 1 },
  submitted: { label: "הוגש",    color: "bg-blue-100 text-blue-700 border-blue-200",     icon: Send,         step: 2 },
  reviewed:  { label: "נסקר",    color: "bg-purple-100 text-purple-700 border-purple-200", icon: Eye,         step: 3 },
  approved:  { label: "אושר",    color: "bg-green-100 text-green-700 border-green-200",  icon: CheckCircle2, step: 4 },
  feedback:  { label: "הערות",   color: "bg-amber-100 text-amber-700 border-amber-200",  icon: Pencil,       step: 2 },
  rejected:  { label: "נדחה",    color: "bg-red-100 text-red-700 border-red-200",        icon: XCircle,      step: 2 },
};

type ActivityForm = {
  title: string; date: string; gradeLevel: string; activityType: string;
  description: string; goals: string; materials: string; duration: string;
  fileUrl: string; fileName: string; assignedTo: string; trackId: string;
};

const EMPTY_FORM: ActivityForm = {
  title: "", date: "", gradeLevel: "chanichim", activityType: "peula",
  description: "", goals: "", materials: "", duration: "", fileUrl: "", fileName: "",
  assignedTo: "", trackId: "",
};

type Activity = {
  id: number; title: string; date?: string; gradeLevel?: string; activityType: string;
  description?: string; goals?: string; materials?: string; duration?: string; status: string;
  submittedBy?: string; assignedTo?: string; assignedBy?: string;
  reviewedBy?: string; reviewedAt?: string; reviewNotes?: string;
  feedback?: string; feedbackBy?: string; feedbackAt?: string;
  fileUrl?: string; fileName?: string; fileData?: string;
  trackId?: number | null;
};

type Track = {
  id: number; title: string; description?: string; gradeLevel?: string;
  createdBy?: string; status: string; createdAt: string;
};

export function Activities() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewId, setViewId] = useState<number | null>(null);
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [feedbackId, setFeedbackId] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("feedback");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTo, setAssignTo] = useState("");
  const [assignType, setAssignType] = useState("peula");
  const [assignGrade, setAssignGrade] = useState("chanichim");
  const [assignDue, setAssignDue] = useState("");
  const [assignTrackId, setAssignTrackId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"mine" | "all">("mine");
  const [form, setForm] = useState<ActivityForm>(EMPTY_FORM);
  const [fileLoading, setFileLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user, role } = useAuth();
  const qc = useQueryClient();

  const [trackOpen, setTrackOpen] = useState(false);
  const [trackForm, setTrackForm] = useState({ title: "", description: "", gradeLevel: "all" });
  const [editingTrackId, setEditingTrackId] = useState<number | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [requirementOpen, setRequirementOpen] = useState(false);
  const [requirementText, setRequirementText] = useState("");
  const [requirementTrackId, setRequirementTrackId] = useState<number | null>(null);
  const [requirementAssignTo, setRequirementAssignTo] = useState("");
  const [collapsedTracks, setCollapsedTracks] = useState<Set<number>>(new Set());

  const isMarcazBoger = role === "marcaz_boger";
  const isMarcazTzair = role === "marcaz_tzair";
  const isPrivileged = isMarcazBoger || isMarcazTzair;
  const isRoshgad = role === "roshgad";
  const isMadrich = role === "madrich";
  const canReview = isPrivileged || isRoshgad;
  const canUpload = isRoshgad || isMadrich || isPrivileged;
  const { executionBlocked } = useAppSettings();

  const { data: activities = [], isLoading } = useQuery<Activity[]>({
    queryKey: ["activities"],
    queryFn: () => fetch(`${API_BASE}/api/activities`).then(r => r.json()),
  });

  const { data: tracks = [] } = useQuery<Track[]>({
    queryKey: ["activity-tracks"],
    queryFn: () => fetch(`${API_BASE}/api/activity-tracks`).then(r => r.json()),
  });

  const { data: tribeUsers = [] } = useQuery<{ id: number; name: string; role: string }[]>({
    queryKey: ["tribe-users"],
    queryFn: () => fetch(`${API_BASE}/api/users`).then(r => r.json()),
  });

  const roshgadim = tribeUsers.filter(u => u.role === "roshgad");
  const madrichim = tribeUsers.filter(u => u.role === "madrich");
  const instructors = tribeUsers.filter(u => ["roshgad", "roshatz", "madrich"].includes(u.role));

  const createTrack = useMutation({
    mutationFn: (data: any) => fetch(`${API_BASE}/api/activity-tracks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["activity-tracks"] }); setTrackOpen(false); setTrackForm({ title: "", description: "", gradeLevel: "all" }); toast({ title: "מסלול נפתח" }); },
  });

  const updateTrack = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => fetch(`${API_BASE}/api/activity-tracks/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["activity-tracks"] }); setTrackOpen(false); setEditingTrackId(null); toast({ title: "מסלול עודכן" }); },
  });

  const deleteTrack = useMutation({
    mutationFn: (id: number) => fetch(`${API_BASE}/api/activity-tracks/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["activity-tracks", "activities"] }); toast({ title: "מסלול נמחק" }); },
  });

  const createActivity = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch(`${API_BASE}/api/activities`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["activities"] }); setIsOpen(false); setForm(EMPTY_FORM); toast({ title: "פעולה נשמרה" }); },
  });

  const updateActivity = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      fetch(`${API_BASE}/api/activities/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities"] });
      setIsOpen(false); setFeedbackId(null); setFeedbackText(""); setReviewId(null); setReviewNotes("");
      toast({ title: "עודכן" });
    },
  });

  const deleteActivity = useMutation({
    mutationFn: (id: number) => fetch(`${API_BASE}/api/activities/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["activities"] }); toast({ title: "נמחק" }); },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: "קובץ גדול מדי (מקסימום 5MB)", variant: "destructive" }); return; }
    setFileLoading(true);
    const reader = new FileReader();
    reader.onload = ev => {
      const base64 = ev.target?.result as string;
      setForm(p => ({ ...p, fileUrl: base64, fileName: file.name }));
      setFileLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleEdit = (a: Activity) => {
    setEditingId(a.id);
    setForm({
      title: a.title, date: a.date ? a.date.split("T")[0] : "",
      gradeLevel: a.gradeLevel || "chanichim", activityType: a.activityType || "peula",
      description: a.description || "", goals: a.goals || "", materials: a.materials || "",
      duration: a.duration || "", fileUrl: a.fileUrl || "", fileName: a.fileName || "",
      assignedTo: a.assignedTo || "", trackId: a.trackId ? String(a.trackId) : "",
    });
    setIsOpen(true);
  };

  const handleSubmit = () => {
    const data: Record<string, unknown> = {
      ...form,
      submittedBy: user?.name || "לא ידוע",
      assignedBy: form.assignedTo ? (user?.name || "לא ידוע") : null,
      date: form.date || null,
      fileData: form.fileUrl?.startsWith("data:") ? form.fileUrl : null,
      fileUrl: !form.fileUrl?.startsWith("data:") ? form.fileUrl : null,
      trackId: form.trackId ? parseInt(form.trackId) : null,
    };
    if (editingId) updateActivity.mutate({ id: editingId, data });
    else createActivity.mutate(data);
  };

  const handleAssign = () => {
    const trackTitle = tracks.find(t => t.id === parseInt(assignTrackId))?.title;
    const data: Record<string, unknown> = {
      title: `פעולה מוטלת — ${assignType === "peula" ? "פעולה" : ACTIVITY_TYPES.find(t => t.value === assignType)?.label}`,
      activityType: assignType,
      gradeLevel: assignGrade,
      assignedTo: assignTo,
      assignedBy: user?.name || "לא ידוע",
      date: assignDue || null,
      status: "draft",
      submittedBy: null,
      trackId: assignTrackId ? parseInt(assignTrackId) : null,
    };
    createActivity.mutate(data);
    setAssignOpen(false);
    setAssignTo(""); setAssignType("peula"); setAssignGrade("chanichim"); setAssignDue(""); setAssignTrackId("");
    toast({ title: `פעולה הוטלה על ${assignTo}${trackTitle ? ` במסלול ${trackTitle}` : ""}` });
  };

  const handleRequirementSend = () => {
    if (!requirementTrackId || !requirementAssignTo || !requirementText) return;
    const track = tracks.find(t => t.id === requirementTrackId);
    createActivity.mutate({
      title: `דרישת פעולה — ${track?.title || "מסלול"}`,
      description: requirementText,
      activityType: "peula",
      gradeLevel: track?.gradeLevel || "all",
      assignedTo: requirementAssignTo,
      assignedBy: user?.name || "לא ידוע",
      status: "draft",
      submittedBy: null,
      trackId: requirementTrackId,
    });
    setRequirementOpen(false);
    setRequirementText(""); setRequirementTrackId(null); setRequirementAssignTo("");
    toast({ title: `דרישת פעולה נשלחה ל${requirementAssignTo}` });
  };

  const submitFeedback = () => {
    if (!feedbackId) return;
    updateActivity.mutate({
      id: feedbackId,
      data: { feedback: feedbackText, feedbackBy: user?.name, feedbackAt: new Date().toISOString(), status: feedbackStatus },
    });
  };

  const submitReview = () => {
    if (!reviewId) return;
    updateActivity.mutate({
      id: reviewId,
      data: { status: "reviewed", reviewedBy: user?.name, reviewedAt: new Date().toISOString(), reviewNotes },
    });
  };

  const submitActivity = (id: number) => {
    updateActivity.mutate({ id, data: { status: "submitted", submittedBy: user?.name || "לא ידוע" } });
  };

  const allActivities = activities as Activity[];

  const visibleActivities = canReview && viewMode === "all"
    ? allActivities
    : allActivities.filter(a =>
        a.assignedTo === user?.name || a.submittedBy === user?.name ||
        (!a.assignedTo && !a.assignedBy)
      );

  const filtered = visibleActivities.filter(a => statusFilter === "all" || a.status === statusFilter);

  const trackActivities = selectedTrackId
    ? filtered.filter(a => a.trackId === selectedTrackId)
    : filtered;

  const unlinkedActivities = filtered.filter(a => !a.trackId);

  const viewActivity = allActivities.find(a => a.id === viewId);
  const feedbackActivity = allActivities.find(a => a.id === feedbackId);
  const reviewActivity = allActivities.find(a => a.id === reviewId);

  const downloadFile = (a: Activity) => {
    const url = a.fileData || a.fileUrl;
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = a.fileName || "קובץ";
    link.click();
  };

  const toggleTrackCollapse = (id: number) => {
    setCollapsedTracks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (executionBlocked) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
        <Lock className="w-14 h-14 text-amber-500 opacity-70" />
        <h2 className="text-2xl font-bold">ביצוע נעול</h2>
        <p className="text-muted-foreground max-w-sm">הגשת פעולות נעולה על ידי מרכז בוגר. פנה למרכז בוגר לפתיחת הגישה.</p>
      </div>
    );
  }

  const activeTracks = tracks.filter(t => t.status === "active");

  const renderActivityCard = (a: Activity) => {
    const cfg = STATUS_CONFIG[a.status] || STATUS_CONFIG.draft;
    const StatusIcon = cfg.icon;
    const typeLabel = ACTIVITY_TYPES.find(t => t.value === a.activityType)?.label || a.activityType;
    const levelLabel = GRADE_LEVELS.find(g => g.value === a.gradeLevel)?.label || a.gradeLevel;
    const hasFile = a.fileData || a.fileUrl;
    const isOwnEntry = a.submittedBy === user?.name || a.assignedTo === user?.name;
    const isAssigned = a.assignedTo === user?.name;

    return (
      <div key={a.id} className={`border rounded-xl p-4 bg-card hover:shadow-sm transition-shadow ${isAssigned && !editingId ? "border-blue-200 bg-blue-50/20" : ""}`}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">{a.title}</h3>
            <p className="text-xs text-muted-foreground">{typeLabel} • {levelLabel}</p>
            {a.assignedTo && (
              <p className="text-xs text-blue-600 mt-0.5 flex items-center gap-1">
                <UserPlus className="w-3 h-3" />
                {a.assignedBy ? `הוטל ע״י ${a.assignedBy} → ${a.assignedTo}` : `שויך ל${a.assignedTo}`}
              </p>
            )}
          </div>
          <Badge variant="outline" className={`text-xs flex items-center gap-1 shrink-0 ${cfg.color}`}>
            <StatusIcon className="w-3 h-3" />{cfg.label}
          </Badge>
        </div>

        <div className="flex items-center gap-1 mb-2 text-xs text-muted-foreground">
          {["draft", "submitted", "reviewed", "approved"].map((s, i) => {
            const step = STATUS_CONFIG[s];
            const isCurrent = a.status === s;
            const isPast = (STATUS_CONFIG[a.status]?.step || 1) > (step?.step || 1);
            return (
              <span key={s} className="flex items-center gap-1">
                {i > 0 && <ArrowRight className="w-3 h-3 opacity-40" />}
                <span className={`${isCurrent ? "text-foreground font-semibold" : isPast ? "line-through opacity-50" : "opacity-40"}`}>
                  {step?.label}
                </span>
              </span>
            );
          })}
        </div>

        {a.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{a.description}</p>}

        {a.reviewNotes && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 mb-2 text-xs">
            <p className="font-medium text-purple-800 mb-0.5 flex items-center gap-1"><Eye className="w-3 h-3" /> סקירה מ{a.reviewedBy}:</p>
            <p className="text-purple-700">{a.reviewNotes}</p>
          </div>
        )}

        {a.feedback && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-2 text-xs">
            <p className="font-medium text-amber-800 mb-0.5 flex items-center gap-1"><MessageSquare className="w-3 h-3" /> הערות מ{a.feedbackBy}:</p>
            <p className="text-amber-700">{a.feedback}</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex gap-2 text-xs text-muted-foreground">
            {a.date && <span>{new Date(a.date).toLocaleDateString("he-IL")}</span>}
            {a.duration && <span>• {a.duration}</span>}
            {hasFile && <span className="flex items-center gap-0.5"><Paperclip className="w-3 h-3" />{a.fileName || "קובץ"}</span>}
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setViewId(a.id)} title="פרטים">
              <Eye className="w-3.5 h-3.5" />
            </Button>
            {hasFile && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600" onClick={() => downloadFile(a)} title="הורד קובץ">
                <Download className="w-3.5 h-3.5" />
              </Button>
            )}
            {(a.status === "draft" || a.status === "feedback") && (isOwnEntry || !a.assignedTo) && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => submitActivity(a.id)}>
                <Send className="w-3 h-3" /> הגש
              </Button>
            )}
            {isRoshgad && a.status === "submitted" && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-purple-700 border-purple-300"
                onClick={() => { setReviewId(a.id); setReviewNotes(""); }}>
                <Eye className="w-3 h-3" /> סקור
              </Button>
            )}
            {isPrivileged && a.status === "submitted" && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-amber-700 border-amber-300"
                onClick={() => { setFeedbackId(a.id); setFeedbackText(a.feedback || ""); setFeedbackStatus("feedback"); }}>
                <MessageSquare className="w-3 h-3" /> הערות
              </Button>
            )}
            {isPrivileged && a.status === "reviewed" && (
              <>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-amber-700 border-amber-300"
                  onClick={() => { setFeedbackId(a.id); setFeedbackText(a.feedback || ""); setFeedbackStatus("feedback"); }}>
                  <MessageSquare className="w-3 h-3" /> הערות
                </Button>
                <Button size="sm" className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700"
                  onClick={() => updateActivity.mutate({ id: a.id, data: { status: "approved" } })}>
                  <CheckCircle2 className="w-3 h-3" /> אשר
                </Button>
              </>
            )}
            {(isOwnEntry || canReview) && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(a)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            )}
            {(isPrivileged || isOwnEntry) && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                onClick={() => { if (confirm("למחוק?")) deleteActivity.mutate(a.id); }}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold">הגשת פעולות</h2>
          <p className="text-muted-foreground">מסלולים, הגשה ואישור תוכניות פעולות</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isMarcazBoger && (
            <Button variant="outline" onClick={() => { setEditingTrackId(null); setTrackForm({ title: "", description: "", gradeLevel: "all" }); setTrackOpen(true); }} className="gap-2">
              <Route className="w-4 h-4" /> פתח מסלול
            </Button>
          )}
          {isMarcazTzair && activeTracks.length > 0 && (
            <Button variant="outline" onClick={() => { setRequirementOpen(true); setRequirementTrackId(activeTracks[0].id); }} className="gap-2">
              <UserPlus className="w-4 h-4" /> שלח דרישה לראשגד
            </Button>
          )}
          {isPrivileged && (
            <Button variant="outline" onClick={() => setAssignOpen(true)} className="gap-2">
              <UserPlus className="w-4 h-4" /> הטל פעולה
            </Button>
          )}
          {canUpload && (
            <Button onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setIsOpen(true); }} className="gap-2">
              <Plus className="w-4 h-4" /> פעולה חדשה
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {canReview && (
          <div className="flex rounded-lg border overflow-hidden text-sm">
            {[{ id: "mine" as const, label: "שלי" }, { id: "all" as const, label: "הכל" }].map(m => (
              <button key={m.id} onClick={() => setViewMode(m.id)}
                className={`px-3 py-1.5 ${viewMode === m.id ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}>
                {m.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          {[{ value: "all", label: "הכל" }, ...Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))].map(({ value, label }) => (
            <button key={value} onClick={() => setStatusFilter(value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${statusFilter === value ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}>
              {label}
            </button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground self-center">{trackActivities.length} פעולות</span>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">טוען...</div>
      ) : (
        <div className="space-y-4">
          {activeTracks.length > 0 && (
            <div className="space-y-3">
              {activeTracks.map(track => {
                const tActivities = filtered.filter(a => a.trackId === track.id);
                const isCollapsed = collapsedTracks.has(track.id);
                const approvedCount = tActivities.filter(a => a.status === "approved").length;
                const submittedCount = tActivities.filter(a => a.status === "submitted" || a.status === "reviewed").length;
                const gradeLabel = GRADE_LEVELS.find(g => g.value === track.gradeLevel)?.label || track.gradeLevel;

                return (
                  <div key={track.id} className="border-2 border-primary/20 rounded-xl overflow-hidden bg-primary/5">
                    <button
                      className="w-full flex items-center justify-between p-4 hover:bg-primary/10 transition-colors text-right"
                      onClick={() => toggleTrackCollapse(track.id)}
                    >
                      <div className="flex items-center gap-3">
                        {isCollapsed ? <ChevronLeft className="w-5 h-5 text-primary" /> : <ChevronDown className="w-5 h-5 text-primary" />}
                        <div>
                          <div className="flex items-center gap-2">
                            <Route className="w-4 h-4 text-primary" />
                            <span className="font-bold text-lg">{track.title}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {gradeLabel} • נפתח ע״י {track.createdBy} • {new Date(track.createdAt).toLocaleDateString("he-IL")}
                          </p>
                          {track.description && <p className="text-sm text-muted-foreground mt-1">{track.description}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                          {approvedCount} אושרו
                        </Badge>
                        <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">
                          {submittedCount} בתהליך
                        </Badge>
                        <Badge variant="outline">{tActivities.length} סה״כ</Badge>
                        {isPrivileged && (
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                              setEditingTrackId(track.id);
                              setTrackForm({ title: track.title, description: track.description || "", gradeLevel: track.gradeLevel || "all" });
                              setTrackOpen(true);
                            }}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                              if (confirm("למחוק את המסלול? הפעולות ישארו אך יופרדו מהמסלול.")) deleteTrack.mutate(track.id);
                            }}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        )}
                      </div>
                    </button>
                    {!isCollapsed && (
                      <div className="px-4 pb-4">
                        {tActivities.length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground border rounded-lg bg-background">
                            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">עדיין אין פעולות במסלול הזה</p>
                            {isMarcazTzair && (
                              <Button variant="outline" size="sm" className="mt-2 gap-1" onClick={() => { setRequirementOpen(true); setRequirementTrackId(track.id); }}>
                                <UserPlus className="w-3 h-3" /> שלח דרישה לראשגד
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="grid gap-3 md:grid-cols-2">
                            {tActivities.map(renderActivityCard)}
                          </div>
                        )}
                        <div className="flex gap-2 mt-3">
                          {isMarcazTzair && (
                            <Button variant="outline" size="sm" className="gap-1" onClick={() => { setRequirementOpen(true); setRequirementTrackId(track.id); }}>
                              <UserPlus className="w-3 h-3" /> שלח דרישת פעולה
                            </Button>
                          )}
                          {canUpload && (
                            <Button variant="outline" size="sm" className="gap-1" onClick={() => {
                              setEditingId(null);
                              setForm({ ...EMPTY_FORM, trackId: String(track.id), gradeLevel: track.gradeLevel || "chanichim" });
                              setIsOpen(true);
                            }}>
                              <Plus className="w-3 h-3" /> הוסף פעולה למסלול
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {unlinkedActivities.length > 0 && (
            <div>
              {activeTracks.length > 0 && (
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-muted-foreground" />
                  פעולות ללא מסלול
                </h3>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                {unlinkedActivities.map(renderActivityCard)}
              </div>
            </div>
          )}

          {trackActivities.length === 0 && activeTracks.length === 0 && (
            <div className="text-center py-16 text-muted-foreground border rounded-xl">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">אין פעולות עדיין</p>
              {isMarcazBoger && <p className="text-sm mt-1">פתח מסלול חדש כדי להתחיל</p>}
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Activity Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? "עריכת פעולה" : "פעולה חדשה"}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
            <Input placeholder="כותרת הפעולה *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            {activeTracks.length > 0 && (
              <div>
                <label className="text-xs text-muted-foreground">מסלול (אופציונלי)</label>
                <Select value={form.trackId} onValueChange={v => setForm(p => ({ ...p, trackId: v }))}>
                  <SelectTrigger><SelectValue placeholder="ללא מסלול" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">ללא מסלול</SelectItem>
                    {activeTracks.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Select value={form.activityType} onValueChange={v => setForm(p => ({ ...p, activityType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACTIVITY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={form.gradeLevel} onValueChange={v => setForm(p => ({ ...p, gradeLevel: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{GRADE_LEVELS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">תאריך</label><Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></div>
              <div><label className="text-xs text-muted-foreground">משך</label><Input placeholder="שעתיים..." value={form.duration} onChange={e => setForm(p => ({ ...p, duration: e.target.value }))} /></div>
            </div>
            {isPrivileged && (
              <div>
                <label className="text-xs text-muted-foreground">שייך למדריך/ראשגד (אופציונלי)</label>
                {instructors.length > 0 ? (
                  <Select value={form.assignedTo} onValueChange={v => setForm(p => ({ ...p, assignedTo: v }))}>
                    <SelectTrigger><SelectValue placeholder="בחר..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">ללא שיוך</SelectItem>
                      {instructors.map(u => <SelectItem key={u.id} value={u.name}>{u.name} ({u.role === "roshgad" ? "ראשגד" : u.role === "roshatz" ? "ראשצ" : "מדריך"})</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input placeholder="שם המדריך" value={form.assignedTo} onChange={e => setForm(p => ({ ...p, assignedTo: e.target.value }))} />
                )}
              </div>
            )}
            <div><label className="text-sm font-medium">תיאור</label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} /></div>
            <div><label className="text-sm font-medium">מטרות</label><Textarea value={form.goals} onChange={e => setForm(p => ({ ...p, goals: e.target.value }))} rows={2} /></div>
            <div><label className="text-sm font-medium">חומרים דרושים</label><Textarea value={form.materials} onChange={e => setForm(p => ({ ...p, materials: e.target.value }))} rows={2} /></div>
            <div className="border rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium flex items-center gap-2"><Paperclip className="w-4 h-4" /> צרף קובץ (PDF, תמונה עד 5MB)</p>
              <input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={handleFileChange} />
              <Button variant="outline" size="sm" className="w-full" onClick={() => fileRef.current?.click()} disabled={fileLoading}>
                {fileLoading ? "טוען..." : form.fileName ? `קובץ: ${form.fileName}` : "בחר קובץ"}
              </Button>
              {form.fileName && (
                <Button variant="ghost" size="sm" className="text-destructive text-xs w-full" onClick={() => setForm(p => ({ ...p, fileUrl: "", fileName: "" }))}>
                  הסר קובץ
                </Button>
              )}
            </div>
            <Button className="w-full" onClick={handleSubmit} disabled={!form.title}>
              {editingId ? "שמור" : "שמור כטיוטה"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Track Create/Edit Dialog */}
      <Dialog open={trackOpen} onOpenChange={setTrackOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingTrackId ? "עריכת מסלול" : "פתיחת מסלול חדש"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">שם המסלול</label>
              <Input placeholder="למשל: מסלול ערכי, מסלול הכשרה..." value={trackForm.title} onChange={e => setTrackForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">תיאור</label>
              <Textarea placeholder="מה המטרות של המסלול..." value={trackForm.description} onChange={e => setTrackForm(p => ({ ...p, description: e.target.value }))} rows={3} />
            </div>
            <div>
              <label className="text-sm font-medium">שכבת יעד</label>
              <Select value={trackForm.gradeLevel} onValueChange={v => setTrackForm(p => ({ ...p, gradeLevel: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{GRADE_LEVELS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={() => {
              if (editingTrackId) {
                updateTrack.mutate({ id: editingTrackId, data: trackForm });
              } else {
                createTrack.mutate({ ...trackForm, createdBy: user?.name || "לא ידוע" });
              }
            }} disabled={!trackForm.title}>
              {editingTrackId ? "שמור שינויים" : "פתח מסלול"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>הטלת פעולה</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">הטל על</label>
              {instructors.length > 0 ? (
                <Select value={assignTo} onValueChange={setAssignTo}>
                  <SelectTrigger><SelectValue placeholder="בחר מדריך / ראשגד" /></SelectTrigger>
                  <SelectContent>
                    {roshgadim.length > 0 && <SelectItem value="" disabled className="font-bold text-xs text-muted-foreground">ראשגדים</SelectItem>}
                    {roshgadim.map(u => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                    {madrichim.length > 0 && <SelectItem value="" disabled className="font-bold text-xs text-muted-foreground">מדריכים</SelectItem>}
                    {madrichim.map(u => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input placeholder="שם המדריך" value={assignTo} onChange={e => setAssignTo(e.target.value)} />
              )}
            </div>
            {activeTracks.length > 0 && (
              <div>
                <label className="text-sm font-medium">מסלול (אופציונלי)</label>
                <Select value={assignTrackId} onValueChange={setAssignTrackId}>
                  <SelectTrigger><SelectValue placeholder="ללא מסלול" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">ללא מסלול</SelectItem>
                    {activeTracks.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">סוג פעולה</label>
              <Select value={assignType} onValueChange={setAssignType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACTIVITY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">שכבה</label>
              <Select value={assignGrade} onValueChange={setAssignGrade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{GRADE_LEVELS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">תאריך יעד</label>
              <Input type="date" value={assignDue} onChange={e => setAssignDue(e.target.value)} />
            </div>
            <Button className="w-full" onClick={handleAssign} disabled={!assignTo}>
              הטל פעולה
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Requirement Dialog (מרכז צעיר → ראשגד) */}
      <Dialog open={requirementOpen} onOpenChange={setRequirementOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>שלח דרישת פעולה לראשגד</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {activeTracks.length > 0 && (
              <div>
                <label className="text-sm font-medium">מסלול</label>
                <Select value={requirementTrackId ? String(requirementTrackId) : ""} onValueChange={v => setRequirementTrackId(parseInt(v))}>
                  <SelectTrigger><SelectValue placeholder="בחר מסלול" /></SelectTrigger>
                  <SelectContent>
                    {activeTracks.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">ראשגד</label>
              {roshgadim.length > 0 ? (
                <Select value={requirementAssignTo} onValueChange={setRequirementAssignTo}>
                  <SelectTrigger><SelectValue placeholder="בחר ראשגד" /></SelectTrigger>
                  <SelectContent>
                    {roshgadim.map(u => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input placeholder="שם הראשגד" value={requirementAssignTo} onChange={e => setRequirementAssignTo(e.target.value)} />
              )}
            </div>
            <div>
              <label className="text-sm font-medium">פירוט הדרישה</label>
              <Textarea placeholder="אילו פעולות נדרשות למסלול, נושאים, מטרות..." value={requirementText} onChange={e => setRequirementText(e.target.value)} rows={4} />
            </div>
            <Button className="w-full" onClick={handleRequirementSend} disabled={!requirementAssignTo || !requirementText}>
              שלח דרישה
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={!!reviewId} onOpenChange={() => setReviewId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>סקירת פעולה: {reviewActivity?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {reviewActivity && (
              <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-1">
                {reviewActivity.description && <p><span className="font-medium">תיאור: </span>{reviewActivity.description}</p>}
                {reviewActivity.goals && <p><span className="font-medium">מטרות: </span>{reviewActivity.goals}</p>}
                {reviewActivity.materials && <p><span className="font-medium">חומרים: </span>{reviewActivity.materials}</p>}
              </div>
            )}
            <Textarea placeholder="הערות הסקירה (אופציונלי)" value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} rows={3} />
            <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={submitReview} disabled={updateActivity.isPending}>
              <ArrowRight className="w-4 h-4 ml-1" /> העבר למרכז לאישור
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Feedback Dialog */}
      <Dialog open={!!feedbackId} onOpenChange={() => setFeedbackId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>הוסף הערות ל: {feedbackActivity?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Textarea placeholder="כתוב הערות ותיקונים..." value={feedbackText} onChange={e => setFeedbackText(e.target.value)} rows={4} />
            <div>
              <label className="text-sm font-medium">סטטוס לאחר ההערות</label>
              <Select value={feedbackStatus} onValueChange={setFeedbackStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="feedback">החזר עם הערות</SelectItem>
                  <SelectItem value="approved">אשר עם הערות</SelectItem>
                  <SelectItem value="rejected">דחה</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={submitFeedback} disabled={updateActivity.isPending}>
              שלח הערות
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      {viewActivity && (
        <Dialog open={!!viewId} onOpenChange={() => setViewId(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {viewActivity.title}
                <Badge variant="outline" className={`text-xs ${STATUS_CONFIG[viewActivity.status]?.color}`}>
                  {STATUS_CONFIG[viewActivity.status]?.label || viewActivity.status}
                </Badge>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[75vh] overflow-y-auto">
              {viewActivity.trackId && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-2 text-sm flex items-center gap-2">
                  <Route className="w-4 h-4 text-primary" />
                  <span className="font-medium">מסלול:</span>
                  <span>{tracks.find(t => t.id === viewActivity.trackId)?.title || "—"}</span>
                </div>
              )}

              <div className="bg-muted/30 rounded-xl p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">מסלול אישור</p>
                <div className="flex flex-col gap-2">
                  {[
                    { key: "draft",     label: "טיוטה",  desc: viewActivity.submittedBy ? `נוצר על ידי: ${viewActivity.submittedBy}` : "טרם הוגש" },
                    { key: "submitted", label: "הוגש",   desc: viewActivity.assignedTo ? `מוטל על: ${viewActivity.assignedTo}` : (viewActivity.submittedBy ? `הגיש: ${viewActivity.submittedBy}` : "") },
                    { key: "reviewed",  label: "נסקר",   desc: viewActivity.reviewedBy ? `סקר: ${viewActivity.reviewedBy}${viewActivity.reviewNotes ? ` — ${viewActivity.reviewNotes}` : ""}` : "ממתין לסקירת ראשגד" },
                    { key: "approved",  label: "אושר",   desc: "אושר על ידי מרכז" },
                  ].map((step, i) => {
                    const currentStep = STATUS_CONFIG[viewActivity.status]?.step || 1;
                    const stepNum = STATUS_CONFIG[step.key]?.step || 1;
                    const isDone = currentStep > stepNum;
                    const isCurrent = viewActivity.status === step.key ||
                      (step.key === "submitted" && (viewActivity.status === "feedback" || viewActivity.status === "rejected"));
                    return (
                      <div key={step.key} className={`flex items-start gap-3 p-2 rounded-lg ${isCurrent ? "bg-primary/10 border border-primary/20" : ""}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${isDone ? "bg-green-500 text-white" : isCurrent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          {isDone ? "✓" : i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${isCurrent ? "text-foreground" : isDone ? "text-muted-foreground line-through" : "text-muted-foreground opacity-50"}`}>{step.label}</p>
                          {(isCurrent || isDone) && step.desc && <p className="text-xs text-muted-foreground truncate">{step.desc}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                {viewActivity.gradeLevel && (
                  <div className="flex gap-2 text-sm">
                    <span className="font-medium text-muted-foreground">שכבה:</span>
                    <span>{GRADE_LEVELS.find(g => g.value === viewActivity.gradeLevel)?.label || viewActivity.gradeLevel}</span>
                  </div>
                )}
                {viewActivity.date && (
                  <div className="flex gap-2 text-sm">
                    <span className="font-medium text-muted-foreground">תאריך:</span>
                    <span>{new Date(viewActivity.date).toLocaleDateString("he-IL")}</span>
                  </div>
                )}
                {viewActivity.duration && (
                  <div className="flex gap-2 text-sm">
                    <span className="font-medium text-muted-foreground">משך:</span>
                    <span>{viewActivity.duration}</span>
                  </div>
                )}
                {viewActivity.description && <div><p className="text-xs font-semibold text-muted-foreground uppercase mb-1">תיאור</p><p className="text-sm">{viewActivity.description}</p></div>}
                {viewActivity.goals && <div><p className="text-xs font-semibold text-muted-foreground uppercase mb-1">מטרות</p><p className="text-sm">{viewActivity.goals}</p></div>}
                {viewActivity.materials && <div><p className="text-xs font-semibold text-muted-foreground uppercase mb-1">חומרים דרושים</p><p className="text-sm">{viewActivity.materials}</p></div>}
              </div>

              {viewActivity.reviewNotes && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm">
                  <p className="font-medium text-purple-800 text-xs mb-1 flex items-center gap-1"><Eye className="w-3 h-3" /> הערות סקירה מ{viewActivity.reviewedBy}:</p>
                  <p className="text-purple-700">{viewActivity.reviewNotes}</p>
                </div>
              )}
              {viewActivity.feedback && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                  <p className="font-medium text-amber-800 text-xs mb-1 flex items-center gap-1"><MessageSquare className="w-3 h-3" /> הערות מרכז מ{viewActivity.feedbackBy}:</p>
                  <p className="text-amber-700">{viewActivity.feedback}</p>
                </div>
              )}

              {(viewActivity.fileData || viewActivity.fileUrl) && (
                <Button variant="outline" className="w-full gap-2" onClick={() => downloadFile(viewActivity)}>
                  <Download className="w-4 h-4" /> הורד קובץ מצורף
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
