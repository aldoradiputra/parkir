"use client";

import Link from "next/link";
import { ParkingCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-base">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <ParkingCircle className="h-7 w-7 text-amber" />
          <span className="text-lg font-semibold text-text-primary tracking-tight">
            SupaPark
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Login
            </Button>
          </Link>
          <Link href="/onboarding">
            <Button size="sm" className="bg-amber hover:bg-amber-500 text-surface-base font-semibold">
              Mulai Sekarang
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-24 max-w-4xl mx-auto text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-text-primary leading-tight">
          Sistem Parkir Cerdas
          <br />
          <span className="text-amber">untuk Indonesia</span>
        </h1>
        <p className="mt-6 text-lg text-text-secondary max-w-2xl mx-auto">
          ALPR otomatis, pembayaran QRIS, manajemen member — semua dalam satu
          platform. Tanpa tiket, tanpa ribet.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/onboarding">
            <Button size="lg" className="bg-amber hover:bg-amber-500 text-surface-base font-semibold gap-2">
              Mulai Sekarang <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Placeholder sections */}
      <section className="px-6 py-16 max-w-6xl mx-auto">
        <p className="text-center text-text-tertiary">
          Features, pricing, and map sections — coming soon
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ParkingCircle className="h-5 w-5 text-amber" />
            <span className="text-sm text-text-secondary">SupaPark</span>
          </div>
          <p className="text-xs text-text-tertiary">
            &copy; 2026 SupaPark. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
