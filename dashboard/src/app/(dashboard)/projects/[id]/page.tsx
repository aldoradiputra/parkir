"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  MapPin,
  Calendar,
  Layers,
} from "lucide-react";
import { format } from "date-fns";
import dynamic from "next/dynamic";
import { ProjectStatusBar } from "@/components/project-status-bar";
import type { Project, ProjectStatus } from "@/types";

const LocationMap = dynamic(() => import("@/components/location-map"), { ssr: false });

const projectStatusConfig: Record<ProjectStatus, { label: string; color: string }> = {
  planning: { label: "Planning", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  procurement: { label: "Procurement", color: "bg-amber/15 text-amber border-amber/30" },
  installation: { label: "Installation", color: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  testing: { label: "Testing", color: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  live: { label: "Live", color: "bg-green-500/15 text-green-400 border-green-500/30" },
  maintenance: { label: "Maintenance", color: "bg-teal-500/15 text-teal-400 border-teal-500/30" },
  cancelled: { label: "Cancelled", color: "bg-red-500/15 text-red-400 border-red-500/30" },
};

const demoProject: Project = {
  id: "proj-001",
  lead_id: "lead-004",
  facility_name: "Plaza Yogyakarta",
  contact_name: "Dewi Lestari",
  contact_email: "dewi@plazayogya.com",
  contact_phone: "084567890123",
  city: "Yogyakarta",
  address: "Jl. Malioboro No. 52",
  latitude: -7.7956,
  longitude: 110.3695,
  entry_lanes: 2,
  exit_lanes: 2,
  status: "installation",
  start_date: "2026-04-10",
  target_live: "2026-05-15",
  created_at: "2026-04-05T10:00:00Z",
  updated_at: "2026-04-15T14:00:00Z",
};

export default function ProjectDetailPage() {
  const { locale } = useAppStore();
  const params = useParams();
  const project = demoProject; // In production: fetch by params.id

  const statusCfg = projectStatusConfig[project.status];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/projects" className="text-text-secondary hover:text-text-primary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text-primary">{project.facility_name}</h1>
          <p className="text-sm text-text-secondary">{project.city || ""}</p>
        </div>
        <Badge variant="outline" className={statusCfg.color + " text-base px-4 py-1"}>
          {statusCfg.label}
        </Badge>
      </div>

      {/* Status Pipeline */}
      <Card className="bg-surface-raised border-border">
        <CardHeader>
          <CardTitle className="text-base text-text-primary">
            {locale === "en" ? "Progress" : "Progres"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectStatusBar status={project.status} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact */}
        <Card className="bg-surface-raised border-border">
          <CardHeader>
            <CardTitle className="text-base text-text-primary">
              {locale === "en" ? "Contact" : "Kontak"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 text-text-tertiary" />
              <span className="text-text-primary">{project.contact_name}</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-text-tertiary" />
              <span className="text-text-primary">{project.contact_email}</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-text-tertiary" />
              <span className="text-text-primary">{project.contact_phone}</span>
            </div>
            {project.address && (
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-text-tertiary" />
                <span className="text-text-primary">{project.address}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Project Details */}
        <Card className="bg-surface-raised border-border">
          <CardHeader>
            <CardTitle className="text-base text-text-primary">
              {locale === "en" ? "Details" : "Detail"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-text-tertiary uppercase">{locale === "en" ? "Entry Lanes" : "Jalur Masuk"}</p>
                <p className="text-lg font-semibold text-text-primary">{project.entry_lanes}</p>
              </div>
              <div>
                <p className="text-xs text-text-tertiary uppercase">{locale === "en" ? "Exit Lanes" : "Jalur Keluar"}</p>
                <p className="text-lg font-semibold text-text-primary">{project.exit_lanes}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-text-tertiary uppercase">{locale === "en" ? "Start Date" : "Tanggal Mulai"}</p>
                <p className="text-sm text-text-primary">
                  {project.start_date ? format(new Date(project.start_date), "dd MMM yyyy") : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-tertiary uppercase">Target Live</p>
                <p className="text-sm text-text-primary">
                  {project.target_live ? format(new Date(project.target_live), "dd MMM yyyy") : "—"}
                </p>
              </div>
            </div>
            {project.actual_live && (
              <div>
                <p className="text-xs text-text-tertiary uppercase">Actual Live</p>
                <p className="text-sm text-green-400 font-semibold">
                  {format(new Date(project.actual_live), "dd MMM yyyy")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Map */}
      {project.latitude && project.longitude && (
        <Card className="bg-surface-raised border-border">
          <CardHeader>
            <CardTitle className="text-base text-text-primary">
              {locale === "en" ? "Location" : "Lokasi"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] rounded-lg overflow-hidden border border-border">
              <LocationMap
                latitude={project.latitude}
                longitude={project.longitude}
                name={project.facility_name}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {project.notes && (
        <Card className="bg-surface-raised border-border">
          <CardHeader>
            <CardTitle className="text-base text-text-primary">
              {locale === "en" ? "Notes" : "Catatan"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-text-secondary text-sm">{project.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
