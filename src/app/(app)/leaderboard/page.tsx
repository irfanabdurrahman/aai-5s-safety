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

type RankTone = "gold" | "silver" | "bronze";

const CONFETTI: Array<{ c: string; top: string; left: string }> = [
  { c: "#1cab5e", top: "8%", left: "5%" },
  { c: "#2472d8", top: "78%", left: "3%" },
  { c: "#f5821f", top: "14%", left: "93%" },
  { c: "#d6001c", top: "85%", left: "95%" },
  { c: "#12a594", top: "45%", left: "1.5%" },
  { c: "#5a63c0", top: "50%", left: "97%" },
];

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

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
  const topCount = podium[0]?.count ?? 1;
  // Juara 1 selalu di tengah podium: [juara2, juara1, juara3]
  const podiumOrder: Array<{
    entry: (typeof reporters)[number] | undefined;
    tone: RankTone;
    rank: 1 | 2 | 3;
  }> = [
    { entry: podium[1], tone: "silver", rank: 2 },
    { entry: podium[0], tone: "gold", rank: 1 },
    { entry: podium[2], tone: "bronze", rank: 3 },
  ];

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
          <Card className="relative overflow-hidden">
            <CardBody>
              <div className="pointer-events-none absolute inset-0" aria-hidden>
                {CONFETTI.map((dot, i) => (
                  <span
                    key={i}
                    className="lb-confetti absolute"
                    style={
                      {
                        "--c": dot.c,
                        top: dot.top,
                        left: dot.left,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>

              <div className="relative z-10 grid grid-cols-3 items-end gap-3">
                {podiumOrder.map(({ entry, tone, rank }, i) => {
                  if (!entry) return <div key={i} />;
                  const isFirst = rank === 1;
                  return (
                    <div
                      key={entry.user.id}
                      className={`relative rounded-2xl px-2 pb-4 text-center ${
                        isFirst ? "lb-pod-first pt-8" : "bg-brand-soft pt-5"
                      } lb-pod`}
                    >
                      {isFirst && (
                        <>
                          <div className="lb-sunburst" aria-hidden />
                          <div className="lb-crown" aria-hidden>
                            👑
                          </div>
                          <div className="lb-sparkle lb-sparkle-l" aria-hidden>
                            ✨
                          </div>
                          <div className="lb-sparkle lb-sparkle-r" aria-hidden>
                            ✨
                          </div>
                          <div className="lb-sparkle lb-sparkle-b" aria-hidden>
                            ⭐
                          </div>
                        </>
                      )}

                      <div
                        className={`relative z-[1] mx-auto mb-2 ${
                          isFirst ? "h-[102px] w-[88px]" : "h-[82px] w-[70px]"
                        }`}
                      >
                        <div className={`lb-badge-outline lb-shield ${tone}`} />
                        <div
                          className={`lb-badge lb-shield ${tone} font-extrabold ${
                            isFirst ? "text-[23px]" : "text-lg"
                          }`}
                        >
                          {initials(entry.user.name)}
                        </div>
                      </div>

                      <span
                        className={`lb-rank-label ${tone} ${
                          isFirst ? "px-4 text-[14.5px]" : ""
                        }`}
                      >
                        Juara {rank}
                      </span>
                      <p className="mt-1.5 truncate text-[13.5px] font-bold">
                        {entry.user.name}
                      </p>
                      <p className="truncate text-[11px] text-muted">
                        {entry.user.department?.code ?? "—"}
                      </p>
                      <div
                        className={`mt-2 font-extrabold tabular-nums lb-count-${tone} ${
                          isFirst ? "text-[26px]" : "text-xl"
                        }`}
                      >
                        {entry.count}
                      </div>
                      <div className="text-[10.5px] font-bold uppercase tracking-wide text-muted">
                        temuan
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          {/* Sisa peringkat 4+ */}
          {rest.length > 0 && (
            <Card>
              <CardBody className="space-y-1">
                {rest.map((r) => (
                  <div
                    key={r.user.id}
                    className="flex items-center gap-3 rounded-xl px-1 py-2 transition hover:bg-background"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-extrabold text-brand-dark">
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
                      <p className="truncate text-[11px] text-muted">
                        {r.user.department?.code ?? "—"} · NPK {r.user.npk}
                      </p>
                      <div className="lb-bar-track mt-1">
                        <div
                          className="lb-bar-fill"
                          style={{
                            width: `${Math.max(6, Math.round((r.count / topCount) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-right text-sm font-extrabold tabular-nums text-foreground">
                      {r.count}
                      <span className="block text-[10px] font-semibold text-muted">
                        temuan
                      </span>
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
        <CardBody className="space-y-1">
          {departments.slice(0, 5).map((d, i) => (
            <div
              key={d.code}
              className={`rounded-xl px-2 py-2.5 transition hover:bg-background ${
                i === 0 ? "bg-gradient-to-r from-warn-soft to-transparent" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-5 shrink-0 text-center font-extrabold ${
                    i === 0 ? "text-[17px] text-warn" : "text-sm text-muted"
                  }`}
                >
                  {i === 0 ? "🏆" : i + 1}
                </span>
                <p className="min-w-0 flex-1 truncate text-sm font-bold">
                  {d.name}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-extrabold ${
                    d.avg5s != null
                      ? "bg-brand-soft text-brand-dark"
                      : "bg-background text-muted"
                  }`}
                >
                  {d.avg5s != null ? `5S ${d.avg5s.toFixed(0)}%` : "5S —"}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2 pl-8">
                <div className="lb-ontime-track">
                  <div
                    className="lb-ontime-fill"
                    style={{
                      width: `${
                        d.onTimeRatio != null
                          ? Math.round(d.onTimeRatio * 100)
                          : 100
                      }%`,
                    }}
                  />
                </div>
                <span className="w-9 shrink-0 text-right text-[11.5px] font-extrabold tabular-nums text-ok">
                  {d.onTimeRatio != null
                    ? `${Math.round(d.onTimeRatio * 100)}%`
                    : "—"}
                </span>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
