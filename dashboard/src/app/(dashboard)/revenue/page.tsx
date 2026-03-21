"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RevenueChart } from "@/components/revenue-chart";
import { PeakHeatmap } from "@/components/peak-heatmap";
import { formatRupiah, formatDuration } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { Download, TrendingUp, Clock, Car, Bike } from "lucide-react";
import type { RevenueData, PeakHourData } from "@/types";

// Generate 30 days of demo data
const generateRevenueData = (): RevenueData[] => {
  const data: RevenueData[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const multiplier = isWeekend ? 1.3 : 1;

    const cash = Math.floor((3000000 + Math.random() * 2000000) * multiplier);
    const qris = Math.floor((2000000 + Math.random() * 1500000) * multiplier);
    const nfc = Math.floor((800000 + Math.random() * 700000) * multiplier);
    const member = Math.floor((500000 + Math.random() * 300000) * multiplier);

    data.push({
      date: `${date.getDate()}/${date.getMonth() + 1}`,
      cash,
      qris,
      nfc,
      member,
      total: cash + qris + nfc + member,
    });
  }
  return data;
};

const generatePeakData = (): PeakHourData[] => {
  const data: PeakHourData[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      let count = 0;
      if (hour >= 7 && hour <= 9) count = 30 + Math.floor(Math.random() * 40);
      else if (hour >= 11 && hour <= 13) count = 20 + Math.floor(Math.random() * 25);
      else if (hour >= 17 && hour <= 19) count = 35 + Math.floor(Math.random() * 35);
      else if (hour >= 6 && hour <= 21) count = 5 + Math.floor(Math.random() * 15);
      else count = Math.floor(Math.random() * 5);

      if (day >= 5) count = Math.floor(count * 0.6);

      data.push({ hour, day, count });
    }
  }
  return data;
};

const revenueData = generateRevenueData();
const peakData = generatePeakData();

export default function RevenuePage() {
  const { locale } = useAppStore();
  const t = (en: string, id: string) => (locale === "en" ? en : id);

  const totalRevenue = revenueData.reduce((sum, d) => sum + d.total, 0);
  const totalSessions = 18240;
  const avgPerSession = Math.floor(totalRevenue / totalSessions);
  const avgDuration = 87;

  const totalCash = revenueData.reduce((sum, d) => sum + d.cash, 0);
  const totalQris = revenueData.reduce((sum, d) => sum + d.qris, 0);
  const totalNfc = revenueData.reduce((sum, d) => sum + d.nfc, 0);
  const totalMember = revenueData.reduce((sum, d) => sum + d.member, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">
          {t("Revenue", "Pendapatan")}
        </h1>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          {t("Export PDF", "Ekspor PDF")}
        </Button>
      </div>

      {/* Monthly Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-text-tertiary mb-1">
              {t("Total Revenue", "Total Pendapatan")}
            </p>
            <p className="text-xl font-semibold text-text-primary">
              {formatRupiah(totalRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-text-tertiary mb-1">
              {t("Total Sessions", "Total Sesi")}
            </p>
            <p className="text-xl font-semibold text-text-primary">
              {totalSessions.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-text-tertiary mb-1">
              {t("Avg per Session", "Rata-rata/Sesi")}
            </p>
            <p className="text-xl font-semibold text-text-primary">
              {formatRupiah(avgPerSession)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-text-tertiary mb-1">
              {t("Avg Duration", "Rata-rata Durasi")}
            </p>
            <p className="text-xl font-semibold text-text-primary">
              {formatDuration(avgDuration)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <RevenueChart
        data={revenueData}
        title={t("30-Day Revenue", "Pendapatan 30 Hari")}
      />

      {/* Vehicle Split + Payment Method breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("Vehicle Split", "Pembagian Kendaraan")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Car className="h-5 w-5 text-text-secondary" />
                  <span className="text-sm font-semibold text-text-primary">
                    {t("Cars", "Mobil")}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-text-primary">
                    7,842
                  </p>
                  <p className="text-xs text-text-tertiary">43%</p>
                </div>
              </div>
              <div className="h-2 w-full rounded-md bg-surface-elevated overflow-hidden">
                <div className="h-full w-[43%] rounded-md bg-amber" />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bike className="h-5 w-5 text-text-secondary" />
                  <span className="text-sm font-semibold text-text-primary">
                    {t("Motorcycles", "Motor")}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-text-primary">
                    10,398
                  </p>
                  <p className="text-xs text-text-tertiary">57%</p>
                </div>
              </div>
              <div className="h-2 w-full rounded-md bg-surface-elevated overflow-hidden">
                <div className="h-full w-[57%] rounded-md bg-info" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {t("By Payment Method", "Berdasarkan Metode Pembayaran")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Cash", value: totalCash, color: "bg-amber" },
                { label: "QRIS", value: totalQris, color: "bg-info" },
                { label: "NFC", value: totalNfc, color: "bg-success" },
                { label: "Member", value: totalMember, color: "bg-text-tertiary" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span
                    className={`h-2.5 w-2.5 rounded-full shrink-0 ${item.color}`}
                  />
                  <span className="text-sm text-text-secondary flex-1">
                    {item.label}
                  </span>
                  <span className="text-sm font-semibold text-text-primary">
                    {formatRupiah(item.value)}
                  </span>
                  <span className="text-xs text-text-tertiary w-10 text-right">
                    {((item.value / totalRevenue) * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Peak Hours Heatmap */}
      <PeakHeatmap
        data={peakData}
        title={t("Peak Hours", "Jam Sibuk")}
      />
    </div>
  );
}
