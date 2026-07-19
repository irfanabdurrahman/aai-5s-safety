"use client";

import {
  ResponsiveContainer,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const COLORS = { Dilaporkan: "#2158c4", Selesai: "#12833b" };

export function TrendChart({
  data,
}: {
  data: { label: string; Dilaporkan: number; Selesai: number }[];
}) {
  const summary = data
    .map(
      (item) =>
        `${item.label}: ${item.Dilaporkan} dilaporkan, ${item.Selesai} selesai`,
    )
    .join("; ");

  return (
    <figure aria-label="Grafik tren temuan delapan minggu">
      <figcaption className="sr-only">{summary}</figcaption>
      <div className="h-72 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 12, right: 12, left: -18, bottom: 0 }}
          >
            <defs>
              <linearGradient id="reportedFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.Dilaporkan} stopOpacity={0.25} />
                <stop offset="100%" stopColor={COLORS.Dilaporkan} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="closedFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.Selesai} stopOpacity={0.22} />
                <stop offset="100%" stopColor={COLORS.Selesai} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="var(--border)"
              strokeDasharray="4 5"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "var(--muted)", fontWeight: 700 }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: "var(--muted)", fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                borderRadius: 12,
                border: "2px solid var(--border)",
                color: "var(--foreground)",
                fontSize: 12,
                fontWeight: 700,
                boxShadow: "0 12px 30px rgba(16,24,40,.12)",
              }}
            />
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: 11, fontWeight: 800, paddingTop: 10 }}
            />
            <Area
              type="monotone"
              dataKey="Dilaporkan"
              stroke={COLORS.Dilaporkan}
              fill="url(#reportedFill)"
              strokeWidth={3}
              dot={{ r: 3, fill: "white", strokeWidth: 2 }}
              activeDot={{ r: 5 }}
            />
            <Area
              type="monotone"
              dataKey="Selesai"
              stroke={COLORS.Selesai}
              fill="url(#closedFill)"
              strokeWidth={3}
              dot={{ r: 3, fill: "white", strokeWidth: 2 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
