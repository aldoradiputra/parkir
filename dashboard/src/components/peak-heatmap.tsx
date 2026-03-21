"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PeakHourData } from "@/types";

interface PeakHeatmapProps {
  data: PeakHourData[];
  title?: string;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getIntensityClass(count: number, maxCount: number): string {
  if (maxCount === 0) return "bg-surface-elevated";
  const ratio = count / maxCount;
  if (ratio === 0) return "bg-surface-elevated";
  if (ratio < 0.25) return "bg-amber/10";
  if (ratio < 0.5) return "bg-amber/25";
  if (ratio < 0.75) return "bg-amber/50";
  return "bg-amber/80";
}

export function PeakHeatmap({ data, title = "Peak Hours" }: PeakHeatmapProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  const getCount = (hour: number, day: number) => {
    const entry = data.find((d) => d.hour === hour && d.day === day);
    return entry?.count ?? 0;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Hour labels */}
            <div className="flex mb-1">
              <div className="w-10 shrink-0" />
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="flex-1 text-center text-[10px] text-text-tertiary"
                >
                  {hour % 3 === 0 ? `${hour.toString().padStart(2, "0")}` : ""}
                </div>
              ))}
            </div>

            {/* Grid */}
            <TooltipProvider delayDuration={100}>
              {DAYS.map((day, dayIndex) => (
                <div key={day} className="flex items-center mb-[2px]">
                  <div className="w-10 shrink-0 text-xs text-text-tertiary">
                    {day}
                  </div>
                  {HOURS.map((hour) => {
                    const count = getCount(hour, dayIndex);
                    return (
                      <Tooltip key={`${day}-${hour}`}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "flex-1 aspect-square mx-[1px] rounded-sm cursor-pointer transition-colors",
                              getIntensityClass(count, maxCount)
                            )}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">
                            {day} {hour.toString().padStart(2, "0")}:00 -{" "}
                            {count} sessions
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </TooltipProvider>

            {/* Legend */}
            <div className="flex items-center justify-end gap-2 mt-3">
              <span className="text-xs text-text-tertiary">Less</span>
              {["bg-surface-elevated", "bg-amber/10", "bg-amber/25", "bg-amber/50", "bg-amber/80"].map(
                (cls, i) => (
                  <div key={i} className={cn("h-3 w-3 rounded-sm", cls)} />
                )
              )}
              <span className="text-xs text-text-tertiary">More</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
