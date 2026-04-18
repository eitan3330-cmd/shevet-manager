import { useState, useRef } from "react";
import { useListBudgetItems, useGetBudgetSummary, useCreateBudgetItem, useUpdateBudgetItem, useDeleteBudgetItem, getListBudgetItemsQueryKey, getGetBudgetSummaryQueryKey, useListEvents } from "@/lib/api-hooks";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ArrowUpRight, ArrowDownRight, TrendingUp, Filter, Upload, Target, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const budgetItemSchema = z.object({
  title: z.string().min(2, "כותרת חובה"),
  description: z.string().optional().nullable(),
  amount: z.coerce.number().positive("סכום חייב להיות חיובי"),
  type: z.string().min(1, "סוג חובה"),
  category: z.string().optional().nullable(),
  eventId: z.coerce.number().optional().nullable(),
  date: z.string().optional().nullable(),
});

const annualBudgetSchema = z.object({
  yearLabel: z.string().min(1, "שם שנה חובה"),
  totalBudget: z.coerce.number().min(0, "תקציב חייב להיות חיובי"),
  notes: z.string().optional().nullable(),
});

type BudgetItemFormValues = z.infer<typeof budgetItemSchema>;
type AnnualBudgetFormValues = z.infer<typeof annualBudgetSchema>;

const BUDGET_CATEGORIES = [
  "הסעות", "ציוד", "מזון", "לינה", "פינוי", "מדריכים",
  "דלק", "כיבוד", "הדרכה", "פרסום", "כלים", "אחר",
];

