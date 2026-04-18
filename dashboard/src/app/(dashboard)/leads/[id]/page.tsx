"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  MapPin,
  Calendar,
  Layers,
  CarFront,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";
import dynamic from "next/dynamic";
import type { Lead, LeadStatus } from "@/types";

const LocationMap = dynamic(() => import("@/components/location-map"), { ssr: false });

const leadStatusConfig: Record<LeadStatus, { label: string; color: string }> = {
  new: { label: "Baru", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  contacted: { label: "Dihubungi", color: "bg-amber/15 text-amber border-amber/30" },
  qualified: { label: "Qualified", color: "bg-green-500/15 text-green-400 border-green-500/30" },
  converted: { label: "Converted", color: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  lost: { label: "Lost", color: "bg-red-500/15 text-red-400 border-red-500/30" },
};

const systemLabels: Record<string, string> = {
  manual: "Manual (tanpa palang)",
  boom_gate: "Palang otomatis",
  ticket: "Sistem tiket",
  rfid: "RFID / kartu akses",
  other: "Lainnya",
};

const demoLead: Lead = {
  id: "lead-003",
  name: "Budi Santoso",
  email: "budi@rsmedika.co.id",
  phone: "083456789012",
  facility_name: "RS Medika Bandung",
  source: "social_media",
  status: "qualified",
  city: "Bandung",
  address: "Jl. Pasteur No. 45, Bandung",
  latitude: -6.9175,
  longitude: 107.6191,
  entry_lanes: 1,
  exit_lanes: 1,
  current_system: "manual",
  daily_volume: 300,
  preferred_date: "2026-05-01",
  onboarded_at: "2026-04-10T12:00:00Z",
  created_at: "2026-04-08T14:00:00Z",
  updated_at: "2026-04-10T12:00:00Z",
};

export default function LeadDetailPage() {
  const { locale } = useAppStore();
  const params = useParams();
  const lead = demoLead; // In production: fetch by params.id

  const statusCfg = leadStatusConfig[lead.status];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/leads" className="text-text-secondary hover:text-text-primary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text-primary">{lead.name}</h1>
          <p className="text-sm text-text-secondary">{lead.facility_name}</p>
        </div>
        <Badge variant="outline" className={statusCfg.color + " text-base px-4 py-1"}>
          {statusCfg.label}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact Info */}
        <Card className="bg-surface-raised border-border">
          <CardHeader>
            <CardTitle className="text-base text-text-primary">
              {locale === "en" ? "Contact Info" : "Info Kontak"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-text-tertiary" />
              <span className="text-text-primary">{lead.email}</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-text-tertiary" />
              <span className="text-text-primary">{lead.phone}</span>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 text-text-tertiary" />
              <span className="text-text-primary">{lead.facility_name}</span>
            </div>
            {lead.city && (
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-text-tertiary" />
                <span className="text-text-primary">{lead.city}{lead.address ? ` — ${lead.address}` : ""}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-text-tertiary" />
              <span className="text-text-secondary text-sm">
                {locale === "en" ? "Registered" : "Terdaftar"}: {format(new Date(lead.created_at), "dd MMM yyyy HH:mm")}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Facility Info */}
        <Card className="bg-surface-raised border-border">
          <CardHeader>
            <CardTitle className="text-base text-text-primary">
              {locale === "en" ? "Facility Details" : "Detail Fasilitas"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {lead.onboarded_at ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-text-tertiary uppercase">{locale === "en" ? "Entry Lanes" : "Jalur Masuk"}</p>
                    <p className="text-lg font-semibold text-text-primary">{lead.entry_lanes || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-tertiary uppercase">{locale === "en" ? "Exit Lanes" : "Jalur Keluar"}</p>
                    <p className="text-lg font-semibold text-text-primary">{lead.exit_lanes || "—"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-text-tertiary uppercase">{locale === "en" ? "Current System" : "Sistem Saat Ini"}</p>
                    <p className="text-sm text-text-primary">{lead.current_system ? systemLabels[lead.current_system] : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-tertiary uppercase">{locale === "en" ? "Daily Volume" : "Volume Harian"}</p>
                    <p className="text-lg font-semibold text-text-primary">{lead.daily_volume?.toLocaleString() || "—"}</p>
                  </div>
                </div>
                {lead.preferred_date && (
                  <div>
                    <p className="text-xs text-text-tertiary uppercase">{locale === "en" ? "Preferred Date" : "Tanggal Preferensi"}</p>
                    <p className="text-sm text-text-primary">{format(new Date(lead.preferred_date), "dd MMM yyyy")}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-text-tertiary text-sm italic">
                {locale === "en" ? "Onboarding not completed yet" : "Onboarding belum selesai"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Map */}
      {lead.latitude && lead.longitude && (
        <Card className="bg-surface-raised border-border">
          <CardHeader>
            <CardTitle className="text-base text-text-primary">
              {locale === "en" ? "Location" : "Lokasi"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] rounded-lg overflow-hidden border border-border">
              <LocationMap
                latitude={lead.latitude}
                longitude={lead.longitude}
                name={lead.facility_name}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {lead.status !== "converted" && lead.status !== "lost" && (
        <div className="flex gap-3">
          <Button variant="outline" className="border-amber text-amber hover:bg-amber/10">
            <ArrowRight className="h-4 w-4 mr-2" />
            {locale === "en" ? "Convert to Project" : "Konversi ke Proyek"}
          </Button>
        </div>
      )}

      {lead.notes && (
        <Card className="bg-surface-raised border-border">
          <CardHeader>
            <CardTitle className="text-base text-text-primary">
              {locale === "en" ? "Notes" : "Catatan"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-text-secondary text-sm">{lead.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
