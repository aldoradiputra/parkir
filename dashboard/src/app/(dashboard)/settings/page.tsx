"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRupiah, calculateParkingFee } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import {
  Building,
  DollarSign,
  CreditCard,
  MessageSquare,
  Users,
  Globe,
  Calculator,
  Car,
  Bike,
  Plus,
  Eye,
  EyeOff,
} from "lucide-react";
import type { TariffConfig, StaffAccount } from "@/types";

const demoTariffs: TariffConfig[] = [
  {
    id: "t-1",
    location_id: "loc-1",
    vehicle_type: "car",
    first_hour_rate: 5000,
    subsequent_hour_rate: 3000,
    max_daily_rate: 50000,
    grace_period_minutes: 15,
  },
  {
    id: "t-2",
    location_id: "loc-1",
    vehicle_type: "motorcycle",
    first_hour_rate: 2000,
    subsequent_hour_rate: 1000,
    max_daily_rate: 20000,
    grace_period_minutes: 15,
  },
];

const demoStaff: StaffAccount[] = [
  {
    id: "staff-1",
    name: "Ahmad Admin",
    email: "ahmad@parkir.id",
    role: "admin",
    active: true,
    created_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "staff-2",
    name: "Budi Operator",
    email: "budi@parkir.id",
    role: "operator",
    active: true,
    created_at: "2025-06-01T00:00:00Z",
  },
  {
    id: "staff-3",
    name: "Cindy Viewer",
    email: "cindy@parkir.id",
    role: "viewer",
    active: false,
    created_at: "2025-09-01T00:00:00Z",
  },
];

