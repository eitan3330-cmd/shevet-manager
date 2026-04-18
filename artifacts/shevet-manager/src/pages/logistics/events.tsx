import { useState } from "react";
import { useLocation } from "wouter";
import { useListEvents, useCreateEvent, useUpdateEvent, useDeleteEvent, getListEventsQueryKey } from "@/lib/api-hooks";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Tent, Mountain, Waves, MapPin, Filter, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const EVENT_TYPES = [
  { value: "shabaton", label: "שבתון" },
  { value: "mifaal_yomi", label: "מפעל יומי" },
  { value: "erev", label: "ערב" },
  { value: "machaneh_kayitz", label: "מחנה קיץ" },
  { value: "machaneh_choref", label: "מחנה חורף" },
  { value: "tiyul", label: "טיול" },
  { value: "peilut_shvatit", label: "פעילות שבטית" },
  { value: "akira", label: "עקירה" },
  { value: "other", label: "אחר" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  upcoming: { label: "עתידי", color: "text-blue-600 border-blue-300 bg-blue-50" },
  active: { label: "פעיל", color: "text-green-700 border-green-300 bg-green-50" },
  completed: { label: "הסתיים", color: "text-slate-600 border-slate-300 bg-slate-50" },
  cancelled: { label: "בוטל", color: "text-red-600 border-red-300 bg-red-50" },
};

const TYPE_ICON_COLORS: Record<string, string> = {
  machaneh_kayitz: "bg-amber-500", machaneh_choref: "bg-blue-600",
  tiyul: "bg-green-600", shabaton: "bg-purple-600",
  erev: "bg-indigo-600", mifaal_yomi: "bg-sky-500",
  peilut_shvatit: "bg-red-600", akira: "bg-rose-500", other: "bg-slate-500",
};

const eventSchema = z.object({
  name: z.string().min(2, "שם המפעל חובה"),
  eventType: z.string().min(1, "סוג מפעל חובה"),
  category: z.string().min(1, "קטגוריה חובה"),
  status: z.string().min(1, "סטטוס חובה"),
  date: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  responsiblePerson: z.string().optional().nullable(),
  participantsCount: z.coerce.number().optional().nullable(),
  budgetAllocated: z.coerce.number().optional().nullable(),
  actualCost: z.coerce.number().optional().nullable(),
  transportNeeded: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
type EventFormValues = z.infer<typeof eventSchema>;

export function Events() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [, setLocation] = useLocation();

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: events, isLoading } = useListEvents();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: { name: "", eventType: "shabaton", category: "hadracha", status: "upcoming" },
  });

  const onSubmit = (data: EventFormValues) => {
    const submitData = {
      ...data,
      date: data.date ? new Date(data.date).toISOString() : null,
      endDate: data.endDate ? new Date(data.endDate).toISOString() : null,
      participantsCount: data.participantsCount || null,
      budgetAllocated: data.budgetAllocated || null,
      actualCost: data.actualCost || null,
    };
    if (editingId) {
      updateEvent.mutate({ id: editingId, data: submitData }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() }); setIsDialogOpen(false); toast({ title: "מפעל עודכן" }); },
      });
    } else {
      createEvent.mutate({ data: submitData }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() }); setIsDialogOpen(false); form.reset(); toast({ title: "מפעל נוצר" }); },
      });
    }
  };

  const handleEdit = (event: any) => {
    setEditingId(event.id);
    form.reset({
      name: event.name, eventType: event.eventType || "other",
      category: event.category || "hadracha", status: event.status,
      date: event.date ? new Date(event.date).toISOString().split("T")[0] : "",
      endDate: event.endDate ? new Date(event.endDate).toISOString().split("T")[0] : "",
      location: event.location || "", responsiblePerson: event.responsiblePerson || "",
      participantsCount: event.participantsCount || null, budgetAllocated: event.budgetAllocated ? parseFloat(event.budgetAllocated) : null,
      actualCost: event.actualCost ? parseFloat(event.actualCost) : null, transportNeeded: event.transportNeeded || "",
      description: event.description || "", notes: event.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("למחוק מפעל זה?")) {
      deleteEvent.mutate({ id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() }); toast({ title: "מפעל נמחק" }); } });
    }
  };

  const openNew = () => { setEditingId(null); form.reset({ name: "", eventType: "shabaton", category: "hadracha", status: "upcoming" }); setIsDialogOpen(true); };

  const filteredEvents = events?.filter(e => {
    const matchesStatus = statusFilter === "all" || e.status === statusFilter;
    const matchesType = typeFilter === "all" || (e as any).eventType === typeFilter;
    return matchesStatus && matchesType;
  }) || [];

  const stats = {
    total: events?.length || 0,
    upcoming: events?.filter(e => e.status === "upcoming").length || 0,
    completed: events?.filter(e => e.status === "completed").length || 0,
    totalBudget: events?.reduce((s, e) => s + (e.budgetAllocated ? parseFloat(String(e.budgetAllocated)) : 0), 0) || 0,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold">המפעלים שלנו</h2>
          <p className="text-muted-foreground">בחר מפעל לכניסה ועבודה עליו</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" /> מפעל חדש
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "עריכת מפעל" : "מפעל חדש"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>שם המפעל *</FormLabel><FormControl><Input placeholder="מחנה קיץ תשפ״ה..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-3 gap-3">
                  <FormField control={form.control} name="eventType" render={({ field }) => (
                    <FormItem><FormLabel>סוג מפעל *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem><FormLabel>מדור</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="hadracha">הדרכה</SelectItem>
                          <SelectItem value="logistics">לוגיסטיקה</SelectItem>
                          <SelectItem value="combined">משולב</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem><FormLabel>סטטוס</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="upcoming">עתידי</SelectItem>
                          <SelectItem value="active">פעיל</SelectItem>
                          <SelectItem value="completed">הסתיים</SelectItem>
                          <SelectItem value="cancelled">בוטל</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="date" render={({ field }) => (
                    <FormItem><FormLabel>תאריך התחלה</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="endDate" render={({ field }) => (
                    <FormItem><FormLabel>תאריך סיום</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="location" render={({ field }) => (
                    <FormItem><FormLabel>מיקום</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="responsiblePerson" render={({ field }) => (
                    <FormItem><FormLabel>אחראי מפעל</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <FormField control={form.control} name="participantsCount" render={({ field }) => (
                    <FormItem><FormLabel>מספר משתתפים</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="budgetAllocated" render={({ field }) => (
                    <FormItem><FormLabel>תקציב (₪)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="actualCost" render={({ field }) => (
                    <FormItem><FormLabel>עלות בפועל (₪)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>תיאור</FormLabel><FormControl><Textarea {...field} value={field.value || ""} rows={2} className="resize-none" /></FormControl></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createEvent.isPending || updateEvent.isPending}>
                  {editingId ? "שמור שינויים" : "צור מפעל"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "סה״כ מפעלים", value: stats.total },
          { label: "עתידיים", value: stats.upcoming, color: "text-blue-600" },
          { label: "הסתיימו", value: stats.completed, color: "text-slate-600" },
          { label: "תקציב כולל", value: `₪${stats.totalBudget.toLocaleString()}`, color: "text-red-600" },
        ].map(s => (
          <Card key={s.label}><CardContent className="pt-4 pb-3 text-center">
            <p className={`text-2xl font-bold ${s.color || ""}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 bg-background h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            <SelectItem value="upcoming">עתידי</SelectItem>
            <SelectItem value="active">פעיל</SelectItem>
            <SelectItem value="completed">הסתיים</SelectItem>
            <SelectItem value="cancelled">בוטל</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44 bg-background h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסוגים</SelectItem>
            {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filteredEvents.length} מפעלים</span>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-2xl">
          <Tent className="w-14 h-14 mx-auto mb-3 opacity-20" />
          <p className="font-medium text-lg">אין מפעלים עדיין</p>
          <p className="text-sm">לחץ "מפעל חדש" להוספה</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredEvents.map(event => {
            const e = event as any;
            const iconColor = TYPE_ICON_COLORS[e.eventType] || "bg-slate-500";
            const status = STATUS_CONFIG[event.status] || { label: event.status, color: "" };
            const typeName = EVENT_TYPES.find(t => t.value === e.eventType)?.label || e.eventType;
            return (
              <div
                key={event.id}
                className="relative bg-card border rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer overflow-hidden"
                onClick={() => setLocation(`/logistics/events/${event.id}`)}
              >
                <div className="h-1 bg-gradient-to-l from-red-500 via-blue-600 to-blue-700" />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-1.5 mt-0.5">
                      <button
                        onClick={ev => { ev.stopPropagation(); handleEdit(event); }}
                        className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={ev => handleDelete(event.id, ev)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className={`${iconColor} rounded-2xl p-3 shrink-0`}>
                      <Tent className="w-8 h-8 text-white" />
                    </div>
                  </div>

                  <div className="mt-4 text-right">
                    <div className="flex items-center justify-end gap-2 mb-1.5">
                      <Badge variant="outline" className={`text-xs ${status.color}`}>{status.label}</Badge>
                      <span className="text-xs text-muted-foreground">{typeName}</span>
                    </div>
                    <h3 className="text-xl font-bold leading-tight">{event.name}</h3>
                    {event.description && (
                      <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{event.description}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                    <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      {event.date && <span>{new Date(event.date).toLocaleDateString('he-IL')}</span>}
                      {e.location && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{e.location}</span>}
                      {e.participantsCount && <span>{e.participantsCount} משתתפים</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
