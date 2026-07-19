import "server-only";
import { prisma } from "@/lib/prisma";
import { wibToday, wibTodayStr, wibDayStart } from "@/lib/dates";
import {
  calculateAuditProgress,
  calculateDashboardMetrics,
  createSafetyPulse,
} from "@/lib/dashboard-metrics";

export async function getKpis() {
  const today = wibToday();
  const monthStart = wibDayStart(wibTodayStr().slice(0, 8) + "01");
  const valid = { isValid: true } as const;

  const [open, inProgress, pending, closedThisMonth, overdue, closedAll] =
    await Promise.all([
      prisma.finding.count({ where: { ...valid, status: "OPEN" } }),
      prisma.finding.count({ where: { ...valid, status: "IN_PROGRESS" } }),
      prisma.finding.count({
        where: { ...valid, status: "PENDING_VERIFICATION" },
      }),
      prisma.finding.count({
        where: {
          ...valid,
          status: "CLOSED",
          closedAt: { gte: monthStart },
        },
      }),
      prisma.finding.count({
        where: {
          ...valid,
          status: { not: "CLOSED" },
          dueDate: { lt: today },
        },
      }),
      prisma.finding.findMany({
        where: {
          ...valid,
          status: "CLOSED",
          closedAt: { gte: monthStart },
        },
        select: { createdAt: true, closedAt: true },
      }),
    ]);

  const avgCloseDays = closedAll.length
    ? closedAll.reduce(
        (sum, finding) =>
          sum +
          (finding.closedAt!.getTime() - finding.createdAt.getTime()) /
            86_400_000,
        0,
      ) / closedAll.length
    : null;

  return { open, inProgress, pending, closedThisMonth, overdue, avgCloseDays };
}

/** Complete BOD view, derived from persisted findings and this month's audits. */
export async function getDashboardOverview() {
  const today = wibToday();
  const monthStart = new Date(today);
  monthStart.setUTCDate(1);
  const nextMonth = new Date(monthStart);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);

  const [findings, audits, activeAreas] = await Promise.all([
    prisma.finding.findMany({
      where: { isValid: true },
      select: {
        status: true,
        riskLevel: true,
        safetyCategory: true,
        createdAt: true,
        closedAt: true,
        dueDate: true,
        isValid: true,
      },
    }),
    prisma.audit.findMany({
      where: {
        scheduleId: { not: null },
        scheduledDate: { gte: monthStart, lt: nextMonth },
      },
      select: { areaId: true, status: true },
    }),
    prisma.area.count({ where: { isActive: true } }),
  ]);

  const findingsMetrics = calculateDashboardMetrics(findings, today);
  const auditProgress = calculateAuditProgress(audits, activeAreas);

  return {
    ...findingsMetrics,
    auditProgress,
    safetyPulse: createSafetyPulse({
      active: findingsMetrics.active,
      criticalActive: findingsMetrics.criticalActive,
      overdueCritical: findingsMetrics.overdueCritical,
      onTimeRate: findingsMetrics.onTimeRate,
      auditCompletionRate: auditProgress.completionRate,
    }),
  };
}

/** Tren 8 minggu terakhir: temuan valid dilaporkan vs selesai per minggu. */
export async function getWeeklyTrend() {
  const today = wibToday();
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7) - 7 * 7);

  const [reported, closed] = await Promise.all([
    prisma.finding.findMany({
      where: { isValid: true, createdAt: { gte: start } },
      select: { createdAt: true },
    }),
    prisma.finding.findMany({
      where: {
        isValid: true,
        status: "CLOSED",
        closedAt: { gte: start },
      },
      select: { closedAt: true },
    }),
  ]);

  const weeks: { label: string; start: Date; reported: number; closed: number }[] =
    [];
  for (let index = 0; index < 8; index++) {
    const weekStart = new Date(start);
    weekStart.setUTCDate(weekStart.getUTCDate() + index * 7);
    weeks.push({
      label: weekStart.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
      }),
      start: weekStart,
      reported: 0,
      closed: 0,
    });
  }

  const weekIndex = (date: Date) =>
    Math.floor((date.getTime() - start.getTime()) / (7 * 86_400_000));
  for (const finding of reported) {
    const index = weekIndex(finding.createdAt);
    if (index >= 0 && index < 8) weeks[index].reported++;
  }
  for (const finding of closed) {
    const index = weekIndex(finding.closedAt!);
    if (index >= 0 && index < 8) weeks[index].closed++;
  }

  return weeks.map(({ label, reported: reportedCount, closed: closedCount }) => ({
    label,
    Dilaporkan: reportedCount,
    Selesai: closedCount,
  }));
}

/** Skor 5S terbaru per area (dari audit SUBMITTED terakhir). */
export async function getAreaScores() {
  const areas = await prisma.area.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      department: { select: { code: true, name: true } },
      audits: {
        where: { status: "SUBMITTED" },
        orderBy: { submittedAt: "desc" },
        take: 2,
        select: { totalScore: true, submittedAt: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return areas
    .map((area) => ({
      id: area.id,
      name: area.name,
      departmentCode: area.department.code,
      score: area.audits[0]?.totalScore ?? null,
      prevScore: area.audits[1]?.totalScore ?? null,
      lastAuditAt: area.audits[0]?.submittedAt ?? null,
    }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

/** Temuan kritis aktif yang sudah melewati target, paling lama dahulu. */
export async function getEscalations() {
  const today = wibToday();
  const findings = await prisma.finding.findMany({
    where: {
      isValid: true,
      riskLevel: "CRITICAL",
      status: { not: "CLOSED" },
      dueDate: { lt: today },
    },
    orderBy: { dueDate: "asc" },
    take: 10,
    select: {
      id: true,
      number: true,
      description: true,
      dueDate: true,
      status: true,
      area: { select: { name: true } },
      pic: { select: { name: true } },
    },
  });

  return findings.map((finding) => ({
    ...finding,
    daysOverdue: Math.floor(
      (today.getTime() - finding.dueDate!.getTime()) / 86_400_000,
    ),
  }));
}
