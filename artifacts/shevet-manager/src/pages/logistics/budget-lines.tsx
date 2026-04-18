import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, TrendingDown, TrendingUp, Target, FileSpreadsheet, Upload, Lock, ChevronDown, ChevronLeft, Search, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { useAppSettings } from "@/lib/api-hooks";
import * as XLSX from "xlsx";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type BudgetLine = {
  id: number; yearLabel: string; category: string; description?: string; accountCode?: string;
  allocatedAmount: number; updatedBudget?: number | null; spentAmount: number;
  openOrders?: number | null; totalExecution?: number | null; lastYearAmount?: number | null;
  notes?: string;
};

type LineForm = {
  yearLabel: string; category: string; description: string; accountCode: string;
  allocatedAmount: string; updatedBudget: string; spentAmount: string;
  openOrders: string; totalExecution: string; lastYearAmount: string; notes: string;
};

const EMPTY_FORM: LineForm = {
  yearLabel: "תשפ\"ו", category: "", description: "", accountCode: "",
  allocatedAmount: "", updatedBudget: "", spentAmount: "0",
  openOrders: "", totalExecution: "", lastYearAmount: "", notes: "",
};

function parseExcelNumber(val: unknown): number {
  if (val == null || val === "") return 0;
  const n = typeof val === "number" ? val : parseFloat(String(val));
  return isNaN(n) ? 0 : n;
}

function extractCategoryName(raw: string): string {
  if (!raw) return "";
  const match = raw.match(/^\d+\s*-\s*(.+)$/);
  return match ? match[1].trim() : raw.trim();
}

function extractAccountParts(raw: string): { code: string; name: string } {
  if (!raw) return { code: "", name: "" };
  const match = raw.match(/^(\d+)-(.+)$/);
  return match ? { code: match[1].trim(), name: match[2].trim() } : { code: "", name: raw.trim() };
}

function fmt(n: number): string {
  return n.toLocaleString("he-IL", { maximumFractionDigits: 0 });
}

