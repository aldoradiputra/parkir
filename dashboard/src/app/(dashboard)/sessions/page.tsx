"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { SessionDetail } from "@/components/session-detail";
import { formatRupiah, formatDuration } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { Search, Download, Car, Bike } from "lucide-react";
import { format } from "date-fns";
import type { Session, VehicleType, PaymentStatus, PaymentMethod } from "@/types";

const demoSessions: Session[] = [
  {
    id: "s-001",
    location_id: "loc-1",
    plate_number: "B 1234 KJP",
    vehicle_type: "car",
    entry_lane_id: "lane-1",
    exit_lane_id: "lane-3",
    entry_time: "2026-03-21T08:30:00Z",
    exit_time: "2026-03-21T10:45:00Z",
    duration_minutes: 135,
    amount: 15000,
    payment_method: "qris",
    payment_status: "paid",
    is_member: false,
  },
  {
    id: "s-002",
    location_id: "loc-1",
    plate_number: "D 5678 ABC",
    vehicle_type: "motorcycle",
    entry_lane_id: "lane-2",
    exit_lane_id: "lane-3",
    entry_time: "2026-03-21T07:15:00Z",
    exit_time: "2026-03-21T09:20:00Z",
    duration_minutes: 125,
    amount: 0,
    payment_method: "member",
    payment_status: "paid",
    is_member: true,
    member_id: "m-001",
  },
  {
    id: "s-003",
    location_id: "loc-1",
    plate_number: "B 9012 DEF",
    vehicle_type: "car",
    entry_lane_id: "lane-1",
    entry_time: "2026-03-21T11:00:00Z",
    duration_minutes: 45,
    payment_status: "pending",
    is_member: false,
  },
  {
    id: "s-004",
    location_id: "loc-1",
    plate_number: "F 3456 GHI",
    vehicle_type: "car",
    entry_lane_id: "lane-2",
    exit_lane_id: "lane-3",
    entry_time: "2026-03-21T06:00:00Z",
    exit_time: "2026-03-21T08:30:00Z",
    duration_minutes: 150,
    amount: 15000,
    payment_method: "cash",
    payment_status: "paid",
    is_member: false,
  },
  {
    id: "s-005",
    location_id: "loc-1",
    plate_number: "B 7890 JKL",
    vehicle_type: "motorcycle",
    entry_lane_id: "lane-1",
    exit_lane_id: "lane-4",
    entry_time: "2026-03-21T09:00:00Z",
    exit_time: "2026-03-21T09:10:00Z",
    duration_minutes: 10,
    amount: 2000,
    payment_method: "nfc",
    payment_status: "paid",
    is_member: false,
  },
  {
    id: "s-006",
    location_id: "loc-1",
    plate_number: "B 4321 MNO",
    vehicle_type: "car",
    entry_lane_id: "lane-1",
    exit_lane_id: "lane-3",
    entry_time: "2026-03-21T10:00:00Z",
    exit_time: "2026-03-21T12:00:00Z",
    duration_minutes: 120,
    amount: 10000,
    payment_method: "cash",
    payment_status: "override",
    is_member: false,
  },
  {
    id: "s-007",
    location_id: "loc-1",
    plate_number: "AB 1122 PQR",
    vehicle_type: "motorcycle",
    entry_lane_id: "lane-2",
    exit_lane_id: "lane-4",
    entry_time: "2026-03-20T22:00:00Z",
    exit_time: "2026-03-21T06:00:00Z",
    duration_minutes: 480,
    amount: 0,
    payment_method: "manual",
    payment_status: "failed",
    is_member: false,
  },
];

export default function SessionsPage() {
  const { locale } = useAppStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const filteredSessions = useMemo(() => {
    return demoSessions.filter((session) => {
      if (
        searchQuery &&
        !session.plate_number
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      if (vehicleFilter !== "all" && session.vehicle_type !== vehicleFilter) {
        return false;
      }
      if (statusFilter !== "all" && session.payment_status !== statusFilter) {
        return false;
      }
      if (
        paymentFilter !== "all" &&
        session.payment_method !== paymentFilter
      ) {
        return false;
      }
      return true;
    });
  }, [searchQuery, vehicleFilter, statusFilter, paymentFilter]);

  const handleRowClick = (session: Session) => {
    setSelectedSession(session);
    setDetailOpen(true);
  };

  const t = (en: string, id: string) => (locale === "en" ? en : id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">
          {t("Sessions", "Sesi")}
        </h1>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          {t("Export CSV", "Ekspor CSV")}
        </Button>
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
                placeholder={t("Search plate number...", "Cari nomor plat...")}
                className="pl-9"
              />
            </div>
            <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder={t("Vehicle", "Kendaraan")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Types", "Semua")}</SelectItem>
                <SelectItem value="car">{t("Car", "Mobil")}</SelectItem>
                <SelectItem value="motorcycle">{t("Motorcycle", "Motor")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Status", "Semua")}</SelectItem>
                <SelectItem value="paid">{t("Paid", "Lunas")}</SelectItem>
                <SelectItem value="pending">{t("Pending", "Tertunda")}</SelectItem>
                <SelectItem value="override">Override</SelectItem>
                <SelectItem value="failed">{t("Failed", "Gagal")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder={t("Payment", "Pembayaran")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All", "Semua")}</SelectItem>
                <SelectItem value="cash">{t("Cash", "Tunai")}</SelectItem>
                <SelectItem value="qris">QRIS</SelectItem>
                <SelectItem value="nfc">NFC</SelectItem>
                <SelectItem value="member">{t("Member", "Anggota")}</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Sessions Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Plate", "Plat")}</TableHead>
                <TableHead>{t("Type", "Jenis")}</TableHead>
                <TableHead>{t("Entry Time", "Waktu Masuk")}</TableHead>
                <TableHead>{t("Exit Time", "Waktu Keluar")}</TableHead>
                <TableHead>{t("Duration", "Durasi")}</TableHead>
                <TableHead>{t("Amount", "Jumlah")}</TableHead>
                <TableHead>{t("Payment", "Pembayaran")}</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSessions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-text-tertiary py-8"
                  >
                    {t("No sessions found", "Tidak ada sesi ditemukan")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredSessions.map((session) => (
                  <TableRow
                    key={session.id}
                    className="cursor-pointer"
                    onClick={() => handleRowClick(session)}
                  >
                    <TableCell>
                      <PlateDisplay plate={session.plate_number} size="sm" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-text-secondary text-sm">
                        {session.vehicle_type === "car" ? (
                          <Car className="h-3.5 w-3.5" />
                        ) : (
                          <Bike className="h-3.5 w-3.5" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-text-secondary">
                      {format(new Date(session.entry_time), "dd/MM HH:mm")}
                    </TableCell>
                    <TableCell className="text-sm text-text-secondary">
                      {session.exit_time
                        ? format(new Date(session.exit_time), "dd/MM HH:mm")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-text-primary">
                      {session.duration_minutes
                        ? formatDuration(session.duration_minutes)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-text-primary">
                      {session.amount != null
                        ? formatRupiah(session.amount)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-text-secondary uppercase">
                      {session.payment_method || "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        type="payment"
                        value={session.payment_status}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <SessionDetail
        session={selectedSession}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
