import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ShoppingCart, CheckCircle2, Clock, XCircle, Package, FolderOpen, ChevronDown, ChevronLeft, Paperclip, Download, X as XIcon, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { useAppSettings } from "@/lib/api-hooks";
import { Lock } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type ProcurementCategory = {
  id: number;
  name: string;
  description: string | null;
  budgetLineCategory: string | null;
  totalBudget: number | null;
  totalSpent: number;
  orderCount: number;
  orders: ProcurementDoc[];
};

type ProcurementDoc = {
  id: number;
  title: string;
  amount: string;
  supplier: string | null;
  contactPhone: string | null;
  status: string;
  orderType: string;
  requestedBy: string | null;
  approvedBy: string | null;
  itemsDetail: string | null;
  quoteNotes: string | null;
  expectedDelivery: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileData: string | null;
  budgetLineId: number | null;
  quoteFileData: string | null;
  quoteFileName: string | null;
  orderFileData: string | null;
  orderFileName: string | null;
  invoiceFileData: string | null;
  invoiceFileName: string | null;
};

const ORDER_TYPES = [
  { value: "quote", label: "הצעת מחיר" },
  { value: "order", label: "הזמנת רכש" },
  { value: "invoice", label: "חשבונית" },
];

const ORDER_TYPE_COLORS: Record<string, string> = {
  quote: "bg-blue-100 text-blue-800 border-blue-200",
  order: "bg-amber-100 text-amber-800 border-amber-200",
  invoice: "bg-green-100 text-green-800 border-green-200",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:   { label: "ממתין",  color: "bg-amber-100 text-amber-700 border-amber-200",  icon: Clock },
  approved:  { label: "אושר",   color: "bg-green-100 text-green-700 border-green-200",  icon: CheckCircle2 },
  ordered:   { label: "הוזמן",  color: "bg-blue-100 text-blue-700 border-blue-200",     icon: Package },
  delivered: { label: "נמסר",   color: "bg-slate-100 text-slate-700 border-slate-200",  icon: CheckCircle2 },
  cancelled: { label: "בוטל",   color: "bg-red-100 text-red-700 border-red-200",        icon: XCircle },
};

const DOC_SLOTS = [
  { key: "quote",   label: "הצעת מחיר", dataKey: "quoteFileData",   nameKey: "quoteFileName"   },
  { key: "order",   label: "הזמנת רכש", dataKey: "orderFileData",   nameKey: "orderFileName"   },
  { key: "invoice", label: "חשבונית",   dataKey: "invoiceFileData", nameKey: "invoiceFileName" },
] as const;

type SlotKey = "quote" | "order" | "invoice";

type CatForm = { name: string; description: string; budgetLineCategory: string; totalBudget: string; };
type DocFiles = {
  quoteFileData: string; quoteFileName: string;
  orderFileData: string; orderFileName: string;
  invoiceFileData: string; invoiceFileName: string;
};
type OrderForm = {
  title: string; amount: string; supplier: string; contactPhone: string;
  status: string; orderType: string; requestedBy: string; approvedBy: string;
  itemsDetail: string; quoteNotes: string; expectedDelivery: string;
  categoryId: string; budgetLineId: string;
  fileUrl: string; fileName: string;
} & DocFiles;

const EMPTY_ORDER: OrderForm = {
  title: "", amount: "", supplier: "", contactPhone: "", status: "pending", orderType: "quote",
  requestedBy: "", approvedBy: "", itemsDetail: "", quoteNotes: "", expectedDelivery: "",
  categoryId: "", budgetLineId: "",
  fileUrl: "", fileName: "",
  quoteFileData: "", quoteFileName: "",
  orderFileData: "", orderFileName: "",
  invoiceFileData: "", invoiceFileName: "",
};