export function Budget() {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAnnualDialogOpen, setIsAnnualDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: budgetItems, isLoading: itemsLoading } = useListBudgetItems();
  const { data: budgetSummary, isLoading: summaryLoading } = useGetBudgetSummary();
  const { data: events } = useListEvents();

  const { data: annualBudget, isLoading: annualLoading } = useQuery({
    queryKey: ["annual-budget"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/annual-budget`);
      return res.json();
    },
  });

  const saveAnnualBudget = useMutation({
    mutationFn: async (data: AnnualBudgetFormValues) => {
      const url = annualBudget?.id
        ? `${API_BASE}/api/annual-budget/${annualBudget.id}`
        : `${API_BASE}/api/annual-budget`;
      const method = annualBudget?.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("שגיאה");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["annual-budget"] });
      toast({ title: "תקציב שנתי עודכן" });
      setIsAnnualDialogOpen(false);
    },
  });

  const createBudgetItem = useCreateBudgetItem();
  const updateBudgetItem = useUpdateBudgetItem();
  const deleteBudgetItem = useDeleteBudgetItem();

  const form = useForm<BudgetItemFormValues>({
    resolver: zodResolver(budgetItemSchema),
    defaultValues: { title: "", amount: 0, type: "expense", category: "", eventId: null, date: new Date().toISOString().split('T')[0] },
  });

  const annualForm = useForm<AnnualBudgetFormValues>({
    resolver: zodResolver(annualBudgetSchema),
    defaultValues: {
      yearLabel: annualBudget?.yearLabel || 'תשפ"ה',
      totalBudget: annualBudget ? parseFloat(annualBudget.totalBudget) : 0,
      notes: annualBudget?.notes || "",
    },
  });

  const onSubmit = (data: BudgetItemFormValues) => {
    const submitData = {
      ...data,
      date: data.date ? new Date(data.date).toISOString() : null,
      eventId: data.eventId ? Number(data.eventId) : null,
    };
    if (editingId) {
      updateBudgetItem.mutate({ id: editingId, data: submitData }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBudgetItemsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetBudgetSummaryQueryKey() });
          setIsDialogOpen(false);
          toast({ title: "תנועה עודכנה" });
        },
      });
    } else {
      createBudgetItem.mutate({ data: submitData }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBudgetItemsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetBudgetSummaryQueryKey() });
          setIsDialogOpen(false);
          toast({ title: "תנועה נוספה" });
        },
      });
    }
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    form.reset({
      title: item.title, description: item.description || "", amount: parseFloat(item.amount),
      type: item.type, category: item.category || "", eventId: item.eventId || null,
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("למחוק תנועה זו?")) {
      deleteBudgetItem.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBudgetItemsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetBudgetSummaryQueryKey() });
          toast({ title: "תנועה נמחקה" });
        },
      });
    }
  };

  const openNew = (type: "income" | "expense" = "expense") => {
    setEditingId(null);
    form.reset({ title: "", amount: 0, type, category: "", eventId: null, date: new Date().toISOString().split('T')[0] });
    setIsDialogOpen(true);
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const { read, utils } = await import("xlsx");
      const ab = await file.arrayBuffer();
      const wb = read(ab);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = utils.sheet_to_json(ws, { header: 1 });

      if (rows.length < 2) throw new Error("הקובץ ריק");

      const header = rows[0].map((h: any) => String(h || "").trim().toLowerCase());
      const getCol = (names: string[]) => header.findIndex((h: string) => names.some(n => h.includes(n)));

      const colTitle = getCol(["כותרת", "title", "שם", "name", "תיאור"]);
      const colAmount = getCol(["סכום", "amount", "עלות", "cost"]);
      const colType = getCol(["סוג", "type", "הכנסה", "הוצאה"]);
      const colCategory = getCol(["קטגוריה", "category", "מדור"]);
      const colDate = getCol(["תאריך", "date"]);

      let imported = 0;
      for (const row of rows.slice(1)) {
        if (!row || !row[colTitle] || !row[colAmount]) continue;
        const typeRaw = String(row[colType] || "").trim();
        const type = typeRaw.includes("הכנס") ? "income" : "expense";
        const amount = parseFloat(String(row[colAmount]).replace(/[^\d.]/g, ""));
        if (isNaN(amount) || amount <= 0) continue;

        await new Promise<void>((resolve, reject) => {
          createBudgetItem.mutate(
            {
              data: {
                title: String(row[colTitle]).trim(),
                amount,
                type,
                category: colCategory >= 0 ? String(row[colCategory] || "").trim() : null,
                date: colDate >= 0 && row[colDate] ? new Date(row[colDate]).toISOString() : null,
              }
            },
            { onSuccess: () => { imported++; resolve(); }, onError: reject }
          );
        });
      }

      queryClient.invalidateQueries({ queryKey: getListBudgetItemsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetBudgetSummaryQueryKey() });
      toast({ title: `יובאו ${imported} שורות מהאקסל בהצלחה` });
    } catch (err: any) {
      toast({ title: "שגיאה ביבוא", description: err?.message || "בדוק את הקובץ", variant: "destructive" });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filteredItems = budgetItems?.filter(item => {
    const matchesCat = categoryFilter === "all" || item.category === categoryFilter;
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    return matchesCat && matchesType;
  });

  const uniqueCategories = Array.from(new Set(budgetItems?.filter(i => i.category).map(i => i.category) || []));
  const totalBudget = annualBudget ? parseFloat(annualBudget.totalBudget) : 0;
  const spent = budgetSummary?.totalExpenses || 0;
  const spentPct = totalBudget > 0 ? Math.min((spent / totalBudget) * 100, 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">תקציב</h2>
          <p className="text-muted-foreground">מעקב הכנסות והוצאות + תקציב שנתי</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelImport} />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            <Upload className="w-4 h-4 ml-2" />
            {isImporting ? "מייבא..." : "ייבוא מאקסל"}
          </Button>
          <Button variant="outline" className="text-green-700 border-green-200 hover:bg-green-50" onClick={() => openNew("income")}>
            <ArrowUpRight className="ml-2 w-4 h-4" />הכנסה
          </Button>
          <Button onClick={() => openNew("expense")}>
            <ArrowDownRight className="ml-2 w-4 h-4" />הוצאה
          </Button>
        </div>
      </div>

      {annualLoading ? null : (
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                תקציב שנתי {annualBudget?.yearLabel || ""}
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => {
                annualForm.reset({
                  yearLabel: annualBudget?.yearLabel || 'תשפ"ה',
                  totalBudget: annualBudget ? parseFloat(annualBudget.totalBudget) : 0,
                  notes: annualBudget?.notes || "",
                });
                setIsAnnualDialogOpen(true);
              }}>
                <Settings className="w-3.5 h-3.5" /> הגדר תקציב
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {totalBudget > 0 ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">הוצא: <span className="font-semibold text-foreground">₪{spent.toLocaleString()}</span></span>
                  <span className="text-muted-foreground">יעד: <span className="font-semibold text-foreground">₪{totalBudget.toLocaleString()}</span></span>
                </div>
                <Progress value={spentPct} className={`h-3 ${spentPct > 90 ? "[&>div]:bg-red-500" : spentPct > 70 ? "[&>div]:bg-amber-500" : "[&>div]:bg-primary"}`} />
                <p className="text-xs text-muted-foreground">
                  {spentPct.toFixed(0)}% מהתקציב נוצל · נותר: ₪{(totalBudget - spent).toLocaleString()}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">לחץ "הגדר תקציב" כדי להגדיר יעד תקציבי שנתי</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">יתרה <TrendingUp className="w-4 h-4 text-muted-foreground" /></CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? <Skeleton className="h-8 w-24" /> : (
              <div className={`text-2xl font-bold ${budgetSummary && budgetSummary.balance < 0 ? "text-destructive" : "text-primary"}`}>
                ₪{(budgetSummary?.balance || 0).toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">הכנסות <ArrowUpRight className="w-4 h-4 text-green-500" /></CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-bold text-green-600">₪{(budgetSummary?.totalIncome || 0).toLocaleString()}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">הוצאות <ArrowDownRight className="w-4 h-4 text-destructive" /></CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-bold text-destructive">₪{(budgetSummary?.totalExpenses || 0).toLocaleString()}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3 items-center bg-muted/30 p-3 rounded-lg border text-sm">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px] bg-background h-8">
            <SelectValue placeholder="סוג" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכל</SelectItem>
            <SelectItem value="income">הכנסות</SelectItem>
            <SelectItem value="expense">הוצאות</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px] bg-background h-8">
            <SelectValue placeholder="קטגוריה" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הקטגוריות</SelectItem>
            {uniqueCategories.map(c => <SelectItem key={String(c)} value={String(c)}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground mr-auto">{filteredItems?.length || 0} תנועות</span>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>תאריך</TableHead>
              <TableHead>כותרת</TableHead>
              <TableHead>קטגוריה</TableHead>
              <TableHead>מפעל</TableHead>
              <TableHead className="text-left">סכום</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itemsLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                </TableRow>
              ))
            ) : filteredItems?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  אין תנועות תקציב. הוסף ידנית או ייבא מאקסל.
                </TableCell>
              </TableRow>
            ) : (
              filteredItems?.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
                    {item.date ? new Date(item.date).toLocaleDateString('he-IL') : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{item.title}</div>
                    {item.description && <div className="text-xs text-muted-foreground truncate max-w-xs">{item.description}</div>}
                  </TableCell>
                  <TableCell>{item.category ? <Badge variant="secondary" className="text-xs">{item.category}</Badge> : "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.eventId ? events?.find(e => e.id === item.eventId)?.name || `#${item.eventId}` : "—"}
                  </TableCell>
                  <TableCell className={`text-left font-semibold ${item.type === "income" ? "text-green-600" : "text-red-600"}`} dir="ltr">
                    {item.type === "expense" ? "-" : "+"}₪{parseFloat(String(item.amount)).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(item)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "עריכת תנועה" : "תנועה חדשה"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>סוג</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="income">הכנסה</SelectItem>
                        <SelectItem value="expense">הוצאה</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>תאריך</FormLabel>
                    <FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl>
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>כותרת *</FormLabel>
                  <FormControl><Input placeholder="תשלום אוטובוסים..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>סכום (₪) *</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>קטגוריה</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl><SelectTrigger><SelectValue placeholder="בחר..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="">ללא קטגוריה</SelectItem>
                        {BUDGET_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="eventId" render={({ field }) => (
                <FormItem>
                  <FormLabel>שיוך למפעל</FormLabel>
                  <Select onValueChange={v => field.onChange(v === "none" ? null : parseInt(v))} value={field.value ? String(field.value) : "none"}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">ללא מפעל</SelectItem>
                      {events?.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={createBudgetItem.isPending || updateBudgetItem.isPending}>
                {editingId ? "שמור שינויים" : "שמור תנועה"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAnnualDialogOpen} onOpenChange={setIsAnnualDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>הגדרת תקציב שנתי</DialogTitle>
          </DialogHeader>
          <Form {...annualForm}>
            <form onSubmit={annualForm.handleSubmit(d => saveAnnualBudget.mutate(d))} className="space-y-4">
              <FormField control={annualForm.control} name="yearLabel" render={({ field }) => (
                <FormItem>
                  <FormLabel>שנה</FormLabel>
                  <FormControl><Input placeholder='תשפ"ה' {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={annualForm.control} name="totalBudget" render={({ field }) => (
                <FormItem>
                  <FormLabel>תקציב שנתי כולל (₪)</FormLabel>
                  <FormControl><Input type="number" min="0" step="100" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={annualForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>הערות</FormLabel>
                  <FormControl><Textarea {...field} value={field.value || ""} rows={2} className="resize-none" /></FormControl>
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={saveAnnualBudget.isPending}>
                שמור תקציב שנתי
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
