import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Location, Locale } from "@/types";

interface AppState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  selectedLocationId: string | null;
  locations: Location[];
  locale: Locale;
  sidebarOpen: boolean;

  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (user: User, token: string) => void;
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
      token: null,
      isAuthenticated: false,
      selectedLocationId: null,
      locations: [],
      locale: "id",
      sidebarOpen: true,

      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      login: (user, token) =>
        set({
          user,
          token,
          isAuthenticated: true,
        }),
      logout: () => {
        if (typeof document !== "undefined") {
          document.cookie = "parkir_auth=; path=/; max-age=0";
        }
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          selectedLocationId: null,
        });
      },
      setSelectedLocationId: (id) => set({ selectedLocationId: id }),
      setLocations: (locations) => set({ locations }),
      setLocale: (locale) => set({ locale }),
      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
    }),
    {
      name: "parkir-store",
      partialize: (state) => ({
        token: state.token,
        selectedLocationId: state.selectedLocationId,
        locale: state.locale,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
