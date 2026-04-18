"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Search, UserPlus, Phone, Mail, Building2 } from "lucide-react";
import { format } from "date-fns";
import type { Lead, LeadStatus } from "@/types";

const leadStatusConfig: Record<LeadStatus, { label: string; color: string }> = {
  new: { label: "Baru", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  contacted: { label: "Dihubungi", color: "bg-amber/15 text-amber border-amber/30" },
  qualified: { label: "Qualified", color: "bg-green-500/15 text-green-400 border-green-500/30" },
  converted: { label: "Converted", color: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  lost: { label: "Lost", color: "bg-red-500/15 text-red-400 border-red-500/30" },
};

const demoLeads: Lead[] = [
  {
    id: "lead-001",
    name: "Ahmad Fauzi",
    email: "ahmad@mallsurabaya.id",
    phone: "081234567890",
    facility_name: "Mall Surabaya Pusat",
    source: "landing_page",
    status: "new",
    city: "Surabaya",
    created_at: "2026-04-15T10:00:00Z",
    updated_at: "2026-04-15T10:00:00Z",
  },
  {
    id: "lead-002",
    name: "Siti Nurhaliza",
    email: "siti@apartjakarta.com",
    phone: "082345678901",
    facility_name: "Apartemen Jakarta Selatan",
    source: "referral",
    status: "contacted",
    city: "Jakarta",
    latitude: -6.2615,
    longitude: 106.8106,
    entry_lanes: 2,
    exit_lanes: 2,
    onboarded_at: "2026-04-14T08:00:00Z",
    created_at: "2026-04-12T09:30:00Z",
    updated_at: "2026-04-14T08:00:00Z",
  },
  {
    id: "lead-003",
    name: "Budi Santoso",
    email: "budi@rsmedika.co.id",
    phone: "083456789012",
    facility_name: "RS Medika Bandung",
    source: "social_media",
    status: "qualified",
    city: "Bandung",
    latitude: -6.9175,
    longitude: 107.6191,
    entry_lanes: 1,
    exit_lanes: 1,
    current_system: "manual",
    daily_volume: 300,
    onboarded_at: "2026-04-10T12:00:00Z",
    created_at: "2026-04-08T14:00:00Z",
    updated_at: "2026-04-10T12:00:00Z",
  },
  {
    id: "lead-004",
    name: "Dewi Lestari",
    email: "dewi@plazayogya.com",
    phone: "084567890123",
    facility_name: "Plaza Yogyakarta",
    source: "landing_page",
    status: "converted",
    city: "Yogyakarta",
    project_id: "proj-001",
    converted_at: "2026-04-05T10:00:00Z",
    created_at: "2026-03-28T11:00:00Z",
    updated_at: "2026-04-05T10:00:00Z",
  },
  {
    id: "lead-005",
    name: "Reza Mahendra",
    email: "reza@kantorbsd.com",
    phone: "085678901234",
    facility_name: "Kantor BSD City",
    source: "direct",
    status: "lost",
    notes: "Memilih vendor lain",
    created_at: "2026-03-20T09:00:00Z",
    updated_at: "2026-04-01T16:00:00Z",
  },
];

export default function LeadsPage() {
  const { locale } = useAppStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return demoLeads.filter((lead) => {
      const matchSearch =
        !search ||
        lead.name.toLowerCase().includes(search.toLowerCase()) ||
        lead.email.toLowerCase().includes(search.toLowerCase()) ||
        lead.phone.includes(search) ||
        lead.facility_name.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || lead.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [search, statusFilter]);

  const counts = useMemo(() => {
    const c = { total: demoLeads.length, new: 0, qualified: 0, converted: 0 };
    demoLeads.forEach((l) => {
      if (l.status === "new") c.new++;
      if (l.status === "qualified") c.qualified++;
      if (l.status === "converted") c.converted++;
    });
    return c;
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">
          {locale === "en" ? "Leads" : "Prospek"}
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-surface-raised border-border">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-text-secondary">{locale === "en" ? "Total" : "Total"}</p>
            <p className="text-2xl font-bold text-text-primary">{counts.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-surface-raised border-border">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-text-secondary">{locale === "en" ? "New" : "Baru"}</p>
            <p className="text-2xl font-bold text-blue-400">{counts.new}</p>
          </CardContent>
        </Card>
        <Card className="bg-surface-raised border-border">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-text-secondary">Qualified</p>
            <p className="text-2xl font-bold text-green-400">{counts.qualified}</p>
          </CardContent>
        </Card>
        <Card className="bg-surface-raised border-border">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-text-secondary">Converted</p>
            <p className="text-2xl font-bold text-purple-400">{counts.converted}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <Input
            placeholder={locale === "en" ? "Search leads..." : "Cari prospek..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-surface-raised border-border"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px] bg-surface-raised border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{locale === "en" ? "All Status" : "Semua Status"}</SelectItem>
            <SelectItem value="new">{locale === "en" ? "New" : "Baru"}</SelectItem>
            <SelectItem value="contacted">{locale === "en" ? "Contacted" : "Dihubungi"}</SelectItem>
            <SelectItem value="qualified">Qualified</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="bg-surface-raised border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-text-secondary">{locale === "en" ? "Name" : "Nama"}</TableHead>
              <TableHead className="text-text-secondary">{locale === "en" ? "Facility" : "Fasilitas"}</TableHead>
              <TableHead className="text-text-secondary hidden md:table-cell">Email</TableHead>
              <TableHead className="text-text-secondary hidden lg:table-cell">{locale === "en" ? "Phone" : "Telepon"}</TableHead>
              <TableHead className="text-text-secondary hidden sm:table-cell">{locale === "en" ? "City" : "Kota"}</TableHead>
              <TableHead className="text-text-secondary">Status</TableHead>
              <TableHead className="text-text-secondary hidden lg:table-cell">{locale === "en" ? "Date" : "Tanggal"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((lead) => {
              const statusCfg = leadStatusConfig[lead.status];
              return (
                <TableRow
                  key={lead.id}
                  className="border-border cursor-pointer hover:bg-surface-overlay"
                >
                  <TableCell>
                    <Link href={`/leads/${lead.id}`} className="font-medium text-text-primary hover:text-amber">
                      {lead.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-text-secondary">{lead.facility_name}</TableCell>
                  <TableCell className="text-text-secondary hidden md:table-cell">{lead.email}</TableCell>
                  <TableCell className="text-text-secondary hidden lg:table-cell">{lead.phone}</TableCell>
                  <TableCell className="text-text-secondary hidden sm:table-cell">{lead.city || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusCfg.color}>
                      {statusCfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-text-secondary hidden lg:table-cell">
                    {format(new Date(lead.created_at), "dd MMM yyyy")}
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-text-tertiary py-8">
                  {locale === "en" ? "No leads found" : "Tidak ada prospek"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
