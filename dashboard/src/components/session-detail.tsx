"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PlateDisplay } from "@/components/plate-display";
import { StatusBadge } from "@/components/status-badge";
import { Separator } from "@/components/ui/separator";
import { formatRupiah, formatDuration } from "@/lib/utils";
import { format } from "date-fns";
import { Car, Bike, Clock, CreditCard, Camera } from "lucide-react";
import type { Session } from "@/types";

interface SessionDetailProps {
  session: Session | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SessionDetail({
  session,
  open,
  onOpenChange,
}: SessionDetailProps) {
  if (!session) return null;

  const VehicleIcon = session.vehicle_type === "car" ? Car : Bike;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Session Detail
          </DialogTitle>
          <DialogDescription>
            Session ID: {session.id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Plate and vehicle info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <PlateDisplay plate={session.plate_number} size="lg" />
              <div className="flex items-center gap-1.5 text-text-secondary">
                <VehicleIcon className="h-4 w-4" />
                <span className="text-sm capitalize">
                  {session.vehicle_type}
                </span>
              </div>
            </div>
            <StatusBadge type="payment" value={session.payment_status} />
          </div>

          {session.is_member && (
            <Badge variant="info">Member</Badge>
          )}

          <Separator />

          {/* Time details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-text-tertiary text-xs">
                <Clock className="h-3 w-3" />
                Entry Time
              </div>
              <p className="text-sm font-semibold text-text-primary">
                {format(new Date(session.entry_time), "dd MMM yyyy HH:mm:ss")}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-text-tertiary text-xs">
                <Clock className="h-3 w-3" />
                Exit Time
              </div>
              <p className="text-sm font-semibold text-text-primary">
                {session.exit_time
                  ? format(
                      new Date(session.exit_time),
                      "dd MMM yyyy HH:mm:ss"
                    )
                  : "—"}
              </p>
            </div>
          </div>

          {/* Duration and amount */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-text-tertiary">Duration</p>
              <p className="text-sm font-semibold text-text-primary">
                {session.duration_minutes
                  ? formatDuration(session.duration_minutes)
                  : "Ongoing"}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-text-tertiary text-xs">
                <CreditCard className="h-3 w-3" />
                Amount
              </div>
              <p className="text-sm font-semibold text-text-primary">
                {session.amount != null ? formatRupiah(session.amount) : "—"}
              </p>
              {session.payment_method && (
                <p className="text-xs text-text-secondary uppercase">
                  {session.payment_method}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Photos */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-text-tertiary text-xs">
                <Camera className="h-3 w-3" />
                Entry Photo
              </div>
              {session.entry_photo_url ? (
                <div className="aspect-video rounded-lg overflow-hidden bg-surface-elevated border border-border">
                  <img
                    src={session.entry_photo_url}
                    alt="Entry"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-video rounded-lg bg-surface-elevated border border-border flex items-center justify-center">
                  <span className="text-xs text-text-tertiary">
                    No photo available
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-text-tertiary text-xs">
                <Camera className="h-3 w-3" />
                Exit Photo
              </div>
              {session.exit_photo_url ? (
                <div className="aspect-video rounded-lg overflow-hidden bg-surface-elevated border border-border">
                  <img
                    src={session.exit_photo_url}
                    alt="Exit"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-video rounded-lg bg-surface-elevated border border-border flex items-center justify-center">
                  <span className="text-xs text-text-tertiary">
                    No photo available
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
