import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  getReporterLeaderboard,
  getDepartmentRanking,
  type Period,
} from "@/lib/leaderboard";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = { title: "Papan Peringkat" };

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const user = await requireUser();
  const { periode } = await searchParams;
  const period: Period = periode === "semua" ? "all" : "month";

  const [reporters, departments] = await Promise.all([
    getReporterLeaderboard(period),
    getDepartmentRanking(),
  ]);

  const podium = reporters.slice(0, 3);
  const rest = reporters.slice(3);
  const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean);
  const medals = ["🥈", "🥇", "🥉"];
  const heights = ["h-20", "h-28", "h-16"];

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">Papan Peringkat</h1>
        <p className="text-sm text-muted">
          Pelapor teraktif — setiap laporan bikin pabrik lebih aman. 💪
        </p>
      </div>

      <div className="flex gap-2">
        <Link
          href="/leaderboard"
          className={`rounded-full px-4 py-1.5 text-xs font-bold ${
            period === "month"
              ? "bg-brand text-white"
              : "border border-line bg-surface text-muted"
          }`}
        >
          Bulan Ini
        </Link>
        <Link
          href="/leaderboard?periode=semua"
          className={`rounded-full px-4 py-1.5 text-xs font-bold ${
            period === "all"
              ? "bg-brand text-white"
              : "border border-line bg-surface text-muted"
          }`}
        >
          Sepanjang Waktu
        </Link>
      </div>

      {reporters.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line py-14 text-center text-sm font-semibold text-muted">
          Belum ada laporan pada periode ini.
          <br />
          <Link href="/lapor" className="mt-1 inline-block font-bold text-brand">
            Jadilah yang pertama →
          </Link>
        </div>
      ) : (
        <>
          {/* Podium */}
          <Card>
            <CardBody>
              <div className="flex items-end justify-center gap-3">
                {podiumOrder.map((r, i) => (
                  <div
                    key={r.user.id}
                    className="flex w-24 flex-col items-center gap-1.5"
                  >
                    <span className="text-2xl">{medals[i]}</span>
                    <p className="w-full truncate text-center text-xs font-extrabold">
                      {r.user.name}
                    </p>
                    <p className="text-[10px] font-semibold text-muted">
                      {r.count} laporan
                    </p>
                    <div
                      className={`w-full rounded-t-xl bg-gradient-to-t from-brand to-brand/70 ${heights[i]} flex items-start justify-center pt-1.5 text-sm font-extrabold text-white`}
                    >
                      {r.rank}
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Sisa peringkat */}
          {rest.length > 0 && (
            <Card>
              <CardBody className="divide-y divide-line">
                {rest.map((r) => (
                  <div key={r.user.id} className="flex items-center gap-3 py-2.5">
                    <span className="w-7 text-center text-sm font-extrabold text-muted">
                      {r.rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        {r.user.name}
                        {r.user.id === user.id && (
                          <Badge tone="brand" className="ml-2">
                            Kamu
                          </Badge>
                        )}
                      </p>
                      <p className="text-[11px] text-muted">
                        {r.user.department?.code ?? "—"} · NPK {r.user.npk}
                      </p>
                    </div>
                    <span className="text-sm font-extrabold tabular-nums text-brand">
                      {r.count}
                    </span>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
        </>
      )}

      {/* Departemen terbaik */}
      <Card>
        <CardHeader
          title="Departemen Terbaik"
          subtitle="Ketepatan waktu perbaikan + skor 5S"
        />
        <CardBody className="divide-y divide-line">
          {departments.slice(0, 5).map((d, i) => (
            <div key={d.code} className="flex items-center gap-3 py-2.5">
              <span className="w-7 text-center text-sm font-extrabold text-muted">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{d.name}</p>
                <p className="text-[11px] text-muted">
                  On-time{" "}
                  {d.onTimeRatio != null
                    ? `${(d.onTimeRatio * 100).toFixed(0)}%`
                    : "—"}{" "}
                  · 5S {d.avg5s != null ? `${d.avg5s.toFixed(0)}%` : "—"}
                </p>
              </div>
              {i === 0 && <span className="text-xl">🏆</span>}
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
