import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  LaneStatus,
  GateState,
  PaymentStatus,
  MemberStatus,
} from "@/types";

interface StatusBadgeProps {
  type: "lane" | "gate" | "payment" | "member";
  value: string;
  className?: string;
}

const statusConfig: Record<
  string,
  { label: string; variant: "success" | "warning" | "error" | "info" | "default"; dot?: boolean }
> = {
  // Lane statuses
  online: { label: "Online", variant: "success", dot: true },
  offline: { label: "Offline", variant: "error", dot: true },
  syncing: { label: "Syncing", variant: "warning", dot: true },
  // Gate states
  open: { label: "Open", variant: "success" },
  closed: { label: "Closed", variant: "default" },
  moving: { label: "Moving", variant: "warning" },
  error: { label: "Error", variant: "error" },
  // Payment statuses
  paid: { label: "Paid", variant: "success" },
  pending: { label: "Pending", variant: "warning" },
  override: { label: "Override", variant: "info" },
  failed: { label: "Failed", variant: "error" },
  // Member statuses
  active: { label: "Active", variant: "success" },
  expiring: { label: "Expiring", variant: "warning" },
  expired: { label: "Expired", variant: "error" },
};

export function StatusBadge({ type, value, className }: StatusBadgeProps) {
  const config = statusConfig[value] || {
    label: value,
    variant: "default" as const,
  };

  return (
    <Badge variant={config.variant} className={cn("gap-1.5", className)}>
      {config.dot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", {
            "bg-success": config.variant === "success",
            "bg-error": config.variant === "error",
            "bg-amber": config.variant === "warning",
          })}
        />
      )}
      {config.label}
    </Badge>
  );
}
