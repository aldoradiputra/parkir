"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { PlateDisplay } from "@/components/plate-display";
import { StatusBadge } from "@/components/status-badge";
import { MemberForm, type MemberFormData } from "@/components/member-form";
import { useAppStore } from "@/lib/store";
import { Search, Plus, Upload, RefreshCw } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import type { Member } from "@/types";

const demoMembers: Member[] = [
  {
    id: "m-001",
    location_id: "loc-1",
    plate_number: "B 1234 KJP",
    name: "Ahmad Fauzi",
    phone: "081234567890",
    email: "ahmad@email.com",
    pass_type: "monthly",
    valid_from: "2026-03-01",
    valid_until: "2026-03-31",
    status: "active",
    vehicle_type: "car",
    created_at: "2026-01-15T00:00:00Z",
  },
  {
    id: "m-002",
    location_id: "loc-1",
    plate_number: "D 5678 ABC",
    name: "Siti Nurhaliza",
    phone: "082345678901",
    email: "siti@email.com",
    pass_type: "quarterly",
    valid_from: "2026-01-01",
    valid_until: "2026-03-25",
    status: "expiring",
    vehicle_type: "motorcycle",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "m-003",
    location_id: "loc-1",
    plate_number: "B 9012 DEF",
    name: "Budi Santoso",
    phone: "083456789012",
    email: "budi@email.com",
    pass_type: "annual",
    valid_from: "2025-06-01",
    valid_until: "2026-06-01",
    status: "active",
    vehicle_type: "car",
    created_at: "2025-06-01T00:00:00Z",
  },
  {
    id: "m-004",
    location_id: "loc-1",
    plate_number: "F 3456 GHI",
    name: "Dewi Lestari",
    phone: "084567890123",
    email: "dewi@email.com",
    pass_type: "monthly",
    valid_from: "2026-02-01",
    valid_until: "2026-02-28",
    status: "expired",
    vehicle_type: "car",
    created_at: "2025-12-01T00:00:00Z",
  },
  {
    id: "m-005",
    location_id: "loc-1",
    plate_number: "B 7890 JKL",
    name: "Eko Prasetyo",
    phone: "085678901234",
    pass_type: "monthly",
    valid_from: "2026-03-01",
    valid_until: "2026-03-28",
    status: "expiring",
    vehicle_type: "motorcycle",
    created_at: "2026-03-01T00:00:00Z",
  },
];

export default function MembersPage() {
  const { locale } = useAppStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  const t = (en: string, id: string) => (locale === "en" ? en : id);

  const filteredMembers = useMemo(() => {
    return demoMembers.filter((member) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !member.plate_number.toLowerCase().includes(q) &&
          !member.name.toLowerCase().includes(q) &&
          !member.phone.includes(q)
        ) {
          return false;
        }
      }
      if (statusFilter !== "all" && member.status !== statusFilter) return false;
      return true;
    });
  }, [searchQuery, statusFilter]);

  const handleAddMember = () => {
    setEditingMember(null);
    setFormOpen(true);
  };

  const handleEditMember = (member: Member) => {
    setEditingMember(member);
    setFormOpen(true);
  };

  const handleSubmit = (data: MemberFormData) => {
    console.log("Submit member:", data);
    setFormOpen(false);
  };

  const passTypeLabel = (type: string) => {
    const labels: Record<string, string> = locale === "en"
      ? { monthly: "Monthly", quarterly: "Quarterly", annual: "Annual" }
      : { monthly: "Bulanan", quarterly: "Triwulan", annual: "Tahunan" };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-text-primary">
          {t("Members", "Anggota")}
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Upload className="h-4 w-4" />
            {t("Bulk Import CSV", "Impor CSV Massal")}
          </Button>
          <Button size="sm" className="gap-2" onClick={handleAddMember}>
            <Plus className="h-4 w-4" />
            {t("Add Member", "Tambah Anggota")}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t(
                  "Search by plate, name, or phone...",
                  "Cari plat, nama, atau telepon..."
                )}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("All Members", "Semua Anggota")}
                </SelectItem>
                <SelectItem value="active">
                  {t("Active", "Aktif")}
                </SelectItem>
                <SelectItem value="expiring">
                  {t("Expiring Soon", "Segera Berakhir")}
                </SelectItem>
                <SelectItem value="expired">
                  {t("Expired", "Kedaluwarsa")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Members Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Plate", "Plat")}</TableHead>
                <TableHead>{t("Name", "Nama")}</TableHead>
                <TableHead>{t("Phone", "Telepon")}</TableHead>
                <TableHead>{t("Pass Type", "Jenis Pass")}</TableHead>
                <TableHead>{t("Valid Until", "Berlaku Sampai")}</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>{t("Actions", "Aksi")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-text-tertiary py-8"
                  >
                    {t("No members found", "Tidak ada anggota ditemukan")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredMembers.map((member) => {
                  const daysLeft = differenceInDays(
                    new Date(member.valid_until),
                    new Date()
                  );
                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <PlateDisplay plate={member.plate_number} size="sm" />
                      </TableCell>
                      <TableCell className="text-sm text-text-primary font-semibold">
                        {member.name}
                      </TableCell>
                      <TableCell className="text-sm text-text-secondary">
                        {member.phone}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {passTypeLabel(member.pass_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-text-secondary">
                        {format(new Date(member.valid_until), "dd MMM yyyy")}
                        {daysLeft > 0 && daysLeft <= 7 && (
                          <span className="text-xs text-amber ml-1">
                            ({daysLeft}d)
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge type="member" value={member.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditMember(member)}
                          >
                            {t("Edit", "Edit")}
                          </Button>
                          {(member.status === "expiring" ||
                            member.status === "expired") && (
                            <Button size="sm" className="gap-1">
                              <RefreshCw className="h-3 w-3" />
                              {t("Renew", "Perpanjang")}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <MemberForm
        member={editingMember}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
