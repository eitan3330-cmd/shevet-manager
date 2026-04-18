import { ReactNode } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Role = "marcaz_boger" | "marcaz_tzair" | "roshatz" | "roshgad" | "madrich" | "pael";

export const ROLE_NAMES: Record<string, string> = {
  marcaz_boger: "מרכז בוגר",
  marcaz_tzair: "מרכז צעיר",
  roshatz: "ראשצ",
  roshgad: "ראשגד",
  madrich: "מדריך",
  pael: "פעיל",
};

export interface AuthUser {
  id: number | null;
  name: string;
  role: Role;
  hasPin?: boolean;
  battalion?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  role: Role | null;
  setUser: (user: AuthUser | null) => void;
  setRole: (role: Role | null) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      setUser: (user) => set({ user, role: user?.role ?? null }),
      setRole: (role) => set({
        role,
        user: role ? { id: null, name: ROLE_NAMES[role] || role, role } : null,
      }),
      logout: () => set({ role: null, user: null }),
    }),
    {
      name: "shevet-auth",
    }
  )
);

export function AuthProvider({ children }: { children: ReactNode }) {
  return children as React.ReactElement;
}
