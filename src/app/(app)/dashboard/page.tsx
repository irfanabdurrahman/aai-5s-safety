import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  getKpis,
  getWeeklyTrend,
  getAreaScores,
  getEscalations,
} from "@/lib/kpi";
import { getDepartmentRanking } from "@/lib/leaderboard";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { STATUS_META, formatDate, scoreBand } from "@/lib/labels";

export const metadata: Metadata = { title: "Dashboard" };

function KpiCard({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string | number;
  tone?: "danger" | "warn" | "ok" | "brand";
  sub?: string;
}) {
  const color =
    tone === "danger"
      ? "text-danger"
      : tone === "warn"
        ? "text-warn"
        : tone === "ok"
          ? "text-ok"
          : "text-brand";
  return (
    <Card>
      <CardBody className="py-4">
        <p className={`text-3xl font-extrabold tabular-nums ${color}`}>{value}</p>
        <p className="mt-0.5 text-xs font-bold text-foreground">{label}</p>
        {sub && <p className="text-[11px] text-muted">{sub}</p>}
      </CardBody>
    </Card>
  );
}

export default async function DashboardPage() {
  await requireUser(["SUPERVISOR", "ADMIN"]);
  const [kpis, trend, areaScores, escalations, deptRanking] =
    await Promise.all([
      getKpis(),
      getWeeklyTrend(),
      getAreaScores(),
      getEscalations(),
      getDepartmentRanking(),
    ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">Dashboard Manajemen</h1>
        <p className="text-sm text-muted">
          Kondisi 5S &amp; safety seluruh pabrik, realtime dari data temuan.
        </p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Terbuka" value={kpis.open} tone="danger" />
        <KpiCard label="Dikerjakan" value={kpis.inProgress} tone="warn" />
        <KpiCard label="Tunggu Verifikasi" value={kpis.pending} tone="brand" />
        <KpiCard
          label="Selesai bulan ini"
          value={kpis.closedThisMonth}
          tone="ok"
          sub={
            kpis.avgCloseDays != null
              ? `rata-rata ${kpis.avgCloseDays.toFixed(1)} hari`
              : undefined
          }
        />
        <KpiCard label="Terlambat" value={kpis.overdue} tone="danger" />
      </div>

      {/* Eskalasi */}
      {escalations.length > 0 && (
        <Card className="border-danger/40">
          <CardHeader
            title="🚨 Perlu Eskalasi"
            subtitle="Terlambat lebih dari 3 hari dari target"
          />
          <CardBody className="space-y-2">
            {escalations.map((f) => (
              <Link
                key={f.id}
                href={`/temuan/${f.id}`}
                className="flex items-center gap-3 rounded-xl bg-danger-soft/50 px-3.5 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    {f.number} — {f.description}
                  </p>
                  <p className="text-xs text-muted">
                    {f.area.name} · PIC {f.pic?.name ?? "—"} · target{" "}
                    {formatDate(f.dueDate)}
                  </p>
                </div>
                <Badge tone="danger">{STATUS_META[f.status].label}</Badge>
              </Link>
            ))}
          </CardBody>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Tren */}
        <Card>
          <CardHeader
            title="Tren 8 Minggu"
            subtitle="Temuan dilaporkan vs selesai per minggu"
          />
          <CardBody>
            <TrendChart data={trend} />
          </CardBody>
        </Card>

        {/* Skor 5S per area */}
        <Card>
          <CardHeader
            title="Skor 5S per Area"
            subtitle="Audit terakhir tiap area"
          />
          <CardBody className="space-y-2.5">
            {areaScores.filter((a) => a.score != null).length === 0 && (
              <p className="py-4 text-center text-sm text-muted">
                Belum ada audit selesai.
              </p>
            )}
            {areaScores
              .filter((a) => a.score != null)
              .slice(0, 10)
              .map((a) => {
                const delta =
                  a.prevScore != null ? a.score! - a.prevScore : null;
                return (
                  <div key={a.id} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 truncate text-xs font-bold">
                      {a.name}
                      <span className="ml-1 font-semibold text-muted">
                        {a.departmentCode}
                      </span>
                    </span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-background">
                      <div
                        className={`h-full rounded-full ${scoreBand(a.score!).bg}`}
                        style={{ width: `${a.score}%` }}
                      />
                    </div>
                    <span className="w-11 shrink-0 text-right text-xs font-extrabold tabular-nums">
                      {a.score!.toFixed(0)}%
                    </span>
                    {delta != null && (
                      <span
                        className={`w-11 shrink-0 text-right text-[11px] font-bold tabular-nums ${
                          delta >= 0 ? "text-ok" : "text-danger"
                        }`}
                      >
                        {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}
                      </span>
                    )}
                  </div>
                );
              })}
          </CardBody>
        </Card>
      </div>

      {/* Ranking departemen */}
      <Card>
        <CardHeader
          title="Peringkat Departemen"
          subtitle="Komposit: 60% ketepatan waktu perbaikan + 40% skor 5S"
        />
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] font-bold uppercase tracking-wide text-muted">
                  <th className="pb-2 pr-3">#</th>
                  <th className="pb-2 pr-3">Departemen</th>
                  <th className="pb-2 pr-3 text-right">Temuan Aktif</th>
                  <th className="pb-2 pr-3 text-right">Selesai</th>
                  <th className="pb-2 pr-3 text-right">On-time</th>
                  <th className="pb-2 text-right">Skor 5S</th>
                </tr>
              </thead>
              <tbody>
                {deptRanking.map((d, i) => (
                  <tr key={d.code} className="border-b border-line/60">
                    <td className="py-2.5 pr-3 font-extrabold text-muted">
                      {i + 1}
                    </td>
                    <td className="py-2.5 pr-3 font-bold">
                      {d.name}{" "}
                      <span className="font-semibold text-muted">{d.code}</span>
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {d.open}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {d.closed}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-bold tabular-nums">
                      {d.onTimeRatio != null
                        ? `${(d.onTimeRatio * 100).toFixed(0)}%`
                        : "—"}
                    </td>
                    <td className="py-2.5 text-right font-bold tabular-nums">
                      {d.avg5s != null ? `${d.avg5s.toFixed(0)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
