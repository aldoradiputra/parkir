"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Member, VehicleType, MemberPassType } from "@/types";

interface MemberFormProps {
  member?: Member | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: MemberFormData) => void;
}

export interface MemberFormData {
  plate_number: string;
  name: string;
  phone: string;
  email: string;
  vehicle_type: VehicleType;
  pass_type: MemberPassType;
  valid_from: string;
  valid_until: string;
}

export function MemberForm({
  member,
  open,
  onOpenChange,
  onSubmit,
}: MemberFormProps) {
  const [formData, setFormData] = useState<MemberFormData>({
    plate_number: member?.plate_number || "",
    name: member?.name || "",
    phone: member?.phone || "",
    email: member?.email || "",
    vehicle_type: member?.vehicle_type || "car",
    pass_type: member?.pass_type || "monthly",
    valid_from: member?.valid_from || new Date().toISOString().split("T")[0],
    valid_until: member?.valid_until || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const updateField = (field: keyof MemberFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{member ? "Edit Member" : "Add Member"}</DialogTitle>
          <DialogDescription>
            {member
              ? "Update member information below."
              : "Fill in the details to add a new member."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-text-secondary">
              Plate Number
            </label>
            <Input
              value={formData.plate_number}
              onChange={(e) =>
                updateField("plate_number", e.target.value.toUpperCase())
              }
              placeholder="B 1234 ABC"
              className="font-mono tracking-wider"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-text-secondary">
              Name
            </label>
            <Input
              value={formData.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="Full name"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-secondary">
                Phone
              </label>
              <Input
                value={formData.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="08xxxxxxxxxx"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-secondary">
                Email
              </label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="email@example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-secondary">
                Vehicle Type
              </label>
              <Select
                value={formData.vehicle_type}
                onValueChange={(v) => updateField("vehicle_type", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="car">Car</SelectItem>
                  <SelectItem value="motorcycle">Motorcycle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-secondary">
                Pass Type
              </label>
              <Select
                value={formData.pass_type}
                onValueChange={(v) => updateField("pass_type", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-secondary">
                Valid From
              </label>
              <Input
                type="date"
                value={formData.valid_from}
                onChange={(e) => updateField("valid_from", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-secondary">
                Valid Until
              </label>
              <Input
                type="date"
                value={formData.valid_until}
                onChange={(e) => updateField("valid_until", e.target.value)}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">{member ? "Update" : "Add Member"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
