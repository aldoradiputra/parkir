"use client";

import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { formatRelativeTime } from "@/lib/utils";
import { ArrowDownLeft, ArrowUpRight, Activity } from "lucide-react";
import type { Lane } from "@/types";

interface LaneCardProps {
  lane: Lane;
}

export function LaneCard({ lane }: LaneCardProps) {
  const DirectionIcon =
    lane.direction === "entry" ? ArrowDownLeft : ArrowUpRight;

  return (
    <Card className="hover:border-border/80 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <DirectionIcon className="h-4 w-4 text-text-tertiary" />
            <span className="font-semibold text-sm text-text-primary">
              {lane.name}
            </span>
          </div>
          <StatusBadge type="lane" value={lane.status} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-tertiary">Gate</span>
            <StatusBadge type="gate" value={lane.gate_state} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-text-tertiary">Last heartbeat</span>
            <span className="text-xs text-text-secondary">
              {formatRelativeTime(lane.last_heartbeat)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-text-tertiary">Sessions today</span>
            <div className="flex items-center gap-1">
              <Activity className="h-3 w-3 text-text-tertiary" />
              <span className="text-sm font-semibold text-text-primary">
                {lane.sessions_today}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
