import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  getAreaScores,
  getDashboardOverview,
  getEscalations,
  getWeeklyTrend,
} from "@/lib/kpi";
import { getDepartmentRanking } from "@/lib/leaderboard";
import { rankDepartments } from "@/lib/dashboard-metrics";
import {
  CATEGORY_META,
  formatDate,
  RISK_META,
  scoreBand,
  STATUS_META,
} from "@/lib/labels";
import {
  IconAlert,
  IconCalendar,
  IconCamera,
  IconChart,
  IconCheckSquare,
  IconChevronRight,
  IconClock,
  IconShield,
  IconTrophy,
} from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import {
  DashboardSection,
  EmptyState,
  MetricCard,
  ProgressLine,
} from "@/components/dashboard/DashboardPrimitives";
import { TrendChart } from "@/components/dashboard/TrendChart";

export const metadata: Metadata = { title: "Dashboard BOD" };

const STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "PENDING_VERIFICATION",
  "CLOSED",
] as const;
const RISKS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
const CATEGORIES = ["UNSAFE_CONDITION", "UNSAFE_ACT", "NEAR_MISS"] as const;

const STATUS_COLORS = {
  OPEN: "bg-danger",
  IN_PROGRESS: "bg-warn",
  PENDING_VERIFICATION: "bg-info",
  CLOSED: "bg-ok",
} as const;

const RISK_CELL = {
  CRITICAL: "bg-danger-soft text-danger border-danger/30",
  HIGH: "bg-warn-soft text-warn border-warn/30",
  MEDIUM: "bg-info-soft text-info border-info/30",
  LOW: "bg-background text-muted border-line",
} as const;

