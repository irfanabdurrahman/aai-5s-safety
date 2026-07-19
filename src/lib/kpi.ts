import "server-only";
import { prisma } from "@/lib/prisma";
import { wibToday, wibTodayStr, wibDayStart } from "@/lib/dates";

export async function getKpis() {
  const today = wibToday();
  // Awal bulan kalender WIB (sebagai momen timestamp)
  const monthStart = wibDayStart(wibTodayStr().slice(0, 8) + "01");

  const [open, inProgress, pending, closedThisMonth, overdue, closedAll] =
    await Promise.all([
      prisma.finding.count({ where: { status: "OPEN" } }),
      prisma.finding.count({ where: { status: "IN_PROGRESS" } }),
      prisma.finding.count({ where: { status: "PENDING_VERIFICATION" } }),
      prisma.finding.count({
        where: { status: "CLOSED", closedAt: { gte: monthStart } },
      }),
      prisma.finding.count({
        where: { status: { not: "CLOSED" }, dueDate: { lt: today } },
      }),
      prisma.finding.findMany({
        where: { status: "CLOSED", closedAt: { gte: monthStart } },
        select: { createdAt: true, closedAt: true },
      }),
    ]);

  const avgCloseDays = closedAll.length
    ? closedAll.reduce(
        (s, f) =>
          s + (f.closedAt!.getTime() - f.createdAt.getTime()) / 86400000,
        0,
      ) / closedAll.length
    : null;

  return { open, inProgress, pending, closedThisMonth, overdue, avgCloseDays };
}

/** Tren 8 minggu terakhir: dilaporkan vs selesai per minggu. */
export async function getWeeklyTrend() {
  const today = wibToday();
  // Senin minggu WIB berjalan (ISO: Senin=0 offset), lalu 7 minggu ke belakang
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7) - 7 * 7);

  const [reported, closed] = await Promise.all([
    prisma.finding.findMany({
      where: { createdAt: { gte: start } },
      select: { createdAt: true },
    }),
    prisma.finding.findMany({
      where: { closedAt: { gte: start } },
      select: { closedAt: true },
    }),
  ]);

  const weeks: { label: string; start: Date; reported: number; closed: number }[] =
    [];
  for (let i = 0; i < 8; i++) {
    const ws = new Date(start);
    ws.setUTCDate(ws.getUTCDate() + i * 7);
    weeks.push({
      label: ws.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
      start: ws,
      reported: 0,
      closed: 0,
    });
  }
  const weekIndex = (d: Date) =>
    Math.floor((d.getTime() - start.getTime()) / (7 * 86400000));
  for (const f of reported) {
    const i = weekIndex(f.createdAt);
    if (i >= 0 && i < 8) weeks[i].reported++;
  }
  for (const f of closed) {
    const i = weekIndex(f.closedAt!);
    if (i >= 0 && i < 8) weeks[i].closed++;
  }
  return weeks.map(({ label, reported, closed }) => ({
    label,
    Dilaporkan: reported,
    Selesai: closed,
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
    .map((a) => ({
      id: a.id,
      name: a.name,
      departmentCode: a.department.code,
      score: a.audits[0]?.totalScore ?? null,
      prevScore: a.audits[1]?.totalScore ?? null,
      lastAuditAt: a.audits[0]?.submittedAt ?? null,
    }))
    .sort((x, y) => (y.score ?? -1) - (x.score ?? -1));
}

/** Temuan overdue ≥3 hari — perlu eskalasi. */
export async function getEscalations() {
  const cutoff = wibToday();
  cutoff.setUTCDate(cutoff.getUTCDate() - 3);
  return prisma.finding.findMany({
    where: { status: { not: "CLOSED" }, dueDate: { lt: cutoff } },
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
}
