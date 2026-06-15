"use client";

import { useParams } from "next/navigation";
import { ParkingCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function OnboardingStep2Page() {
  const params = useParams();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex flex-col items-center gap-3">
          <ParkingCircle className="h-10 w-10 text-amber" />
          <h1 className="text-2xl font-bold text-text-primary">
            Detail Fasilitas
          </h1>
          <p className="text-sm text-text-secondary text-center">
            Lengkapi informasi lokasi parkir Anda
          </p>
        </div>

        <Card className="bg-surface-raised border-border">
          <CardContent className="pt-6">
            <p className="text-text-secondary text-center py-8">
              Step 2 form with map — coming soon
            </p>
            <p className="text-xs text-text-tertiary text-center">
              Lead ID: {params.id}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
