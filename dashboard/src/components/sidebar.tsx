"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Clock,
  DollarSign,
  Users,
  ShieldCheck,
  Cpu,
  Settings,
  ChevronDown,
  Globe,
  ParkingCircle,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";

const navItems = [
  { href: "/overview", icon: LayoutDashboard, labelKey: "overview" },
  { href: "/sessions", icon: Clock, labelKey: "sessions" },
  { href: "/revenue", icon: DollarSign, labelKey: "revenue" },
  { href: "/members", icon: Users, labelKey: "members" },
  { href: "/plate-rules", icon: ShieldCheck, labelKey: "plateRules" },
  { href: "/devices", icon: Cpu, labelKey: "devices" },
  { href: "/settings", icon: Settings, labelKey: "settings" },
];

const navLabels: Record<string, Record<string, string>> = {
  en: {
    overview: "Overview",
    sessions: "Sessions",
    revenue: "Revenue",
    members: "Members",
    plateRules: "Plate Rules",
    devices: "Devices",
    settings: "Settings",
  },
  id: {
    overview: "Ringkasan",
    sessions: "Sesi",
    revenue: "Pendapatan",
    members: "Anggota",
    plateRules: "Aturan Plat",
    devices: "Perangkat",
    settings: "Pengaturan",
  },
};

export function Sidebar() {
  const pathname = usePathname();
  const { locale, setLocale, locations, selectedLocationId, setSelectedLocationId } =
    useAppStore();

  const labels = navLabels[locale] || navLabels.id;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[240px] lg:min-h-screen bg-surface-raised border-r border-border">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5">
          <ParkingCircle className="h-7 w-7 text-amber" />
          <span className="text-lg font-semibold text-text-primary tracking-tight">
            Parkir
          </span>
        </div>

        {/* Location selector */}
        <div className="px-4 mb-4">
          <Select
            value={selectedLocationId || ""}
            onValueChange={setSelectedLocationId}
          >
            <SelectTrigger className="w-full bg-surface-overlay border-border text-sm">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {locations.length > 0 ? (
                locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="default">Demo Location</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors relative",
                  isActive
                    ? "text-amber bg-amber/5 font-semibold"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-overlay"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-amber rounded-r-full" />
                )}
                <item.icon className="h-[18px] w-[18px]" />
                <span>{labels[item.labelKey]}</span>
              </Link>
            );
          })}
        </nav>

        <Separator />

        {/* Language toggle */}
        <div className="px-4 py-4">
          <button
            onClick={() => setLocale(locale === "en" ? "id" : "en")}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-colors"
          >
            <Globe className="h-4 w-4" />
            <span>{locale === "en" ? "English" : "Bahasa Indonesia"}</span>
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-raised border-t border-border">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.slice(0, 5).map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors min-w-[48px]",
                  isActive
                    ? "text-amber"
                    : "text-text-tertiary"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="truncate max-w-[56px]">
                  {labels[item.labelKey]}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
