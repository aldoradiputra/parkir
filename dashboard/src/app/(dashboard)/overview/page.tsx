"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LaneCard } from "@/components/lane-card";
import { OccupancyGauge } from "@/components/occupancy-gauge";
import { PlateDisplay } from "@/components/plate-display";
import { StatusBadge } from "@/components/status-badge";
import { SessionDetail } from "@/components/session-detail";
import { formatRupiah, formatDuration, formatRelativeTime } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import {
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Car,
  Bike,
  Clock,
} from "lucide-react";
import type { Lane, Session, Alert, OccupancyData } from "@/types";

// Demo data
const demoLanes: Lane[] = [
  {
    id: "lane-1",
    location_id: "loc-1",
    name: "Entry A",
    direction: "entry",
    status: "online",
    gate_state: "closed",
    last_heartbeat: new Date(Date.now() - 15000).toISOString(),
    firmware_version: "2.4.1",
    sessions_today: 142,
    ip_address: "192.168.1.10",
  },
  {
    id: "lane-2",
    location_id: "loc-1",
    name: "Entry B",
    direction: "entry",
    status: "online",
    gate_state: "closed",
    last_heartbeat: new Date(Date.now() - 8000).toISOString(),
    firmware_version: "2.4.1",
    sessions_today: 98,
    ip_address: "192.168.1.11",
  },
  {
    id: "lane-3",
    location_id: "loc-1",
    name: "Exit A",
    direction: "exit",
    status: "online",
    gate_state: "open",
    last_heartbeat: new Date(Date.now() - 3000).toISOString(),
    firmware_version: "2.4.1",
    sessions_today: 127,
    ip_address: "192.168.1.20",
  },
  {
    id: "lane-4",
    location_id: "loc-1",
    name: "Exit B",
    direction: "exit",
    status: "offline",
    gate_state: "error",
    last_heartbeat: new Date(Date.now() - 300000).toISOString(),
    firmware_version: "2.3.8",
    sessions_today: 0,
    ip_address: "192.168.1.21",
  },
];

const demoOccupancy: OccupancyData = {
  cars_current: 187,
  cars_capacity: 250,
  motorcycles_current: 312,
  motorcycles_capacity: 500,
};

const demoSessions: Session[] = [
  {
    id: "s-001",
    location_id: "loc-1",
    plate_number: "B 1234 KJP",
    vehicle_type: "car",
    entry_lane_id: "lane-1",
    entry_time: new Date(Date.now() - 3600000).toISOString(),
    duration_minutes: 60,
    payment_status: "pending",
    is_member: false,
  },
  {
    id: "s-002",
    location_id: "loc-1",
    plate_number: "D 5678 ABC",
    vehicle_type: "motorcycle",
    entry_lane_id: "lane-2",
    entry_time: new Date(Date.now() - 7200000).toISOString(),
    duration_minutes: 120,
    payment_status: "pending",
    is_member: true,
    member_id: "m-001",
  },
  {
    id: "s-003",
    location_id: "loc-1",
    plate_number: "B 9012 DEF",
    vehicle_type: "car",
    entry_lane_id: "lane-1",
    entry_time: new Date(Date.now() - 1800000).toISOString(),
    duration_minutes: 30,
    payment_status: "pending",
    is_member: false,
  },
  {
    id: "s-004",
    location_id: "loc-1",
    plate_number: "F 3456 GHI",
    vehicle_type: "car",
    entry_lane_id: "lane-2",
    entry_time: new Date(Date.now() - 5400000).toISOString(),
    duration_minutes: 90,
    payment_status: "pending",
    is_member: false,
  },
  {
    id: "s-005",
    location_id: "loc-1",
    plate_number: "B 7890 JKL",
    vehicle_type: "motorcycle",
    entry_lane_id: "lane-1",
    entry_time: new Date(Date.now() - 900000).toISOString(),
    duration_minutes: 15,
    payment_status: "pending",
    is_member: false,
  },
];

const demoAlerts: Alert[] = [
  {
    id: "a-1",
    location_id: "loc-1",
    lane_id: "lane-4",
    severity: "critical",
    title: "Lane Exit B offline",
    message: "Device has not sent heartbeat for 5 minutes. Gate sensor error detected.",
    timestamp: new Date(Date.now() - 300000).toISOString(),
    resolved: false,
  },
  {
    id: "a-2",
    location_id: "loc-1",
    severity: "warning",
    title: "High occupancy",
    message: "Car parking is at 75% capacity.",
    timestamp: new Date(Date.now() - 600000).toISOString(),
    resolved: false,
  },
];

