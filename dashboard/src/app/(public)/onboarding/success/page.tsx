"use client";

import Link from "next/link";
import { CheckCircle2, ParkingCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OnboardingSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex flex-col items-center gap-4">
          <CheckCircle2 className="h-16 w-16 text-success" />
          <h1 className="text-2xl font-bold text-text-primary">
            Pendaftaran Berhasil!
          </h1>
          <p className="text-text-secondary">
            Tim kami akan menghubungi Anda dalam 1x24 jam
          </p>
        </div>

        <Link href="/">
          <Button variant="outline" className="mt-4">
            Kembali ke Beranda
          </Button>
        </Link>

        <div className="flex items-center justify-center gap-2 pt-4">
          <ParkingCircle className="h-5 w-5 text-amber" />
          <span className="text-sm text-text-tertiary">SupaPark</span>
        </div>
      </div>
    </div>
  );
}