export default function SettingsPage() {
  const { locale, setLocale } = useAppStore();
  const [previewDuration, setPreviewDuration] = useState(120);
  const [showKeys, setShowKeys] = useState(false);

  const [carTariff, setCarTariff] = useState(demoTariffs[0]);
  const [motoTariff, setMotoTariff] = useState(demoTariffs[1]);

  const t = (en: string, id: string) => (locale === "en" ? en : id);

  const carFee = calculateParkingFee(
    previewDuration,
    carTariff.first_hour_rate,
    carTariff.subsequent_hour_rate,
    carTariff.max_daily_rate,
    carTariff.grace_period_minutes
  );

  const motoFee = calculateParkingFee(
    previewDuration,
    motoTariff.first_hour_rate,
    motoTariff.subsequent_hour_rate,
    motoTariff.max_daily_rate,
    motoTariff.grace_period_minutes
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-text-primary">
        {t("Settings", "Pengaturan")}
      </h1>

      <Tabs defaultValue="location" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="location" className="gap-1.5">
            <Building className="h-3.5 w-3.5" />
            {t("Location", "Lokasi")}
          </TabsTrigger>
          <TabsTrigger value="tariff" className="gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            {t("Tariff", "Tarif")}
          </TabsTrigger>
          <TabsTrigger value="payment" className="gap-1.5">
            <CreditCard className="h-3.5 w-3.5" />
            {t("Payment", "Pembayaran")}
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="staff" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {t("Staff", "Staf")}
          </TabsTrigger>
          <TabsTrigger value="language" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            {t("Language", "Bahasa")}
          </TabsTrigger>
        </TabsList>

        {/* Location Info */}
        <TabsContent value="location">
          <Card>
            <CardHeader>
              <CardTitle>{t("Location Info", "Info Lokasi")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-secondary">
                    {t("Location Name", "Nama Lokasi")}
                  </label>
                  <Input defaultValue="Parkir Mall Grand Indonesia" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-secondary">
                    {t("Address", "Alamat")}
                  </label>
                  <Input defaultValue="Jl. MH Thamrin No.1, Jakarta Pusat" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-secondary">
                    {t("Car Capacity", "Kapasitas Mobil")}
                  </label>
                  <Input type="number" defaultValue={250} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-secondary">
                    {t("Motorcycle Capacity", "Kapasitas Motor")}
                  </label>
                  <Input type="number" defaultValue={500} />
                </div>
              </div>
              <Button>{t("Save", "Simpan")}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tariff Config */}
        <TabsContent value="tariff">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Car tariff */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  {t("Car Tariff", "Tarif Mobil")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-text-secondary">
                    {t("First Hour Rate", "Tarif Jam Pertama")}
                  </label>
                  <Input
                    type="number"
                    value={carTariff.first_hour_rate}
                    onChange={(e) =>
                      setCarTariff({
                        ...carTariff,
                        first_hour_rate: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-text-secondary">
                    {t("Subsequent Hour Rate", "Tarif Jam Berikutnya")}
                  </label>
                  <Input
                    type="number"
                    value={carTariff.subsequent_hour_rate}
                    onChange={(e) =>
                      setCarTariff({
                        ...carTariff,
                        subsequent_hour_rate: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-text-secondary">
                    {t("Max Daily Rate", "Tarif Maks Harian")}
                  </label>
                  <Input
                    type="number"
                    value={carTariff.max_daily_rate}
                    onChange={(e) =>
                      setCarTariff({
                        ...carTariff,
                        max_daily_rate: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-text-secondary">
                    {t("Grace Period (min)", "Masa Tenggang (menit)")}
                  </label>
                  <Input
                    type="number"
                    value={carTariff.grace_period_minutes}
                    onChange={(e) =>
                      setCarTariff({
                        ...carTariff,
                        grace_period_minutes: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <Button className="w-full">{t("Save", "Simpan")}</Button>
              </CardContent>
            </Card>

            {/* Motorcycle tariff */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bike className="h-4 w-4" />
                  {t("Motorcycle Tariff", "Tarif Motor")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-text-secondary">
                    {t("First Hour Rate", "Tarif Jam Pertama")}
                  </label>
                  <Input
                    type="number"
                    value={motoTariff.first_hour_rate}
                    onChange={(e) =>
                      setMotoTariff({
                        ...motoTariff,
                        first_hour_rate: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-text-secondary">
                    {t("Subsequent Hour Rate", "Tarif Jam Berikutnya")}
                  </label>
                  <Input
                    type="number"
                    value={motoTariff.subsequent_hour_rate}
                    onChange={(e) =>
                      setMotoTariff({
                        ...motoTariff,
                        subsequent_hour_rate: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-text-secondary">
                    {t("Max Daily Rate", "Tarif Maks Harian")}
                  </label>
                  <Input
                    type="number"
                    value={motoTariff.max_daily_rate}
                    onChange={(e) =>
                      setMotoTariff({
                        ...motoTariff,
                        max_daily_rate: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-text-secondary">
                    {t("Grace Period (min)", "Masa Tenggang (menit)")}
                  </label>
                  <Input
                    type="number"
                    value={motoTariff.grace_period_minutes}
                    onChange={(e) =>
                      setMotoTariff({
                        ...motoTariff,
                        grace_period_minutes: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <Button className="w-full">{t("Save", "Simpan")}</Button>
              </CardContent>
            </Card>

            {/* Live Preview Calculator */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-amber" />
                  {t("Live Preview", "Pratinjau Langsung")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-text-secondary">
                    {t("Duration (minutes)", "Durasi (menit)")}
                  </label>
                  <Input
                    type="number"
                    value={previewDuration}
                    onChange={(e) =>
                      setPreviewDuration(Number(e.target.value))
                    }
                    min={0}
                    max={1440}
                  />
                  <input
                    type="range"
                    min={0}
                    max={1440}
                    value={previewDuration}
                    onChange={(e) =>
                      setPreviewDuration(Number(e.target.value))
                    }
                    className="w-full accent-amber"
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-text-secondary" />
                      <span className="text-sm text-text-secondary">
                        {t("Car", "Mobil")}
                      </span>
                    </div>
                    <span className="text-lg font-semibold text-text-primary">
                      {formatRupiah(carFee)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bike className="h-4 w-4 text-text-secondary" />
                      <span className="text-sm text-text-secondary">
                        {t("Motorcycle", "Motor")}
                      </span>
                    </div>
                    <span className="text-lg font-semibold text-text-primary">
                      {formatRupiah(motoFee)}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-text-tertiary">
                  {previewDuration <= carTariff.grace_period_minutes
                    ? t(
                        "Within grace period - no charge",
                        "Dalam masa tenggang - gratis"
                      )
                    : `${Math.floor(previewDuration / 60)}h ${previewDuration % 60}m`}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Payment Keys */}
        <TabsContent value="payment">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("Payment Keys", "Kunci Pembayaran")}</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowKeys(!showKeys)}
                  className="gap-1"
                >
                  {showKeys ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  {showKeys ? t("Hide", "Sembunyikan") : t("Show", "Tampilkan")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-secondary">
                    Midtrans Server Key
                  </label>
                  <Input
                    type={showKeys ? "text" : "password"}
                    defaultValue="SB-Mid-server-xxxxxxxxxxxx"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-secondary">
                    Midtrans Client Key
                  </label>
                  <Input
                    type={showKeys ? "text" : "password"}
                    defaultValue="SB-Mid-client-xxxxxxxxxxxx"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-semibold text-text-secondary">
                    {t("NFC Bank Credentials", "Kredensial Bank NFC")}
                  </label>
                  <Input
                    type={showKeys ? "text" : "password"}
                    defaultValue="bank-nfc-credential-xxxx"
                  />
                </div>
              </div>
              <Button>{t("Save", "Simpan")}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WhatsApp Config */}
        <TabsContent value="whatsapp">
          <Card>
            <CardHeader>
              <CardTitle>
                {t("WhatsApp Configuration", "Konfigurasi WhatsApp")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-secondary">
                    Fonnte API Key
                  </label>
                  <Input
                    type={showKeys ? "text" : "password"}
                    defaultValue="fonnte-api-key-xxxx"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-secondary">
                    {t("WhatsApp Number", "Nomor WhatsApp")}
                  </label>
                  <Input defaultValue="628123456789" />
                </div>
              </div>
              <Button>{t("Save", "Simpan")}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Staff Accounts */}
        <TabsContent value="staff">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("Staff Accounts", "Akun Staf")}</CardTitle>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t("Add Staff", "Tambah Staf")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Name", "Nama")}</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>{t("Role", "Peran")}</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>{t("Actions", "Aksi")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {demoStaff.map((staff) => (
                    <TableRow key={staff.id}>
                      <TableCell className="font-semibold text-sm text-text-primary">
                        {staff.name}
                      </TableCell>
                      <TableCell className="text-sm text-text-secondary">
                        {staff.email}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            staff.role === "admin"
                              ? "warning"
                              : staff.role === "operator"
                              ? "info"
                              : "outline"
                          }
                        >
                          {staff.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={staff.active ? "success" : "error"}
                        >
                          {staff.active
                            ? t("Active", "Aktif")
                            : t("Inactive", "Nonaktif")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          {t("Edit", "Edit")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Language */}
        <TabsContent value="language">
          <Card>
            <CardHeader>
              <CardTitle>{t("Language", "Bahasa")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Button
                  variant={locale === "en" ? "default" : "outline"}
                  onClick={() => setLocale("en")}
                  className="flex-1"
                >
                  English
                </Button>
                <Button
                  variant={locale === "id" ? "default" : "outline"}
                  onClick={() => setLocale("id")}
                  className="flex-1"
                >
                  Bahasa Indonesia
                </Button>
              </div>
              <p className="text-sm text-text-tertiary">
                {t(
                  "Change the dashboard display language. This setting is saved locally.",
                  "Ubah bahasa tampilan dashboard. Pengaturan ini disimpan secara lokal."
                )}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