export default function OverviewPage() {
  const { locale } = useAppStore();
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const todayRevenue = 12450000;

  const handleSessionClick = (session: Session) => {
    setSelectedSession(session);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-text-primary">
        {locale === "en" ? "Live Overview" : "Ringkasan Langsung"}
      </h1>

      {/* Lane Status Grid */}
      <section>
        <h2 className="text-sm font-semibold text-text-secondary mb-3">
          {locale === "en" ? "Lane Status" : "Status Jalur"}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {demoLanes.map((lane) => (
            <LaneCard key={lane.id} lane={lane} />
          ))}
        </div>
      </section>

      {/* Occupancy + Revenue row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <OccupancyGauge
          data={demoOccupancy}
          title={locale === "en" ? "Live Occupancy" : "Okupansi Langsung"}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-amber" />
              {locale === "en" ? "Today's Revenue" : "Pendapatan Hari Ini"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-text-primary mb-4">
              {formatRupiah(todayRevenue)}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-surface-overlay p-3">
                <p className="text-xs text-text-tertiary mb-1">
                  {locale === "en" ? "Car sessions" : "Sesi mobil"}
                </p>
                <div className="flex items-center gap-1.5">
                  <Car className="h-4 w-4 text-text-secondary" />
                  <span className="text-lg font-semibold text-text-primary">
                    240
                  </span>
                </div>
              </div>
              <div className="rounded-lg bg-surface-overlay p-3">
                <p className="text-xs text-text-tertiary mb-1">
                  {locale === "en" ? "Motorcycle sessions" : "Sesi motor"}
                </p>
                <div className="flex items-center gap-1.5">
                  <Bike className="h-4 w-4 text-text-secondary" />
                  <span className="text-lg font-semibold text-text-primary">
                    367
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-text-tertiary" />
            {locale === "en" ? "Active Sessions" : "Sesi Aktif"}
            <Badge variant="default" className="ml-2">
              {demoSessions.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {locale === "en" ? "Plate" : "Plat"}
                </TableHead>
                <TableHead>
                  {locale === "en" ? "Type" : "Jenis"}
                </TableHead>
                <TableHead>
                  {locale === "en" ? "Entry Time" : "Waktu Masuk"}
                </TableHead>
                <TableHead>
                  {locale === "en" ? "Duration" : "Durasi"}
                </TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demoSessions.map((session) => (
                <TableRow
                  key={session.id}
                  className="cursor-pointer"
                  onClick={() => handleSessionClick(session)}
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
                      <span className="capitalize">{session.vehicle_type}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-text-secondary">
                    {formatRelativeTime(session.entry_time)}
                  </TableCell>
                  <TableCell className="text-sm text-text-primary font-semibold">
                    {session.duration_minutes
                      ? formatDuration(session.duration_minutes)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      type="payment"
                      value={session.payment_status}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Unresolved Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber" />
            {locale === "en" ? "Unresolved Alerts" : "Peringatan Belum Selesai"}
            {demoAlerts.length > 0 && (
              <Badge variant="error" className="ml-2">
                {demoAlerts.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {demoAlerts.length === 0 ? (
            <div className="flex items-center gap-2 text-text-tertiary text-sm py-4">
              <CheckCircle className="h-4 w-4 text-success" />
              {locale === "en" ? "No unresolved alerts" : "Tidak ada peringatan"}
            </div>
          ) : (
            <div className="space-y-3">
              {demoAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-surface-overlay p-3"
                >
                  <AlertTriangle
                    className={`h-4 w-4 mt-0.5 shrink-0 ${
                      alert.severity === "critical"
                        ? "text-error"
                        : alert.severity === "warning"
                        ? "text-amber"
                        : "text-info"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-text-primary">
                        {alert.title}
                      </p>
                      <Badge
                        variant={
                          alert.severity === "critical"
                            ? "error"
                            : alert.severity === "warning"
                            ? "warning"
                            : "info"
                        }
                      >
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-text-secondary mt-1">
                      {alert.message}
                    </p>
                    <p className="text-xs text-text-tertiary mt-1">
                      {formatRelativeTime(alert.timestamp)}
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    {locale === "en" ? "Resolve" : "Selesaikan"}
                  </Button>
                </div>
              ))}
            </div>
          )}
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
