import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Location, Locale } from "@/types";

interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  selectedLocationId: string | null;
  locations: Location[];
  locale: Locale;
  sidebarOpen: boolean;

  setUser: (user: User | null) => void;
  login: (user: User) => void;
  logout: () => void;
  setSelectedLocationId: (id: string) => void;
  setLocations: (locations: Location[]) => void;
  setLocale: (locale: Locale) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      selectedLocationId: null,
      locations: [],
      locale: "id",
      sidebarOpen: true,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      login: (user) =>
        set({
          user,
          isAuthenticated: true,
        }),
      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
          selectedLocationId: null,
        }),
      setSelectedLocationId: (id) => set({ selectedLocationId: id }),
      setLocations: (locations) => set({ locations }),
      setLocale: (locale) => set({ locale }),
      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
    }),
    {
      name: "supapark-store",
      partialize: (state) => ({
        selectedLocationId: state.selectedLocationId,
        locale: state.locale,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