export function BudgetLines() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<LineForm>(EMPTY_FORM);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: lines = [], isLoading } = useQuery<BudgetLine[]>({
    queryKey: ["budget-lines"],
    queryFn: () => fetch(`${API_BASE}/api/budget-lines`).then(r => r.json()),
  });

  const createLine = useMutation({
    mutationFn: (data: any) => fetch(`${API_BASE}/api/budget-lines`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["budget-lines"] }); setIsOpen(false); setForm(EMPTY_FORM); toast({ title: "סעיף נוסף" }); },
  });

  const updateLine = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => fetch(`${API_BASE}/api/budget-lines/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["budget-lines"] }); setIsOpen(false); toast({ title: "סעיף עודכן" }); },
  });

  const deleteLine = useMutation({
    mutationFn: (id: number) => fetch(`${API_BASE}/api/budget-lines/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["budget-lines"] }); toast({ title: "סעיף נמחק" }); },
  });

  const handleEdit = (line: BudgetLine) => {
    setEditingId(line.id);
    setForm({
      yearLabel: line.yearLabel, category: line.category, description: line.description || "",
      accountCode: line.accountCode || "",
      allocatedAmount: String(line.allocatedAmount),
      updatedBudget: line.updatedBudget != null ? String(line.updatedBudget) : "",
      spentAmount: String(line.spentAmount),
      openOrders: line.openOrders != null ? String(line.openOrders) : "",
      totalExecution: line.totalExecution != null ? String(line.totalExecution) : "",
      lastYearAmount: line.lastYearAmount != null ? String(line.lastYearAmount) : "",
      notes: line.notes || "",
    });
    setIsOpen(true);
  };

  const handleSubmit = () => {
    const data = {
      yearLabel: form.yearLabel, category: form.category,
      description: form.description || null,
      accountCode: form.accountCode || null,
      allocatedAmount: parseFloat(form.allocatedAmount) || 0,
      updatedBudget: form.updatedBudget ? parseFloat(form.updatedBudget) : null,
      spentAmount: parseFloat(form.spentAmount) || 0,
      openOrders: form.openOrders ? parseFloat(form.openOrders) : null,
      totalExecution: form.totalExecution ? parseFloat(form.totalExecution) : null,
      lastYearAmount: form.lastYearAmount ? parseFloat(form.lastYearAmount) : null,
      notes: form.notes || null,
    };
    if (editingId) updateLine.mutate({ id: editingId, data });
    else createLine.mutate(data);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        let headerIdx = rows.findIndex((r: any[]) =>
          r.some((c: string) => typeof c === "string" && (c.includes("סעיף תקציבי") || c.includes("קטגוריה")))
        );

        if (headerIdx >= 0 && rows[headerIdx]?.some((c: string) => typeof c === "string" && c.includes("סעיף תקציבי"))) {
          const mapped = parseTzofinetFormat(rows, headerIdx);
          setImportRows(mapped);
          setImportOpen(true);
          e.target.value = "";
          return;
        }

        const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (!json.length) { toast({ title: "הקובץ ריק", variant: "destructive" }); e.target.value = ""; return; }

        const COL_MAP: Record<string, string> = {
          "קטגוריה": "category", "סעיף": "category",
          "תיאור": "description",
          "תקציב": "allocatedAmount", "תקציב מוקצה": "allocatedAmount",
          "הוצאה": "spentAmount", "הוצאה בפועל": "spentAmount",
          "שנה שעברה": "lastYearAmount",
          "הערות": "notes",
        };

        const mapped = json.map(row => {
          const r: any = {};
          for (const [heb, eng] of Object.entries(COL_MAP)) {
            if (row[heb] !== undefined) r[eng] = row[heb];
          }
          return r;
        }).filter(r => r.category);

        setImportRows(mapped);
        setImportOpen(true);
      } catch {
        toast({ title: "שגיאה בקריאת הקובץ", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const parseTzofinetFormat = (rows: any[], headerIdx: number): any[] => {
    const result: any[] = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 3) continue;

      const rawCategory = row[1];
      const rawAccount = row[2];

      if (!rawCategory && !rawAccount) continue;
      if (typeof rawCategory === "string" && rawCategory.includes("Totals")) continue;

      const category = extractCategoryName(String(rawCategory || ""));
      const { code, name } = extractAccountParts(String(rawAccount || ""));

      if (!category && !name) continue;

      const budget = parseExcelNumber(row[3]);
      const updatedBudget = parseExcelNumber(row[4]);
      const spent = parseExcelNumber(row[5]);
      const orders = parseExcelNumber(row[6]);
      const totalExec = parseExcelNumber(row[7]);
      const notes1 = row[8] != null ? String(row[8]) : "";
      const notes2 = row[10] != null ? String(row[10]) : "";
      const allNotes = [notes1, notes2].filter(Boolean).join(" | ");

      result.push({
        category: category || name,
        description: name || category,
        accountCode: code,
        allocatedAmount: budget,
        updatedBudget: updatedBudget || null,
        spentAmount: spent,
        openOrders: orders || null,
        totalExecution: totalExec || null,
        notes: allNotes || null,
      });
    }
    return result;
  };

  const handleImportConfirm = async () => {
    setImportLoading(true);
    try {
      await fetch(`${API_BASE}/api/budget-lines/clear-all`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yearLabel: "תשפ\"ו" }),
      });

      const res = await fetch(`${API_BASE}/api/budget-lines/import-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: importRows, yearLabel: "תשפ\"ו" }),
      });
      const result = await res.json();
      qc.invalidateQueries({ queryKey: ["budget-lines"] });
      toast({ title: `ייבוא הושלם: ${result.added} סעיפים נוספו` });
      setImportOpen(false);
      setImportRows([]);
    } catch {
      toast({ title: "שגיאה בייבוא", variant: "destructive" });
    } finally {
      setImportLoading(false);
    }
  };

  const { planningBlocked } = useAppSettings();

  const safeLines = Array.isArray(lines) ? lines : [];

  const filteredLines = useMemo(() => {
    if (!searchTerm) return safeLines;
    const s = searchTerm.toLowerCase();
    return safeLines.filter(l =>
      l.category?.toLowerCase().includes(s) ||
      l.description?.toLowerCase().includes(s) ||
      l.accountCode?.toLowerCase().includes(s) ||
      l.notes?.toLowerCase().includes(s)
    );
  }, [safeLines, searchTerm]);

  const grouped = useMemo(() => {
    const map = new Map<string, BudgetLine[]>();
    for (const line of filteredLines) {
      const cat = line.category || "אחר";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(line);
    }
    return map;
  }, [filteredLines]);

  const totalBudget = safeLines.reduce((s, l) => s + (l.updatedBudget ?? l.allocatedAmount), 0);
  const totalSpent = safeLines.reduce((s, l) => s + l.spentAmount, 0);
  const totalOrders = safeLines.reduce((s, l) => s + (l.openOrders || 0), 0);
  const totalExec = safeLines.reduce((s, l) => s + (l.totalExecution ?? l.spentAmount), 0);

  const incomeLines = safeLines.filter(l => (l.updatedBudget ?? l.allocatedAmount) > 0);
  const expenseLines = safeLines.filter(l => (l.updatedBudget ?? l.allocatedAmount) < 0);
  const totalIncome = incomeLines.reduce((s, l) => s + (l.updatedBudget ?? l.allocatedAmount), 0);
  const totalExpense = Math.abs(expenseLines.reduce((s, l) => s + (l.updatedBudget ?? l.allocatedAmount), 0));

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  if (planningBlocked) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
        <Lock className="w-14 h-14 text-amber-500 opacity-70" />
        <h2 className="text-2xl font-bold">תכנון נעול</h2>
        <p className="text-muted-foreground max-w-sm">נתוני תכנון תקציב נעולים על ידי מרכז בוגר. פנה למרכז בוגר לפתיחת הגישה.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold">תקציב שבטי</h2>
          <p className="text-muted-foreground">סעיפי תקציב צופינט — {safeLines.length} סעיפים</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
            <FileSpreadsheet className="w-4 h-4" /> העלה תקציב מ-Excel
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} />
          <Button onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setIsOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> הוסף סעיף
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100"><TrendingUp className="w-5 h-5 text-green-600" /></div>
            <div><p className="text-xs text-muted-foreground">הכנסות</p><p className="text-lg font-bold text-green-700">₪{fmt(totalIncome)}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100"><TrendingDown className="w-5 h-5 text-red-600" /></div>
            <div><p className="text-xs text-muted-foreground">הוצאות</p><p className="text-lg font-bold text-red-700">₪{fmt(totalExpense)}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${totalBudget >= 0 ? "bg-blue-100" : "bg-amber-100"}`}>
              <Target className={`w-5 h-5 ${totalBudget >= 0 ? "text-blue-600" : "text-amber-600"}`} />
            </div>
            <div><p className="text-xs text-muted-foreground">מאזן תקציב</p><p className={`text-lg font-bold ${totalBudget >= 0 ? "text-blue-700" : "text-amber-700"}`}>₪{fmt(totalBudget)}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100"><AlertTriangle className="w-5 h-5 text-purple-600" /></div>
            <div><p className="text-xs text-muted-foreground">ביצוע בפועל</p><p className="text-lg font-bold text-purple-700">₪{fmt(Math.abs(totalExec))}</p></div>
          </div>
        </CardContent></Card>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="חיפוש סעיף, קטגוריה, חשבון..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pr-9"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">טוען...</div>
      ) : safeLines.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-xl">
          <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">אין סעיפי תקציב — העלה קובץ Excel מצופינט</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from(grouped.entries()).map(([category, catLines]) => {
            const isCollapsed = collapsedCategories.has(category);
            const catBudget = catLines.reduce((s, l) => s + (l.updatedBudget ?? l.allocatedAmount), 0);
            const catExec = catLines.reduce((s, l) => s + (l.totalExecution ?? l.spentAmount), 0);
            const isIncome = catBudget > 0;

            return (
              <div key={category} className="border rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors text-right"
                  onClick={() => toggleCategory(category)}
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? <ChevronLeft className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    <span className="font-semibold">{category}</span>
                    <span className="text-xs text-muted-foreground">({catLines.length} סעיפים)</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className={isIncome ? "text-green-700 font-medium" : "text-red-700 font-medium"}>
                      תקציב: ₪{fmt(catBudget)}
                    </span>
                    {catExec !== 0 && (
                      <span className="text-muted-foreground">
                        ביצוע: ₪{fmt(catExec)}
                      </span>
                    )}
                  </div>
                </button>
                {!isCollapsed && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/10 text-xs">
                        <th className="text-right p-2 font-medium w-16">חשבון</th>
                        <th className="text-right p-2 font-medium">תיאור</th>
                        <th className="text-left p-2 font-medium">תקציב</th>
                        <th className="text-left p-2 font-medium">עדכון</th>
                        <th className="text-left p-2 font-medium">ביצוע</th>
                        <th className="text-left p-2 font-medium">הזמנות</th>
                        <th className="text-left p-2 font-medium">סה״כ</th>
                        <th className="text-right p-2 font-medium max-w-[200px]">הערות</th>
                        <th className="p-2 w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {catLines.map((line, i) => {
                        const budget = line.updatedBudget ?? line.allocatedAmount;
                        const isIncLine = budget > 0;
                        return (
                          <tr key={line.id} className={`${i % 2 === 0 ? "bg-background" : "bg-muted/5"} hover:bg-muted/20 transition-colors`}>
                            <td className="p-2 text-xs text-muted-foreground font-mono">{line.accountCode || "—"}</td>
                            <td className="p-2 font-medium text-xs">{line.description || "—"}</td>
                            <td className={`p-2 text-left text-xs ${isIncLine ? "text-green-700" : "text-red-700"}`}>
                              ₪{fmt(line.allocatedAmount)}
                            </td>
                            <td className={`p-2 text-left text-xs font-medium ${isIncLine ? "text-green-700" : "text-red-700"}`}>
                              {line.updatedBudget != null ? `₪${fmt(line.updatedBudget)}` : "—"}
                            </td>
                            <td className="p-2 text-left text-xs">
                              {line.spentAmount !== 0 ? `₪${fmt(line.spentAmount)}` : "—"}
                            </td>
                            <td className="p-2 text-left text-xs text-muted-foreground">
                              {line.openOrders ? `₪${fmt(line.openOrders)}` : "—"}
                            </td>
                            <td className={`p-2 text-left text-xs font-medium ${(line.totalExecution ?? 0) > 0 ? "text-green-700" : (line.totalExecution ?? 0) < 0 ? "text-red-700" : ""}`}>
                              {line.totalExecution != null && line.totalExecution !== 0 ? `₪${fmt(line.totalExecution)}` : "—"}
                            </td>
                            <td className="p-2 text-xs text-muted-foreground max-w-[200px] truncate" title={line.notes || ""}>
                              {line.notes || "—"}
                            </td>
                            <td className="p-2">
                              <div className="flex gap-0.5">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEdit(line)}>
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => { if (confirm("למחוק?")) deleteLine.mutate(line.id); }}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? "עריכת סעיף" : "סעיף תקציבי חדש"}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">שנה</label>
                <Input value={form.yearLabel} onChange={e => setForm(p => ({ ...p, yearLabel: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">קוד חשבון</label>
                <Input placeholder="10109" value={form.accountCode} onChange={e => setForm(p => ({ ...p, accountCode: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">קטגוריה (סעיף תקציבי)</label>
              <Input placeholder="הכנסות והוצאות מסמינרים" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">תיאור (חשבון)</label>
              <Input placeholder="הוצאות סמינר פתיחת שנה" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">תקציב</label><Input type="number" value={form.allocatedAmount} onChange={e => setForm(p => ({ ...p, allocatedAmount: e.target.value }))} /></div>
              <div><label className="text-sm font-medium">עדכון תקציב</label><Input type="number" value={form.updatedBudget} onChange={e => setForm(p => ({ ...p, updatedBudget: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-sm font-medium">ביצוע בפועל</label><Input type="number" value={form.spentAmount} onChange={e => setForm(p => ({ ...p, spentAmount: e.target.value }))} /></div>
              <div><label className="text-sm font-medium">הזמנות פתוחות</label><Input type="number" value={form.openOrders} onChange={e => setForm(p => ({ ...p, openOrders: e.target.value }))} /></div>
              <div><label className="text-sm font-medium">סה״כ ביצוע</label><Input type="number" value={form.totalExecution} onChange={e => setForm(p => ({ ...p, totalExecution: e.target.value }))} /></div>
            </div>
            <div><label className="text-sm font-medium">הערות</label><Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
            <Button className="w-full" onClick={handleSubmit} disabled={!form.category || createLine.isPending || updateLine.isPending}>
              {editingId ? "שמור שינויים" : "הוסף סעיף"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={v => { if (!v) { setImportOpen(false); setImportRows([]); } }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Upload className="w-5 h-5" /> תצוגה מקדימה — ייבוא תקציב צופינט</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg text-blue-800 text-sm flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 shrink-0" />
              נמצאו <strong>{importRows.length}</strong> סעיפי תקציב. הייבוא יחליף את כל הסעיפים הקיימים.
            </div>
            <div className="border rounded-xl overflow-auto max-h-72 text-xs">
              <table className="w-full">
                <thead className="bg-muted/30 sticky top-0">
                  <tr>
                    <th className="text-right p-2 font-medium">קטגוריה</th>
                    <th className="text-right p-2 font-medium">תיאור</th>
                    <th className="text-right p-2 font-medium">חשבון</th>
                    <th className="text-left p-2 font-medium">תקציב</th>
                    <th className="text-left p-2 font-medium">עדכון</th>
                    <th className="text-left p-2 font-medium">ביצוע</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.slice(0, 30).map((r, i) => {
                    const budget = r.updatedBudget ?? r.allocatedAmount;
                    const isInc = budget > 0;
                    return (
                      <tr key={i} className={i % 2 === 0 ? "" : "bg-muted/10"}>
                        <td className="p-2 font-medium">{r.category || <span className="text-red-500">חסר!</span>}</td>
                        <td className="p-2 text-muted-foreground">{r.description || "—"}</td>
                        <td className="p-2 font-mono text-muted-foreground">{r.accountCode || "—"}</td>
                        <td className={`p-2 text-left ${isInc ? "text-green-700" : "text-red-700"}`}>₪{fmt(parseFloat(r.allocatedAmount) || 0)}</td>
                        <td className={`p-2 text-left ${isInc ? "text-green-700" : "text-red-700"}`}>{r.updatedBudget != null ? `₪${fmt(parseFloat(r.updatedBudget))}` : "—"}</td>
                        <td className="p-2 text-left">{r.spentAmount ? `₪${fmt(parseFloat(r.spentAmount))}` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {importRows.length > 30 && <p className="text-center text-xs text-muted-foreground py-2">...ועוד {importRows.length - 30}</p>}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setImportOpen(false); setImportRows([]); }}>ביטול</Button>
              <Button onClick={handleImportConfirm} disabled={importLoading} className="gap-2">
                {importLoading ? "מייבא..." : <><Upload className="w-4 h-4" /> אשר ייבוא ({importRows.length} סעיפים)</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
