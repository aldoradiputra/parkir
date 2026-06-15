"use client";

import { ParkingCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function OnboardingStep1Page() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <ParkingCircle className="h-10 w-10 text-amber" />
          <h1 className="text-2xl font-bold text-text-primary">
            Mulai dengan SupaPark
          </h1>
          <p className="text-sm text-text-secondary text-center">
            Isi form singkat untuk memulai
          </p>
        </div>

        <Card className="bg-surface-raised border-border">
          <CardContent className="pt-6">
            <p className="text-text-secondary text-center py-8">
              Step 1 form — coming soon
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
