"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";
import { formatRelativeTime } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import {
  DoorOpen,
  Upload,
  AlertTriangle,
  Wifi,
  WifiOff,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { Lane, LaneError } from "@/types";

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
    error_log: [],
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
    error_log: [
      {
        id: "e-1",
        lane_id: "lane-2",
        message: "Camera focus calibration warning",
        severity: "warning",
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        resolved: false,
      },
    ],
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
    error_log: [],
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
    error_log: [
      {
        id: "e-2",
        lane_id: "lane-4",
        message: "Gate motor sensor failure - no response from actuator",
        severity: "critical",
        timestamp: new Date(Date.now() - 300000).toISOString(),
        resolved: false,
      },
      {
        id: "e-3",
        lane_id: "lane-4",
        message: "Heartbeat timeout - device unreachable",
        severity: "critical",
        timestamp: new Date(Date.now() - 290000).toISOString(),
        resolved: false,
      },
    ],
  },
];

export default function DevicesPage() {
  const { locale } = useAppStore();
  const [gateDialogOpen, setGateDialogOpen] = useState(false);
  const [selectedLane, setSelectedLane] = useState<Lane | null>(null);
  const [pin, setPin] = useState("");
  const [expandedLane, setExpandedLane] = useState<string | null>(null);

  const t = (en: string, id: string) => (locale === "en" ? en : id);

  const handleOpenGate = (lane: Lane) => {
    setSelectedLane(lane);
    setPin("");
    setGateDialogOpen(true);
  };

  const confirmOpenGate = () => {
    console.log("Open gate for lane:", selectedLane?.id, "PIN:", pin);
    setGateDialogOpen(false);
    setPin("");
  };

  const handlePushConfig = (lane: Lane) => {
    console.log("Push config to lane:", lane.id);
  };

  const toggleErrorLog = (laneId: string) => {
    setExpandedLane(expandedLane === laneId ? null : laneId);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-text-primary">
        {t("Devices", "Perangkat")}
      </h1>

      <div className="space-y-3">
        {demoLanes.map((lane) => {
          const isExpanded = expandedLane === lane.id;
          const errorCount = lane.error_log?.filter((e) => !e.resolved).length || 0;

          return (
            <Card key={lane.id}>
              <CardContent className="p-0">
                {/* Lane row */}
                <div className="flex items-center gap-4 p-4 flex-wrap">
                  <div className="flex items-center gap-2 min-w-[140px]">
                    {lane.direction === "entry" ? (
                      <ArrowDownLeft className="h-4 w-4 text-text-tertiary" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 text-text-tertiary" />
                    )}
                    <span className="font-semibold text-sm text-text-primary">
                      {lane.name}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {lane.direction === "entry"
                        ? t("Entry", "Masuk")
                        : t("Exit", "Keluar")}
                    </Badge>
                  </div>

                  <StatusBadge type="lane" value={lane.status} />
                  <StatusBadge type="gate" value={lane.gate_state} />

                  <div className="text-xs text-text-tertiary">
                    <span className="text-text-secondary">{t("Heartbeat:", "Heartbeat:")}</span>{" "}
                    {formatRelativeTime(lane.last_heartbeat)}
                  </div>

                  <div className="text-xs text-text-tertiary">
                    <span className="text-text-secondary">FW:</span>{" "}
                    {lane.firmware_version}
                  </div>

                  <div className="text-xs text-text-tertiary">
                    <span className="text-text-secondary">IP:</span>{" "}
                    {lane.ip_address}
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    {errorCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-amber"
                        onClick={() => toggleErrorLog(lane.id)}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {errorCount}
                        {isExpanded ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => handlePushConfig(lane)}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {t("Push Config", "Push Config")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => handleOpenGate(lane)}
                      disabled={lane.status === "offline"}
                    >
                      <DoorOpen className="h-3.5 w-3.5" />
                      {t("Open Gate", "Buka Gerbang")}
                    </Button>
                  </div>
                </div>

                {/* Error log expandable */}
                {isExpanded && lane.error_log && lane.error_log.length > 0 && (
                  <div className="border-t border-border bg-surface-overlay px-4 py-3 space-y-2">
                    <p className="text-xs font-semibold text-text-secondary mb-2">
                      {t("Error Log", "Log Error")}
                    </p>
                    {lane.error_log.map((err) => (
                      <div
                        key={err.id}
                        className="flex items-start gap-2 text-xs"
                      >
                        <AlertTriangle
                          className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${
                            err.severity === "critical"
                              ? "text-error"
                              : err.severity === "warning"
                              ? "text-amber"
                              : "text-info"
                          }`}
                        />
                        <div className="flex-1">
                          <p className="text-text-primary">{err.message}</p>
                          <p className="text-text-tertiary mt-0.5">
                            {formatRelativeTime(err.timestamp)}
                          </p>
                        </div>
                        <Badge
                          variant={
                            err.severity === "critical"
                              ? "error"
                              : err.severity === "warning"
                              ? "warning"
                              : "info"
                          }
                        >
                          {err.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {isExpanded &&
                  (!lane.error_log || lane.error_log.length === 0) && (
                    <div className="border-t border-border bg-surface-overlay px-4 py-3">
                      <p className="text-xs text-text-tertiary">
                        {t("No errors recorded", "Tidak ada error tercatat")}
                      </p>
                    </div>
                  )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Gate Open PIN Confirmation */}
      <Dialog open={gateDialogOpen} onOpenChange={setGateDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("Open Gate Remotely", "Buka Gerbang Remote")}</DialogTitle>
            <DialogDescription>
              {t(
                "Enter PIN to open gate remotely",
                "Masukkan PIN untuk membuka gerbang secara remote"
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedLane && (
            <p className="text-sm text-text-secondary">
              {t("Lane:", "Jalur:")} {selectedLane.name}
            </p>
          )}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-text-secondary">
              PIN
            </label>
            <Input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter PIN"
              maxLength={6}
              className="text-center tracking-[0.3em] text-lg"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGateDialogOpen(false)}
            >
              {t("Cancel", "Batal")}
            </Button>
            <Button onClick={confirmOpenGate} disabled={pin.length < 4}>
              {t("Open Gate", "Buka Gerbang")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
