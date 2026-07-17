import "server-only";
import { prisma } from "@/lib/prisma";

export type Period = "month" | "all";

function periodStart(period: Period): Date | undefined {
  if (period === "all") return undefined;
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Peringkat pelapor: jumlah temuan valid yang dilaporkan. */
export async function getReporterLeaderboard(period: Period) {
  const gte = periodStart(period);
  const grouped = await prisma.finding.groupBy({
    by: ["reporterId"],
    where: gte ? { createdAt: { gte } } : {},
    _count: { _all: true },
    orderBy: { _count: { reporterId: "desc" } },
    take: 20,
  });
  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map((g) => g.reporterId) } },
    select: {
      id: true,
      name: true,
      npk: true,
      department: { select: { code: true } },
    },
  });
  const byId = Object.fromEntries(users.map((u) => [u.id, u]));
  return grouped
    .map((g, i) => ({
      rank: i + 1,
      count: g._count._all,
      user: byId[g.reporterId],
    }))
    .filter((r) => r.user);
}

/** Peringkat departemen: rasio closed on-time + rata-rata skor 5S terbaru. */
export async function getDepartmentRanking() {
  const departments = await prisma.department.findMany({
    where: { isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      areas: {
        where: { isActive: true },
        select: {
          id: true,
          audits: {
            where: { status: "SUBMITTED" },
            orderBy: { submittedAt: "desc" },
            take: 1,
            select: { totalScore: true },
          },
        },
      },
    },
  });

  const rows = [];
  for (const d of departments) {
    const areaIds = d.areas.map((a) => a.id);
    if (!areaIds.length) continue;

    const [closed, openCount] = await Promise.all([
      prisma.finding.count({
        where: { areaId: { in: areaIds }, status: "CLOSED" },
      }),
      prisma.finding.count({
        where: { areaId: { in: areaIds }, status: { not: "CLOSED" } },
      }),
    ]);

    const closedWithDue = await prisma.finding.findMany({
      where: {
        areaId: { in: areaIds },
        status: "CLOSED",
        dueDate: { not: null },
      },
      select: { closedAt: true, dueDate: true },
    });
    const onTime = closedWithDue.filter(
      (f) => f.closedAt && f.dueDate && f.closedAt <= addDays(f.dueDate, 1),
    ).length;
    const onTimeRatio = closedWithDue.length
      ? onTime / closedWithDue.length
      : null;

    const scores = d.areas
      .map((a) => a.audits[0]?.totalScore)
      .filter((s): s is number => s != null);
    const avg5s = scores.length
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : null;

    rows.push({
      code: d.code,
      name: d.name,
      closed,
      open: openCount,
      onTimeRatio,
      avg5s,
      // Skor komposit: 60% ketepatan waktu + 40% skor 5S (yang tersedia)
      composite:
        (onTimeRatio != null ? onTimeRatio * 60 : 30) +
        (avg5s != null ? (avg5s / 100) * 40 : 20),
    });
  }
  return rows.sort((a, b) => b.composite - a.composite);
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