function displayDays(value: number | null) {
  if (value == null) return "—";
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: 1 })} hari`;
}

function rate(value: number | null) {
  return value == null ? "—" : `${value}%`;
}

export default async function DashboardPage() {
  await requireUser(["SUPERVISOR", "ADMIN"]);
  const [overview, trend, areaScores, escalations, rawDepartmentRanking] =
    await Promise.all([
      getDashboardOverview(),
      getWeeklyTrend(),
      getAreaScores(),
      getEscalations(),
      getDepartmentRanking(),
    ]);
  const departmentRanking = rankDepartments(rawDepartmentRanking);
  const auditedAreas = areaScores.filter((area) => area.score != null);
  const funnelMax = Math.max(1, ...STATUSES.map((status) => overview.funnel[status]));
  const agingTotal = Math.max(
    1,
    overview.backlogAging.under7 +
      overview.backlogAging.days7to14 +
      overview.backlogAging.over14,
  );

  return (
    <main className="space-y-5 pb-5">
      <section className="relative overflow-hidden rounded-3xl border-2 border-brand/35 bg-surface px-5 py-6 shadow-[0_18px_45px_rgba(67,74,158,0.12)] sm:px-7 sm:py-7">
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,var(--brand-primary-soft),transparent_65%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-10 hidden w-48 opacity-40 sm:block bg-[linear-gradient(90deg,transparent_49%,var(--border)_50%,transparent_51%),linear-gradient(0deg,transparent_49%,var(--border)_50%,transparent_51%)] bg-[size:24px_24px]"
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-ok/30 bg-ok-soft px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-ok">
                <span className="h-2 w-2 rounded-full bg-ok" aria-hidden="true" />
                Data operasional aktual
              </span>
              <span className="rounded-full border border-line bg-background px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                Executive Safety Command
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              Dashboard BOD 5S &amp; Safety
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Satu pandangan untuk risiko kritis, kecepatan tindak lanjut, disiplin
              audit, dan performa area—seluruhnya dihitung dari data aplikasi.
            </p>
          </div>
          <Link
            href="/galeri"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-brand bg-brand px-4 py-2.5 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(90,99,192,0.25)] transition hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <IconCamera size={18} aria-hidden="true" />
            Buka Safety &amp; 5S Live Wall
            <IconChevronRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section aria-labelledby="ringkasan-eksekutif">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-brand">
              Executive Readout
            </p>
            <h2 id="ringkasan-eksekutif" className="text-lg font-black tracking-tight">
              Indikator utama
            </h2>
          </div>
          <p className="hidden text-xs font-semibold text-muted sm:block">
            Semua periode · audit bulan berjalan
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MetricCard
            label="Kritis Aktif"
            value={overview.criticalActive}
            detail={`${overview.active} total temuan aktif`}
            tone="danger"
            icon={<IconAlert size={20} />}
          />
          <MetricCard
            label="Kritis Overdue"
            value={overview.overdueCritical}
            detail="Aktif dan melewati target"
            tone={overview.overdueCritical > 0 ? "danger" : "ok"}
            icon={<IconClock size={20} />}
          />
          <MetricCard
            label="SLA On-time"
            value={rate(overview.onTimeRate)}
            detail="Temuan selesai yang memiliki target"
            tone={overview.onTimeRate != null && overview.onTimeRate >= 80 ? "ok" : "warn"}
            icon={<IconShield size={20} />}
          />
          <MetricCard
            label="Median Close"
            value={displayDays(overview.medianCloseDays)}
            detail="Median hari dari laporan ke selesai"
            tone="info"
            icon={<IconCheckSquare size={20} />}
          />
          <MetricCard
            label="Audit Selesai"
            value={rate(overview.auditProgress.completionRate)}
            detail={`${overview.auditProgress.submitted}/${overview.auditProgress.scheduled} audit bulan ini`}
            tone="brand"
            icon={<IconCalendar size={20} />}
          />
        </div>
      </section>

      <section
        aria-labelledby="safety-pulse"
        className="grid gap-4 rounded-2xl border-2 border-info/35 bg-info-soft p-4 shadow-[0_8px_24px_rgba(23,92,211,0.08)] sm:grid-cols-[auto_1fr] sm:items-center sm:p-5"
      >
        <span className="grid h-12 w-12 place-items-center rounded-2xl border border-info/30 bg-surface text-info shadow-sm">
          <IconChart size={24} aria-hidden="true" />
        </span>
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-info">
            Safety Pulse · berbasis angka
          </p>
          <h2 id="safety-pulse" className="sr-only">
            Ringkasan Safety Pulse
          </h2>
          <p className="mt-1 text-sm font-bold leading-6 text-foreground sm:text-base">
            {overview.safetyPulse}
          </p>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <DashboardSection
          eyebrow="Flow Control"
          title="Status funnel & usia backlog"
          description="Distribusi status seluruh temuan valid dan usia item yang belum selesai."
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3" aria-label="Distribusi status temuan">
              {STATUSES.map((status) => {
                const value = overview.funnel[status];
                return (
                  <div key={status}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                      <span className="font-bold">{STATUS_META[status].label}</span>
                      <span className="font-black tabular-nums">{value}</span>
                    </div>
                    <div className="h-4 overflow-hidden rounded-md border border-line bg-background">
                      <div
                        className={`h-full min-w-0 ${STATUS_COLORS[status]}`}
                        style={{ width: `${(value / funnelMax) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="space-y-4 rounded-xl border border-line bg-background p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted">
                  Backlog Aging
                </h3>
                <span className="text-xs font-black tabular-nums">{overview.active} aktif</span>
              </div>
              <ProgressLine
                label="< 7 hari"
                value={Math.round((overview.backlogAging.under7 / agingTotal) * 100)}
                count={`${overview.backlogAging.under7}`}
                tone="ok"
              />
              <ProgressLine
                label="7–14 hari"
                value={Math.round((overview.backlogAging.days7to14 / agingTotal) * 100)}
                count={`${overview.backlogAging.days7to14}`}
                tone="warn"
              />
              <ProgressLine
                label="> 14 hari"
                value={Math.round((overview.backlogAging.over14 / agingTotal) * 100)}
                count={`${overview.backlogAging.over14}`}
                tone="danger"
              />
            </div>
          </div>
        </DashboardSection>

        <DashboardSection
          eyebrow="Audit Discipline"
          title="Penyelesaian & coverage"
          description="Audit terjadwal pada bulan berjalan dan area aktif yang tersentuh."
        >
          <div className="space-y-5">
            <ProgressLine
              label="Penyelesaian jadwal"
              value={overview.auditProgress.completionRate}
              count={`${overview.auditProgress.submitted}/${overview.auditProgress.scheduled}`}
              tone="brand"
            />
            <ProgressLine
              label="Coverage area aktif"
              value={overview.auditProgress.coverageRate}
              count={`${overview.auditProgress.coveredAreas}/${overview.auditProgress.activeAreas}`}
              tone="info"
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-brand/25 bg-brand-soft p-3">
                <p className="text-2xl font-black tabular-nums text-brand-deeper">
                  {overview.auditProgress.scheduled}
                </p>
                <p className="text-[11px] font-bold text-muted">Audit dijadwalkan</p>
              </div>
              <div className="rounded-xl border border-ok/25 bg-ok-soft p-3">
                <p className="text-2xl font-black tabular-nums text-ok">
                  {overview.auditProgress.submitted}
                </p>
                <p className="text-[11px] font-bold text-muted">Audit submitted</p>
              </div>
            </div>
          </div>
        </DashboardSection>
      </div>

      <DashboardSection
        eyebrow="Risk Intelligence"
        title="Matriks risiko"
        description="Volume temuan valid menurut tingkat risiko terhadap status workflow dan kategori safety."
      >
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="overflow-x-auto">
            <h3 className="mb-3 text-xs font-extrabold uppercase tracking-[0.12em] text-muted">
              Risiko × Status
            </h3>
            <table className="w-full min-w-[500px] border-separate border-spacing-1 text-xs">
              <thead>
                <tr>
                  <th scope="col" className="px-2 py-2 text-left text-muted">Risiko</th>
                  {STATUSES.map((status) => (
                    <th scope="col" key={status} className="px-2 py-2 text-center text-muted">
                      {STATUS_META[status].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RISKS.map((risk) => (
                  <tr key={risk}>
                    <th scope="row" className="px-2 py-2 text-left font-extrabold">
                      {RISK_META[risk].label}
                    </th>
                    {STATUSES.map((status) => (
                      <td key={status} className={`rounded-lg border px-3 py-3 text-center text-base font-black tabular-nums ${RISK_CELL[risk]}`}>
                        {overview.riskByStatus[risk][status]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="overflow-x-auto">
            <h3 className="mb-3 text-xs font-extrabold uppercase tracking-[0.12em] text-muted">
              Risiko × Kategori Safety
            </h3>
            <table className="w-full min-w-[440px] border-separate border-spacing-1 text-xs">
              <thead>
                <tr>
                  <th scope="col" className="px-2 py-2 text-left text-muted">Risiko</th>
                  {CATEGORIES.map((category) => (
                    <th scope="col" key={category} className="px-2 py-2 text-center text-muted">
                      {CATEGORY_META[category].short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RISKS.map((risk) => (
                  <tr key={risk}>
                    <th scope="row" className="px-2 py-2 text-left font-extrabold">
                      {RISK_META[risk].label}
                    </th>
                    {CATEGORIES.map((category) => (
                      <td key={category} className={`rounded-lg border px-3 py-3 text-center text-base font-black tabular-nums ${RISK_CELL[risk]}`}>
                        {overview.riskByCategory[risk][category]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DashboardSection>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <DashboardSection
          eyebrow="8 Week Signal"
          title="Tren laporan vs penyelesaian"
          description="Pergerakan mingguan untuk membaca tekanan masuk dan kapasitas penyelesaian."
        >
          <TrendChart data={trend} />
        </DashboardSection>

        <DashboardSection
          eyebrow="5S Quality"
          title="Skor area terbaru"
          description="Audit submitted terakhir per area, diurutkan dari skor tertinggi."
        >
          {auditedAreas.length === 0 ? (
            <EmptyState>Belum ada audit 5S yang selesai.</EmptyState>
          ) : (
            <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
              {auditedAreas.map((area) => {
                const delta = area.prevScore == null ? null : area.score! - area.prevScore;
                return (
                  <div key={area.id} className="rounded-xl border border-line bg-background p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-extrabold">{area.name}</p>
                        <p className="text-[10px] font-bold text-muted">{area.departmentCode}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {delta != null && (
                          <span className={`text-[10px] font-extrabold tabular-nums ${delta >= 0 ? "text-ok" : "text-danger"}`}>
                            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}
                          </span>
                        )}
                        <span className={`text-sm font-black tabular-nums ${scoreBand(area.score!).text}`}>
                          {area.score!.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full border border-line bg-surface">
                      <div className={`h-full rounded-full ${scoreBand(area.score!).bg}`} style={{ width: `${area.score}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DashboardSection>
      </div>

      <DashboardSection
        eyebrow="Critical Control"
        title="Eskalasi kritis"
        description="Temuan kritis aktif yang telah melewati target, diprioritaskan dari keterlambatan terlama."
        className={escalations.length > 0 ? "border-danger/45" : "border-ok/35"}
      >
        {escalations.length === 0 ? (
          <EmptyState>Tidak ada temuan kritis aktif yang melewati target.</EmptyState>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {escalations.map((finding) => (
              <Link
                key={finding.id}
                href={`/temuan/${finding.id}`}
                className="group flex min-h-28 items-start gap-3 rounded-xl border-2 border-danger/25 bg-danger-soft p-4 transition hover:border-danger/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface text-danger shadow-sm">
                  <IconAlert size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-black text-danger">{finding.daysOverdue} hari overdue</p>
                    <Badge tone="danger">{STATUS_META[finding.status].label}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm font-bold text-foreground">
                    {finding.number} — {finding.description}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-muted">
                    {finding.area.name} · PIC {finding.pic?.name ?? "—"} · target {formatDate(finding.dueDate)}
                  </p>
                </div>
                <IconChevronRight className="mt-2 shrink-0 text-danger transition group-hover:translate-x-0.5" size={17} aria-hidden="true" />
              </Link>
            ))}
          </div>
        )}
      </DashboardSection>

      <DashboardSection
        eyebrow="Department Performance"
        title="Peringkat departemen"
        description="Skor observasi yang tersedia dari ketepatan waktu dan 5S; dimensi tanpa data tidak diberi nilai buatan."
      >
        {departmentRanking.length === 0 ? (
          <EmptyState>Belum ada departemen aktif dengan area.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b-2 border-line text-left text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                  <th scope="col" className="pb-3 pr-3">Peringkat</th>
                  <th scope="col" className="pb-3 pr-3">Departemen</th>
                  <th scope="col" className="pb-3 pr-3 text-right">Aktif</th>
                  <th scope="col" className="pb-3 pr-3 text-right">Selesai</th>
                  <th scope="col" className="pb-3 pr-3 text-right">On-time</th>
                  <th scope="col" className="pb-3 pr-3 text-right">Skor 5S</th>
                  <th scope="col" className="pb-3 text-right">Indeks</th>
                </tr>
              </thead>
              <tbody>
                {departmentRanking.map((department, index) => (
                  <tr key={department.code} className="border-b border-line last:border-0">
                    <td className="py-3 pr-3">
                      <span className={`inline-grid h-8 w-8 place-items-center rounded-lg border font-black tabular-nums ${index < 3 ? "border-brand/30 bg-brand-soft text-brand-deeper" : "border-line bg-background text-muted"}`}>
                        {index + 1}
                      </span>
                    </td>
                    <th scope="row" className="py-3 pr-3 text-left">
                      <span className="font-extrabold">{department.name}</span>
                      <span className="ml-2 text-xs font-bold text-muted">{department.code}</span>
                    </th>
                    <td className="py-3 pr-3 text-right font-bold tabular-nums">{department.open}</td>
                    <td className="py-3 pr-3 text-right font-bold tabular-nums">{department.closed}</td>
                    <td className="py-3 pr-3 text-right font-extrabold tabular-nums">
                      {department.onTimeRatio == null ? "—" : `${Math.round(department.onTimeRatio * 100)}%`}
                    </td>
                    <td className="py-3 pr-3 text-right font-extrabold tabular-nums">
                      {department.avg5s == null ? "—" : `${department.avg5s.toFixed(0)}%`}
                    </td>
                    <td className="py-3 text-right">
                      <span className="inline-flex min-w-14 justify-center rounded-lg border border-ok/25 bg-ok-soft px-2 py-1 text-xs font-black tabular-nums text-ok">
                        {department.composite == null ? "—" : department.composite.toFixed(0)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardSection>

      <section className="flex flex-col items-start justify-between gap-4 rounded-2xl border-2 border-brand/30 bg-brand-soft p-5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface text-brand shadow-sm">
            <IconTrophy size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-black">Lihat bukti perubahan di lapangan</h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              Jelajahi dokumentasi before–after yang berasal dari tindak lanjut temuan.
            </p>
          </div>
        </div>
        <Link
          href="/galeri"
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-brand bg-surface px-4 py-2.5 text-sm font-extrabold text-brand-deeper transition hover:bg-brand hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:w-auto"
        >
          Ke Galeri
          <IconChevronRight size={17} aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
