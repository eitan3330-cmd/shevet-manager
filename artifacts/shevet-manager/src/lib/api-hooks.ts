import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const api = (path: string, opts?: RequestInit) =>
  fetch(`${API_BASE}/api${path}`, opts).then(r => r.json());

// === App Settings (planning/execution locks) ===
export type AppSettings = Record<string, string>;

export function useAppSettings() {
  const { role } = useAuth();
  const isAdmin = role === "marcaz_boger";
  const { data: settings = {} } = useQuery<AppSettings>({
    queryKey: ["app-settings"],
    queryFn: () => api("/settings"),
  });
  return {
    settings,
    planningLocked: settings["planningLocked"] === "true",
    executionLocked: settings["executionLocked"] === "true",
    isAdmin,
    planningBlocked: !isAdmin && settings["planningLocked"] === "true",
    executionBlocked: !isAdmin && settings["executionLocked"] === "true",
  };
}

// === Permissions ===
export const getListPermissionsQueryKey = () => ["permissions"];
export function useListPermissions(opts?: { query?: { enabled?: boolean } }) {
  return useQuery({
    queryKey: getListPermissionsQueryKey(),
    queryFn: () => api("/permissions"),
    enabled: opts?.query?.enabled !== false,
  });
}
export function useUpdatePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ data }: { data: { role: string; section: string; feature?: string | null; canAccess: boolean } }) =>
      api("/permissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: getListPermissionsQueryKey() }),
  });
}

// === Events ===
export const getListEventsQueryKey = () => ["events"];
export function useListEvents() {
  return useQuery({ queryKey: getListEventsQueryKey(), queryFn: () => api("/events") });
}
export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ data }: { data: any }) =>
      api("/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: getListEventsQueryKey() }),
  });
}
export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ params, data }: { params: { id: number }; data: any }) =>
      api(`/events/${params.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: getListEventsQueryKey() }),
  });
}
export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ params }: { params: { id: number } }) =>
      api(`/events/${params.id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: getListEventsQueryKey() }),
  });
}

// === Scouts ===
export const getListScoutsQueryKey = () => ["scouts-raw"];
export function useListScouts() {
  return useQuery({ queryKey: getListScoutsQueryKey(), queryFn: () => api("/scouts") });
}

// === Budget Items ===
export const getListBudgetItemsQueryKey = () => ["budget-items"];
export const getGetBudgetSummaryQueryKey = () => ["budget-summary"];
export function useListBudgetItems() {
  return useQuery({ queryKey: getListBudgetItemsQueryKey(), queryFn: () => api("/budget") });
}
export function useGetBudgetSummary() {
  return useQuery({ queryKey: getGetBudgetSummaryQueryKey(), queryFn: () => api("/budget/summary") });
}
export function useCreateBudgetItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ data }: { data: any }) =>
      api("/budget", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: getListBudgetItemsQueryKey() }); qc.invalidateQueries({ queryKey: getGetBudgetSummaryQueryKey() }); },
  });
}
export function useUpdateBudgetItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ params, data }: { params: { id: number }; data: any }) =>
      api(`/budget/${params.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: getListBudgetItemsQueryKey() }); qc.invalidateQueries({ queryKey: getGetBudgetSummaryQueryKey() }); },
  });
}
export function useDeleteBudgetItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ params }: { params: { id: number } }) =>
      api(`/budget/${params.id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: getListBudgetItemsQueryKey() }); qc.invalidateQueries({ queryKey: getGetBudgetSummaryQueryKey() }); },
  });
}