const BUDGET_CATEGORIES = ["הסעות", "ציוד", "מזון", "לינה", "פינוי", "מדריכים", "דלק", "כיבוד", "הדרכה", "פרסום", "כלים", "ביטוח", "אחר"];

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => resolve(ev.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function Procurement() {
  const [catOpen, setCatOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [editCatId, setEditCatId] = useState<number | null>(null);
  const [editOrderId, setEditOrderId] = useState<number | null>(null);
  const [expandedCat, setExpandedCat] = useState<number | null>(null);
  const [catForm, setCatForm] = useState<CatForm>({ name: "", description: "", budgetLineCategory: "אחר", totalBudget: "" });
  const [orderForm, setOrderForm] = useState<OrderForm>(EMPTY_ORDER);
  const [slotLoading, setSlotLoading] = useState<Record<SlotKey, boolean>>({ quote: false, order: false, invoice: false });
  const [mainFileLoading, setMainFileLoading] = useState(false);
  const slotRefs = {
    quote: useRef<HTMLInputElement>(null),
    order: useRef<HTMLInputElement>(null),
    invoice: useRef<HTMLInputElement>(null),
  } as Record<SlotKey, React.RefObject<HTMLInputElement>>;
  const mainFileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: categories = [], isLoading } = useQuery<ProcurementCategory[]>({
    queryKey: ["procurement-categories"],
    queryFn: () => fetch(`${API_BASE}/api/procurement-categories`).then(r => r.json()),
  });

  const { data: budgetLines = [] } = useQuery<{ id: number; category: string; description?: string; yearLabel: string; allocatedAmount: number }[]>({
    queryKey: ["budget-lines"],
    queryFn: () => fetch(`${API_BASE}/api/budget-lines`).then(r => r.json()),
  });

  const createCat = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch(`${API_BASE}/api/procurement-categories`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["procurement-categories"] }); setCatOpen(false); setCatForm({ name: "", description: "", budgetLineCategory: "אחר", totalBudget: "" }); toast({ title: "תיקייה נוצרה" }); },
  });

  const deleteCat = useMutation({
    mutationFn: (id: number) => fetch(`${API_BASE}/api/procurement-categories/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["procurement-categories"] }); toast({ title: "תיקייה נמחקה" }); },
  });

  const createOrder = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch(`${API_BASE}/api/procurement`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["procurement-categories"] }); setOrderOpen(false); setOrderForm(EMPTY_ORDER); toast({ title: "מסמך נוסף" }); },
  });

  const updateOrder = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      fetch(`${API_BASE}/api/procurement/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["procurement-categories"] }); setOrderOpen(false); toast({ title: "מסמך עודכן" }); },
  });

  const deleteOrder = useMutation({
    mutationFn: (id: number) => fetch(`${API_BASE}/api/procurement/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["procurement-categories"] }); toast({ title: "מסמך נמחק" }); },
  });

  const openNewOrder = (catId: number, orderType?: string) => {
    setEditOrderId(null);
    setOrderForm({ ...EMPTY_ORDER, orderType: orderType || "quote", categoryId: String(catId) });
    setOrderOpen(true);
  };

  const handleSlotFile = async (slot: SlotKey, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: "קובץ גדול מדי (מקסימום 5MB)", variant: "destructive" }); return; }
    setSlotLoading(p => ({ ...p, [slot]: true }));
    try {
      const base64 = await readFileAsBase64(file);
      const dataKey = `${slot}FileData` as keyof DocFiles;
      const nameKey = `${slot}FileName` as keyof DocFiles;
      setOrderForm(p => ({ ...p, [dataKey]: base64, [nameKey]: file.name }));
    } finally {
      setSlotLoading(p => ({ ...p, [slot]: false }));
      e.target.value = "";
    }
  };

  const clearSlot = (slot: SlotKey) => {
    const dataKey = `${slot}FileData` as keyof DocFiles;
    const nameKey = `${slot}FileName` as keyof DocFiles;
    setOrderForm(p => ({ ...p, [dataKey]: "", [nameKey]: "" }));
  };

  const handleMainFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: "קובץ גדול מדי (מקסימום 5MB)", variant: "destructive" }); return; }
    setMainFileLoading(true);
    try {
      const base64 = await readFileAsBase64(file);
      setOrderForm(p => ({ ...p, fileUrl: base64, fileName: file.name }));
    } finally {
      setMainFileLoading(false);
      e.target.value = "";
    }
  };

  const downloadSlot = (doc: ProcurementDoc, slot: SlotKey) => {
    const url = slot === "quote" ? doc.quoteFileData : slot === "order" ? doc.orderFileData : doc.invoiceFileData;
    const name = slot === "quote" ? doc.quoteFileName : slot === "order" ? doc.orderFileName : doc.invoiceFileName;
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = name || `${slot}.pdf`;
    link.click();
  };

  const downloadMainFile = (doc: ProcurementDoc) => {
    const url = doc.fileData || doc.fileUrl;
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = doc.fileName || "קובץ";
    link.click();
  };

  const handleSubmitOrder = () => {
    const data: Record<string, unknown> = {
      ...orderForm,
      amount: String(orderForm.amount || "0"),
      categoryId: orderForm.categoryId ? parseInt(orderForm.categoryId) : null,
      budgetLineId: orderForm.budgetLineId ? parseInt(orderForm.budgetLineId) : null,
      requestedBy: orderForm.requestedBy || user?.name || null,
      expectedDelivery: orderForm.expectedDelivery ? new Date(orderForm.expectedDelivery).toISOString() : null,
      fileData: orderForm.fileUrl?.startsWith("data:") ? orderForm.fileUrl : null,
      fileUrl: !orderForm.fileUrl?.startsWith("data:") ? orderForm.fileUrl : null,
      quoteFileData: orderForm.quoteFileData || null,
      quoteFileName: orderForm.quoteFileName || null,
      orderFileData: orderForm.orderFileData || null,
      orderFileName: orderForm.orderFileName || null,
      invoiceFileData: orderForm.invoiceFileData || null,
      invoiceFileName: orderForm.invoiceFileName || null,
    };
    if (editOrderId) updateOrder.mutate({ id: editOrderId, data });
    else createOrder.mutate(data);
  };

  const { planningBlocked } = useAppSettings();

  const totalStats = {
    folders: categories.length,
    totalDocs: categories.reduce((s, c) => s + (c.orderCount || 0), 0),
    totalSpent: categories.reduce((s, c) => s + (c.totalSpent || 0), 0),
  };

  if (planningBlocked) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
        <Lock className="w-14 h-14 text-amber-500 opacity-70" />
        <h2 className="text-2xl font-bold">תכנון נעול</h2>
        <p className="text-muted-foreground max-w-sm">נתוני רכש ותכנון נעולים על ידי מרכז בוגר. פנה למרכז בוגר לפתיחת הגישה.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold">הזמנות רכש</h2>
          <p className="text-muted-foreground">תיקיות רכש — הצעות מחיר, הזמנות וחשבוניות</p>
        </div>
        <Button onClick={() => { setEditCatId(null); setCatOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> תיקייה חדשה
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "תיקיות", value: totalStats.folders },
          { label: "מסמכים", value: totalStats.totalDocs },
          { label: "סה״כ הוצאות", value: `₪${totalStats.totalSpent.toLocaleString()}` },
        ].map(s => (
          <Card key={s.label}><CardContent className="pt-3 pb-2 text-center">
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </CardContent></Card>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">טוען...</div>
      ) : categories.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-xl">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>אין תיקיות עדיין — צור תיקייה חדשה</p>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => {
            const isExpanded = expandedCat === cat.id;
            const spent = cat.totalSpent || 0;
            const budget = cat.totalBudget;
            const pct = budget && budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
            const groupedOrders: Record<string, ProcurementDoc[]> = {};
            (cat.orders || []).forEach((o) => {
              const t = o.orderType || "order";
              if (!groupedOrders[t]) groupedOrders[t] = [];
              groupedOrders[t].push(o);
            });

            return (
              <div key={cat.id} className="border rounded-xl overflow-hidden bg-card">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedCat(isExpanded ? null : cat.id)}
                >
                  <div className="flex items-center gap-3">
                    <FolderOpen className={`w-5 h-5 ${isExpanded ? "text-primary" : "text-muted-foreground"}`} />
                    <div>
                      <p className="font-semibold">{cat.name}</p>
                      {cat.description && <p className="text-xs text-muted-foreground">{cat.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-left text-sm hidden md:block">
                      {cat.budgetLineCategory && <Badge variant="outline" className="text-xs ml-2">{cat.budgetLineCategory}</Badge>}
                      <span className="text-muted-foreground">{cat.orderCount} מסמכים</span>
                      {budget && <span className="mr-2">₪{spent.toLocaleString()} / ₪{budget.toLocaleString()}</span>}
                    </div>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openNewOrder(cat.id)}>
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("למחוק תיקייה?")) deleteCat.mutate(cat.id); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronLeft className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {budget && (
                  <div className="px-4 pb-2">
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}

                {isExpanded && (
                  <div className="border-t border-border/50 p-4 space-y-4">
                    {["quote", "order", "invoice"].map(type => {
                      const docs = groupedOrders[type] || [];
                      const typeLabel = ORDER_TYPES.find(t => t.value === type)?.label || type;
                      return (
                        <div key={type}>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                              <Badge variant="outline" className={`text-xs ${ORDER_TYPE_COLORS[type]}`}>{typeLabel}</Badge>
                              <span className="text-muted-foreground font-normal">({docs.length})</span>
                            </h4>
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => {
                              setEditOrderId(null);
                              setOrderForm({ ...EMPTY_ORDER, orderType: type, categoryId: String(cat.id) });
                              setOrderOpen(true);
                            }}>
                              <Plus className="w-3 h-3" /> הוסף {typeLabel}
                            </Button>
                          </div>
                          {docs.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-2">אין {typeLabel} עדיין</p>
                          ) : (
                            <div className="space-y-2">
                              {docs.map((doc) => {
                                const sCfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending;
                                const SIcon = sCfg.icon;
                                const hasMainFile = doc.fileData || doc.fileUrl;
                                const linkedLine = budgetLines.find(l => l.id === doc.budgetLineId);
                                return (
                                  <div key={doc.id} className="border rounded-lg bg-muted/10">
                                    <div className="flex items-center justify-between px-3 py-2">
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm">{doc.title}</p>
                                        <div className="flex gap-2 text-xs text-muted-foreground flex-wrap">
                                          {doc.supplier && <span>ספק: {doc.supplier}</span>}
                                          {linkedLine && <span className="text-blue-600">• {linkedLine.category}{linkedLine.description ? ` — ${linkedLine.description}` : ""}</span>}
                                          {doc.itemsDetail && <span className="line-clamp-1">{doc.itemsDetail}</span>}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <Badge variant="outline" className={`text-xs flex items-center gap-0.5 ${sCfg.color}`}>
                                          <SIcon className="w-3 h-3" />{sCfg.label}
                                        </Badge>
                                        <span className="font-semibold text-sm">₪{parseFloat(doc.amount || "0").toLocaleString()}</span>
                                        {hasMainFile && (
                                          <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" title={doc.fileName || "קובץ"} onClick={() => downloadMainFile(doc)}>
                                            <Paperclip className="w-3 h-3" />
                                          </Button>
                                        )}
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => {
                                          setEditOrderId(doc.id);
                                          setOrderForm({
                                            title: doc.title || "", amount: doc.amount || "",
                                            supplier: doc.supplier || "", contactPhone: doc.contactPhone || "",
                                            status: doc.status || "pending", orderType: doc.orderType || "quote",
                                            requestedBy: doc.requestedBy || "", approvedBy: doc.approvedBy || "",
                                            itemsDetail: doc.itemsDetail || "", quoteNotes: doc.quoteNotes || "",
                                            expectedDelivery: doc.expectedDelivery ? doc.expectedDelivery.split("T")[0] : "",
                                            categoryId: String(cat.id), budgetLineId: doc.budgetLineId ? String(doc.budgetLineId) : "",
                                            fileUrl: doc.fileUrl || "", fileName: doc.fileName || "",
                                            quoteFileData: doc.quoteFileData || "", quoteFileName: doc.quoteFileName || "",
                                            orderFileData: doc.orderFileData || "", orderFileName: doc.orderFileName || "",
                                            invoiceFileData: doc.invoiceFileData || "", invoiceFileName: doc.invoiceFileName || "",
                                          });
                                          setOrderOpen(true);
                                        }}>
                                          <Pencil className="w-3 h-3" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => { if (confirm("למחוק?")) deleteOrder.mutate(doc.id as number); }}>
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </div>

                                    {/* Three document slots shown inline */}
                                    <div className="px-3 pb-2 flex gap-2 flex-wrap">
                                      {DOC_SLOTS.map(slot => {
                                        const fileData = slot.key === "quote" ? doc.quoteFileData : slot.key === "order" ? doc.orderFileData : doc.invoiceFileData;
                                        const fileName = slot.key === "quote" ? doc.quoteFileName : slot.key === "order" ? doc.orderFileName : doc.invoiceFileName;
                                        return fileData ? (
                                          <button
                                            key={slot.key}
                                            onClick={() => downloadSlot(doc, slot.key)}
                                            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${ORDER_TYPE_COLORS[slot.key]} hover:opacity-80 transition-opacity`}
                                          >
                                            <Download className="w-3 h-3" />
                                            {slot.label}: {fileName || slot.label}
                                          </button>
                                        ) : (
                                          <span key={slot.key} className="text-xs text-muted-foreground/40 px-2 py-1">
                                            {slot.label}: —
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Folder Dialog */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>תיקיית רכש חדשה</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="שם התיקייה (למשל: ציוד מחסן) *" value={catForm.name} onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))} />
            <Input placeholder="תיאור" value={catForm.description} onChange={e => setCatForm(p => ({ ...p, description: e.target.value }))} />
            <div>
              <label className="text-sm font-medium">שיוך לסעיף תקציבי</label>
              <Select value={catForm.budgetLineCategory} onValueChange={v => setCatForm(p => ({ ...p, budgetLineCategory: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUDGET_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">תקציב כולל (₪)</label>
              <Input type="number" placeholder="0" value={catForm.totalBudget} onChange={e => setCatForm(p => ({ ...p, totalBudget: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={() => catForm.name && createCat.mutate({ name: catForm.name, description: catForm.description || null, budgetLineCategory: catForm.budgetLineCategory, totalBudget: catForm.totalBudget ? parseFloat(catForm.totalBudget) : null })} disabled={!catForm.name}>
              צור תיקייה
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Document Dialog */}
      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editOrderId ? "עריכת מסמך" : `הוספת ${ORDER_TYPES.find(t => t.value === orderForm.orderType)?.label || "מסמך"}`}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[75vh] overflow-y-auto px-1">
            {/* Type selector */}
            <div className="flex gap-2">
              {ORDER_TYPES.map(t => (
                <button key={t.value} onClick={() => setOrderForm(p => ({ ...p, orderType: t.value }))}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-all ${orderForm.orderType === t.value ? ORDER_TYPE_COLORS[t.value] + " font-semibold" : "bg-muted text-muted-foreground"}`}>
                  {t.label}
                </button>
              ))}
            </div>

            <Input placeholder="כותרת *" value={orderForm.title} onChange={e => setOrderForm(p => ({ ...p, title: e.target.value }))} />

            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">ספק</label><Input value={orderForm.supplier} onChange={e => setOrderForm(p => ({ ...p, supplier: e.target.value }))} /></div>
              <div><label className="text-xs text-muted-foreground">טלפון ספק</label><Input value={orderForm.contactPhone} onChange={e => setOrderForm(p => ({ ...p, contactPhone: e.target.value }))} /></div>
            </div>

            <div><label className="text-xs text-muted-foreground">סכום (₪)</label><Input type="number" value={orderForm.amount} onChange={e => setOrderForm(p => ({ ...p, amount: e.target.value }))} /></div>

            {/* Budget line dropdown */}
            <div>
              <label className="text-xs text-muted-foreground">שיוך לסעיף תקציבי</label>
              <Select value={orderForm.budgetLineId || "none"} onValueChange={v => setOrderForm(p => ({ ...p, budgetLineId: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="בחר סעיף תקציבי (אופציונלי)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא שיוך</SelectItem>
                  {budgetLines.map(l => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.category}{l.description ? ` — ${l.description}` : ""} (₪{l.allocatedAmount.toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div><label className="text-xs text-muted-foreground">פירוט פריטים</label><Textarea value={orderForm.itemsDetail} onChange={e => setOrderForm(p => ({ ...p, itemsDetail: e.target.value }))} rows={2} /></div>

            {orderForm.orderType === "quote" && (
              <div><label className="text-xs text-muted-foreground">הערות הצעת מחיר</label><Textarea value={orderForm.quoteNotes} onChange={e => setOrderForm(p => ({ ...p, quoteNotes: e.target.value }))} rows={2} /></div>
            )}

            <div>
              <label className="text-xs text-muted-foreground">סטטוס</label>
              <Select value={orderForm.status} onValueChange={v => setOrderForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(STATUS_CONFIG).map(([value, cfg]) => <SelectItem key={value} value={value}>{cfg.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">מגיש</label><Input value={orderForm.requestedBy} onChange={e => setOrderForm(p => ({ ...p, requestedBy: e.target.value }))} /></div>
              <div><label className="text-xs text-muted-foreground">מאשר</label><Input value={orderForm.approvedBy} onChange={e => setOrderForm(p => ({ ...p, approvedBy: e.target.value }))} /></div>
            </div>

            <div><label className="text-xs text-muted-foreground">תאריך אספקה</label><Input type="date" value={orderForm.expectedDelivery} onChange={e => setOrderForm(p => ({ ...p, expectedDelivery: e.target.value }))} /></div>

            {/* Three document file slots */}
            <div className="border rounded-xl p-3 space-y-2">
              <p className="text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4" /> מסמכי רכש</p>
              {DOC_SLOTS.map(slot => {
                const dataKey = slot.dataKey;
                const nameKey = slot.nameKey;
                const hasFile = !!orderForm[dataKey];
                const slotRef = slotRefs[slot.key];
                return (
                  <div key={slot.key} className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${ORDER_TYPE_COLORS[slot.key]} w-28 text-center shrink-0`}>{slot.label}</span>
                    {hasFile ? (
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <Paperclip className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="text-xs truncate flex-1">{orderForm[nameKey] || "קובץ"}</span>
                        <button onClick={() => clearSlot(slot.key)} className="text-red-400 hover:text-red-600 shrink-0">
                          <XIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => slotRef.current?.click()}
                        className="flex-1 text-xs text-muted-foreground border border-dashed rounded-lg py-1.5 px-2 hover:bg-muted/30 flex items-center justify-center gap-1 transition-colors"
                        disabled={slotLoading[slot.key]}
                      >
                        {slotLoading[slot.key] ? "טוען..." : <><Paperclip className="w-3 h-3" /> העלה {slot.label}</>}
                      </button>
                    )}
                    <input
                      ref={slotRef}
                      type="file"
                      accept=".pdf,.xlsx,.xls,.png,.jpg,.jpeg,.doc,.docx"
                      className="hidden"
                      onChange={e => handleSlotFile(slot.key, e)}
                    />
                  </div>
                );
              })}
            </div>

            {/* Legacy single file attachment */}
            <div>
              <label className="text-xs text-muted-foreground">קובץ כללי מצורף (אופציונלי)</label>
              {orderForm.fileName ? (
                <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/30 mt-1">
                  <Paperclip className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm flex-1 truncate">{orderForm.fileName}</span>
                  <button onClick={() => setOrderForm(p => ({ ...p, fileUrl: "", fileName: "" }))} className="text-red-500 hover:bg-red-50 rounded p-0.5">
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button onClick={() => mainFileRef.current?.click()}
                  className="w-full mt-1 border border-dashed rounded-lg p-2.5 text-sm text-muted-foreground hover:bg-muted/30 flex items-center justify-center gap-2 transition-colors">
                  <Paperclip className="w-4 h-4" />
                  {mainFileLoading ? "טוען..." : "צרף קובץ כללי (עד 5MB)"}
                </button>
              )}
              <input ref={mainFileRef} type="file" accept=".pdf,.xlsx,.xls,.png,.jpg,.jpeg,.doc,.docx" className="hidden" onChange={handleMainFileChange} />
            </div>

            <Button className="w-full" onClick={handleSubmitOrder} disabled={!orderForm.title || Object.values(slotLoading).some(Boolean) || mainFileLoading}>
              {editOrderId ? "שמור" : "הוסף"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
