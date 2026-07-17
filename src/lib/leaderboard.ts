import "server-only";
import { prisma } from "@/lib/prisma";
import { wibDayStart, wibTodayStr } from "@/lib/dates";

export type Period = "month" | "all";

function periodStart(period: Period): Date | undefined {
  if (period === "all") return undefined;
  return wibDayStart(wibTodayStr().slice(0, 8) + "01"); // awal bulan WIB
}

/** Peringkat pelapor: jumlah temuan valid yang dilaporkan. */
export async function getReporterLeaderboard(period: Period) {
  const gte = periodStart(period);
  const grouped = await prisma.finding.groupBy({
    by: ["reporterId"],
    where: { isValid: true, ...(gte ? { createdAt: { gte } } : {}) },
    _count: true,
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
      count: g._count,
      user: byId[g.reporterId],
    }))
    .filter((r) => r.user);
}

/** Peringkat departemen: rasio closed on-time + rata-rata skor 5S terbaru.
 *  Jumlah query tetap (4), tidak tergantung banyaknya departemen. */
export async function getDepartmentRanking() {
  const [departments, statusCounts, closedWithDue] = await Promise.all([
    prisma.department.findMany({
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
    }),
    prisma.finding.groupBy({
      by: ["areaId", "status"],
      where: { isValid: true },
      _count: true,
    }),
    prisma.finding.findMany({
      where: { isValid: true, status: "CLOSED", dueDate: { not: null } },
      select: { areaId: true, closedAt: true, dueDate: true },
    }),
  ]);

  const closedByArea = new Map<string, number>();
  const openByArea = new Map<string, number>();
  for (const g of statusCounts) {
    const map = g.status === "CLOSED" ? closedByArea : openByArea;
    map.set(g.areaId, (map.get(g.areaId) ?? 0) + g._count);
  }
  const dueByArea = new Map<string, { total: number; onTime: number }>();
  for (const f of closedWithDue) {
    const e = dueByArea.get(f.areaId) ?? { total: 0, onTime: 0 };
    e.total++;
    if (f.closedAt && f.dueDate && f.closedAt <= addDays(f.dueDate, 1)) {
      e.onTime++;
    }
    dueByArea.set(f.areaId, e);
  }

  const rows = [];
  for (const d of departments) {
    if (!d.areas.length) continue;
    let closed = 0;
    let open = 0;
    let dueTotal = 0;
    let dueOnTime = 0;
    const scores: number[] = [];
    for (const a of d.areas) {
      closed += closedByArea.get(a.id) ?? 0;
      open += openByArea.get(a.id) ?? 0;
      const due = dueByArea.get(a.id);
      if (due) {
        dueTotal += due.total;
        dueOnTime += due.onTime;
      }
      const s = a.audits[0]?.totalScore;
      if (s != null) scores.push(s);
    }
    const onTimeRatio = dueTotal ? dueOnTime / dueTotal : null;
    const avg5s = scores.length
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : null;

    rows.push({
      code: d.code,
      name: d.name,
      closed,
      open,
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
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}
