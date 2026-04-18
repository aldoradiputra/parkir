"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppStore } from "@/lib/store";
import { Search } from "lucide-react";
import { format } from "date-fns";
import type { Project, ProjectStatus } from "@/types";

const projectStatusConfig: Record<ProjectStatus, { label: string; color: string }> = {
  planning: { label: "Planning", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  procurement: { label: "Procurement", color: "bg-amber/15 text-amber border-amber/30" },
  installation: { label: "Installation", color: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  testing: { label: "Testing", color: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  live: { label: "Live", color: "bg-green-500/15 text-green-400 border-green-500/30" },
  maintenance: { label: "Maintenance", color: "bg-teal-500/15 text-teal-400 border-teal-500/30" },
  cancelled: { label: "Cancelled", color: "bg-red-500/15 text-red-400 border-red-500/30" },
};

const demoProjects: Project[] = [
  {
    id: "proj-001",
    lead_id: "lead-004",
    facility_name: "Plaza Yogyakarta",
    contact_name: "Dewi Lestari",
    contact_email: "dewi@plazayogya.com",
    contact_phone: "084567890123",
    city: "Yogyakarta",
    address: "Jl. Malioboro No. 52",
    latitude: -7.7956,
    longitude: 110.3695,
    entry_lanes: 2,
    exit_lanes: 2,
    status: "installation",
    start_date: "2026-04-10",
    target_live: "2026-05-15",
    created_at: "2026-04-05T10:00:00Z",
    updated_at: "2026-04-15T14:00:00Z",
  },
  {
    id: "proj-002",
    facility_name: "Mall Semarang Baru",
    contact_name: "Andi Prasetyo",
    contact_email: "andi@mallsmg.com",
    contact_phone: "086789012345",
    city: "Semarang",
    latitude: -6.9666,
    longitude: 110.4196,
    entry_lanes: 3,
    exit_lanes: 3,
    status: "planning",
    start_date: "2026-04-18",
    target_live: "2026-06-01",
    created_at: "2026-04-12T09:00:00Z",
    updated_at: "2026-04-12T09:00:00Z",
  },
  {
    id: "proj-003",
    facility_name: "Gedung Perkantoran Kuningan",
    contact_name: "Ratna Sari",
    contact_email: "ratna@kuninganoffice.co.id",
    contact_phone: "087890123456",
    city: "Jakarta",
    entry_lanes: 1,
    exit_lanes: 1,
    status: "live",
    start_date: "2026-02-01",
    target_live: "2026-03-15",
    actual_live: "2026-03-20",
    created_at: "2026-01-20T08:00:00Z",
    updated_at: "2026-03-20T10:00:00Z",
  },
];

export default function ProjectsPage() {
  const { locale } = useAppStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return demoProjects.filter((p) => {
      const matchSearch =
        !search ||
        p.facility_name.toLowerCase().includes(search.toLowerCase()) ||
        p.contact_name.toLowerCase().includes(search.toLowerCase()) ||
        (p.city && p.city.toLowerCase().includes(search.toLowerCase()));
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [search, statusFilter]);

  const counts = useMemo(() => {
    const c = { total: demoProjects.length, active: 0, live: 0 };
    demoProjects.forEach((p) => {
      if (["planning", "procurement", "installation", "testing"].includes(p.status)) c.active++;
      if (p.status === "live") c.live++;
    });
    return c;
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">
        {locale === "en" ? "Projects" : "Proyek"}
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-surface-raised border-border">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-text-secondary">Total</p>
            <p className="text-2xl font-bold text-text-primary">{counts.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-surface-raised border-border">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-text-secondary">{locale === "en" ? "Active" : "Aktif"}</p>
            <p className="text-2xl font-bold text-amber">{counts.active}</p>
          </CardContent>
        </Card>
        <Card className="bg-surface-raised border-border">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-text-secondary">Live</p>
            <p className="text-2xl font-bold text-green-400">{counts.live}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <Input
            placeholder={locale === "en" ? "Search projects..." : "Cari proyek..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-surface-raised border-border"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px] bg-surface-raised border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{locale === "en" ? "All Status" : "Semua Status"}</SelectItem>
            {Object.entries(projectStatusConfig).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="bg-surface-raised border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-text-secondary">{locale === "en" ? "Facility" : "Fasilitas"}</TableHead>
              <TableHead className="text-text-secondary hidden md:table-cell">{locale === "en" ? "Contact" : "Kontak"}</TableHead>
              <TableHead className="text-text-secondary hidden sm:table-cell">{locale === "en" ? "City" : "Kota"}</TableHead>
              <TableHead className="text-text-secondary hidden lg:table-cell">{locale === "en" ? "Lanes" : "Jalur"}</TableHead>
              <TableHead className="text-text-secondary">Status</TableHead>
              <TableHead className="text-text-secondary hidden lg:table-cell">Target Live</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((project) => {
              const statusCfg = projectStatusConfig[project.status];
              return (
                <TableRow
                  key={project.id}
                  className="border-border cursor-pointer hover:bg-surface-overlay"
                >
                  <TableCell>
                    <Link href={`/projects/${project.id}`} className="font-medium text-text-primary hover:text-amber">
                      {project.facility_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-text-secondary hidden md:table-cell">{project.contact_name}</TableCell>
                  <TableCell className="text-text-secondary hidden sm:table-cell">{project.city || "—"}</TableCell>
                  <TableCell className="text-text-secondary hidden lg:table-cell">
                    {project.entry_lanes + project.exit_lanes}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusCfg.color}>
                      {statusCfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-text-secondary hidden lg:table-cell">
                    {project.target_live ? format(new Date(project.target_live), "dd MMM yyyy") : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-text-tertiary py-8">
                  {locale === "en" ? "No projects found" : "Tidak ada proyek"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
