"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, Bike } from "lucide-react";
import type { OccupancyData } from "@/types";

interface OccupancyGaugeProps {
  data: OccupancyData;
  title?: string;
}

function GaugeBar({
  current,
  capacity,
  label,
  icon: Icon,
}: {
  current: number;
  capacity: number;
  label: string;
  icon: React.ElementType;
}) {
  const percentage = capacity > 0 ? Math.min((current / capacity) * 100, 100) : 0;
  const isHigh = percentage > 85;
  const isMedium = percentage > 60;

  const barColor = isHigh
    ? "bg-error"
    : isMedium
    ? "bg-amber"
    : "bg-success";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-text-tertiary" />
          <span className="text-sm font-semibold text-text-primary">
            {label}
          </span>
        </div>
        <span className="text-sm text-text-secondary">
          {current} / {capacity}
        </span>
      </div>
      <div className="h-3 w-full rounded-md bg-surface-elevated overflow-hidden">
        <div
          className={`h-full rounded-md transition-all duration-500 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-text-tertiary">
        <span>{percentage.toFixed(0)}% occupied</span>
        <span>{capacity - current} available</span>
      </div>
    </div>
  );
}

export function OccupancyGauge({ data, title = "Live Occupancy" }: OccupancyGaugeProps) {
  const totalCurrent = data.cars_current + data.motorcycles_current;
  const totalCapacity = data.cars_capacity + data.motorcycles_capacity;
  const totalPercentage =
    totalCapacity > 0 ? Math.min((totalCurrent / totalCapacity) * 100, 100) : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <span className="text-2xl font-semibold text-text-primary">
            {totalPercentage.toFixed(0)}%
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <GaugeBar
          current={data.cars_current}
          capacity={data.cars_capacity}
          label="Cars"
          icon={Car}
        />
        <GaugeBar
          current={data.motorcycles_current}
          capacity={data.motorcycles_capacity}
          label="Motorcycles"
          icon={Bike}
        />
      </CardContent>
    </Card>
  );
}
