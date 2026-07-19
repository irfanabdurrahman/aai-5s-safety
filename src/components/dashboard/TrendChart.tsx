"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// Palet tervalidasi (dataviz): biru #2158c4, hijau #12833b + label langsung
const COLORS = { Dilaporkan: "#2158c4", Selesai: "#12833b" };

export function TrendChart({
  data,
}: {
  data: { label: string; Dilaporkan: number; Selesai: number }[];
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              fontSize: 12,
              fontWeight: 600,
            }}
          />
          <Legend
            iconType="plainline"
            wrapperStyle={{ fontSize: 12, fontWeight: 700 }}
          />
          <Line
            type="monotone"
            dataKey="Dilaporkan"
            stroke={COLORS.Dilaporkan}
            strokeWidth={2}
            dot={{ r: 3, fill: COLORS.Dilaporkan }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="Selesai"
            stroke={COLORS.Selesai}
            strokeWidth={2}
            dot={{ r: 3, fill: COLORS.Selesai }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
