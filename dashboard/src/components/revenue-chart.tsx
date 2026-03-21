"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupiah } from "@/lib/utils";
import type { RevenueData } from "@/types";

interface RevenueChartProps {
  data: RevenueData[];
  title?: string;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-surface-overlay p-3 shadow-lg">
      <p className="text-xs font-semibold text-text-primary mb-2">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-xs">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-text-secondary capitalize">{entry.dataKey}</span>
          <span className="ml-auto font-semibold text-text-primary">
            {formatRupiah(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RevenueChart({
  data,
  title = "30-Day Revenue",
}: RevenueChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#2A2A2A"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: "#666660", fontSize: 11 }}
                axisLine={{ stroke: "#2A2A2A" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#666660", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) =>
                  value >= 1000000
                    ? `${(value / 1000000).toFixed(1)}M`
                    : value >= 1000
                    ? `${(value / 1000).toFixed(0)}K`
                    : value.toString()
                }
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Legend
                wrapperStyle={{ paddingTop: "16px" }}
                formatter={(value: string) => (
                  <span className="text-xs text-text-secondary capitalize">
                    {value}
                  </span>
                )}
              />
              <Bar
                dataKey="cash"
                stackId="a"
                fill="#F5A623"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="qris"
                stackId="a"
                fill="#3B82F6"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="nfc"
                stackId="a"
                fill="#22C55E"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="member"
                stackId="a"
                fill="#666660"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
