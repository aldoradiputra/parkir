"use client";

import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/types";

const steps: { key: ProjectStatus; label: string }[] = [
  { key: "planning", label: "Planning" },
  { key: "procurement", label: "Procurement" },
  { key: "installation", label: "Installation" },
  { key: "testing", label: "Testing" },
  { key: "live", label: "Live" },
];

const stepIndex: Record<string, number> = {};
steps.forEach((s, i) => { stepIndex[s.key] = i; });

interface ProjectStatusBarProps {
  status: ProjectStatus;
}

export function ProjectStatusBar({ status }: ProjectStatusBarProps) {
  const currentIdx = stepIndex[status] ?? -1;

  if (status === "cancelled" || status === "maintenance") {
    return (
      <div className="flex items-center gap-2">
        <span className={cn(
          "text-sm font-medium px-3 py-1 rounded-full",
          status === "cancelled"
            ? "bg-red-500/15 text-red-400"
            : "bg-teal-500/15 text-teal-400"
        )}>
          {status === "cancelled" ? "Cancelled" : "Maintenance"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => {
        const isPast = i < currentIdx;
        const isCurrent = i === currentIdx;
        const isFuture = i > currentIdx;

        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={cn(
                  "w-full h-2 rounded-full transition-colors",
                  isPast && "bg-green-500",
                  isCurrent && "bg-amber",
                  isFuture && "bg-surface-overlay"
                )}
              />
              <span
                className={cn(
                  "text-[10px] mt-1.5 whitespace-nowrap",
                  isCurrent ? "text-amber font-semibold" : isPast ? "text-green-400" : "text-text-tertiary"
                )}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
