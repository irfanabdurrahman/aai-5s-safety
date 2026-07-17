import "server-only";
import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@/generated/prisma/enums";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
/** ISO day of week 1..7 (Senin=1). */
function isoDow(d: Date) {
  return ((d.getDay() + 6) % 7) + 1;
}

/** Kirim notif sekali per hari per (user, tipe, temuan) — anti spam. */
async function notifyOnce(
  userId: string,
  type: NotificationType,
  title: string,
  findingId?: string,
) {
  const today = startOfToday();
  const dup = await prisma.notification.findFirst({
    where: { userId, type, findingId: findingId ?? null, createdAt: { gte: today } },
    select: { id: true },
  });
  if (dup) return;
  await prisma.notification.create({
    data: { userId, type, title, findingId },
  });
}

async function supervisorsOf(departmentId: string | null) {
  if (!departmentId) return [];
  const rows = await prisma.user.findMany({
    where: { isActive: true, role: "SUPERVISOR", departmentId },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Materialisasi audit dari jadwal untuk hari ini (dipanggil tiap pagi). */
export async function materializeAudits() {
  const today = startOfToday();
  const schedules = await prisma.auditSchedule.findMany({
    where: { isActive: true, startDate: { lte: addDays(today, 1) } },
  });

  let created = 0;
  for (const s of schedules) {
    const due =
      s.frequency === "WEEKLY"
        ? isoDow(today) === (s.dayOfWeek ?? 1)
        : s.frequency === "MONTHLY"
          ? today.getDate() === (s.dayOfMonth ?? 1)
          : today.getTime() === new Date(s.startDate).setHours(0, 0, 0, 0);
    if (!due) continue;

    const exists = await prisma.audit.findFirst({
      where: { scheduleId: s.id, scheduledDate: today },
      select: { id: true },
    });
    if (exists) continue;

    const audit = await prisma.audit.create({
      data: {
        scheduleId: s.id,
        areaId: s.areaId,
        templateId: s.templateId,
        auditorId: s.auditorId,
        status: "SCHEDULED",
        scheduledDate: today,
      },
    });
    await prisma.notification.create({
      data: {
        userId: s.auditorId,
        type: "AUDIT_DUE",
        title: "Audit 5S hari ini — jangan lupa dikerjakan",
        auditId: audit.id,
      },
    });
    created++;
  }
  return created;
}

/** Notifikasi H-1, overdue, dan eskalasi ≥3 hari. */
export async function sendDueNotifications() {
  const today = startOfToday();
  const tomorrow = addDays(today, 1);

  // H-1: due besok
  const dueSoon = await prisma.finding.findMany({
    where: {
      status: { in: ["OPEN", "IN_PROGRESS"] },
      dueDate: { gte: tomorrow, lt: addDays(tomorrow, 1) },
    },
    select: { id: true, number: true, picId: true },
  });
  for (const f of dueSoon) {
    if (f.picId)
      await notifyOnce(
        f.picId,
        "FINDING_DUE_SOON",
        `⏰ ${f.number} jatuh tempo besok`,
        f.id,
      );
  }

  // Overdue: lewat due, belum closed
  const overdue = await prisma.finding.findMany({
    where: { status: { not: "CLOSED" }, dueDate: { lt: today } },
    select: {
      id: true,
      number: true,
      picId: true,
      dueDate: true,
      area: { select: { departmentId: true } },
    },
  });
  const admins = await prisma.user.findMany({
    where: { isActive: true, role: "ADMIN" },
    select: { id: true },
  });

  for (const f of overdue) {
    const daysLate = Math.floor(
      (today.getTime() - f.dueDate!.getTime()) / 86400000,
    );
    if (f.picId)
      await notifyOnce(
        f.picId,
        "FINDING_OVERDUE",
        `🔴 ${f.number} terlambat ${daysLate} hari`,
        f.id,
      );
    for (const spvId of await supervisorsOf(f.area.departmentId)) {
      await notifyOnce(
        spvId,
        "FINDING_OVERDUE",
        `🔴 ${f.number} terlambat ${daysLate} hari`,
        f.id,
      );
    }
    if (daysLate >= 3) {
      for (const a of admins) {
        await notifyOnce(
          a.id,
          "FINDING_ESCALATED",
          `🚨 Eskalasi: ${f.number} terlambat ${daysLate} hari`,
          f.id,
        );
      }
    }
  }
  return { dueSoon: dueSoon.length, overdue: overdue.length };
}

export async function runDailyJobs() {
  const audits = await materializeAudits();
  const notif = await sendDueNotifications();
  return { auditsCreated: audits, ...notif, ranAt: new Date().toISOString() };
}
