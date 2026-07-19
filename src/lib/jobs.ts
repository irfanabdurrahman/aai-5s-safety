import "server-only";
import { prisma } from "@/lib/prisma";
import {
  wibToday,
  wibDow,
  wibDayOfMonth,
  addDays,
  toDateStr,
} from "@/lib/dates";
import type { NotificationType } from "@/generated/prisma/enums";
import { cleanupExpiredLoginAttempts } from "@/lib/login-throttle";

/** Materialisasi audit dari jadwal untuk hari (kalender WIB) ini. */
export async function materializeAudits() {
  const today = wibToday();
  const schedules = await prisma.auditSchedule.findMany({
    where: { isActive: true, startDate: { lte: addDays(today, 1) } },
  });

  let created = 0;
  for (const s of schedules) {
    const due =
      s.frequency === "WEEKLY"
        ? wibDow() === (s.dayOfWeek ?? 1)
        : s.frequency === "MONTHLY"
          ? wibDayOfMonth() === (s.dayOfMonth ?? 1)
          : toDateStr(s.startDate) === toDateStr(today); // ONCE: bandingkan tanggal kalender

    if (!due) continue;
    if (s.frequency === "ONCE") {
      // ONCE hanya sekali — skip jika sudah pernah dibuat
      const anyAudit = await prisma.audit.findFirst({
        where: { scheduleId: s.id },
        select: { id: true },
      });
      if (anyAudit) continue;
    }

    // Unique(scheduleId, scheduledDate) + transaction lock makes materialization
    // idempotent across replicas, including its notification side effect.
    const inserted = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`${s.id}:${toDateStr(today)}`}))`;
      const exists = await tx.audit.findUnique({
        where: {
          scheduleId_scheduledDate: {
            scheduleId: s.id,
            scheduledDate: today,
          },
        },
        select: { id: true },
      });
      if (exists) return false;

      const audit = await tx.audit.create({
        data: {
          scheduleId: s.id,
          areaId: s.areaId,
          templateId: s.templateId,
          auditorId: s.auditorId,
          status: "SCHEDULED",
          scheduledDate: today,
        },
      });
      await tx.notification.create({
        data: {
          userId: s.auditorId,
          type: "AUDIT_DUE",
          title: "Audit 5S hari ini — jangan lupa dikerjakan",
          auditId: audit.id,
        },
      });
      return true;
    });
    if (inserted) created++;
  }
  return created;
}

/** Notifikasi H-1, overdue, dan eskalasi ≥3 hari.
 *  Unique dedupeKey tanggal-WIB membuat insert idempotent antar replica. */
export async function sendDueNotifications() {
  const today = wibToday();
  const tomorrow = addDays(today, 1);

  const [dueSoon, overdue, admins, supervisors] = await Promise.all([
    prisma.finding.findMany({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS"] },
        dueDate: { gte: tomorrow, lt: addDays(tomorrow, 1) },
      },
      select: { id: true, number: true, picId: true },
    }),
    prisma.finding.findMany({
      where: { status: { not: "CLOSED" }, dueDate: { lt: today } },
      select: {
        id: true,
        number: true,
        picId: true,
        dueDate: true,
        area: { select: { departmentId: true } },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true, role: "ADMIN" },
      select: { id: true },
    }),
    prisma.user.findMany({
      where: { isActive: true, role: "SUPERVISOR" },
      select: { id: true, departmentId: true },
    }),
  ]);

  const spvByDept = new Map<string, string[]>();
  for (const s of supervisors) {
    if (!s.departmentId) continue;
    spvByDept.set(s.departmentId, [
      ...(spvByDept.get(s.departmentId) ?? []),
      s.id,
    ]);
  }
  const toCreate: {
    userId: string;
    type: NotificationType;
    title: string;
    findingId: string;
    dedupeKey: string;
  }[] = [];
  const already = new Set<string>();
  const dateKey = toDateStr(today);
  const push = (
    userId: string | null,
    type: NotificationType,
    title: string,
    findingId: string,
  ) => {
    if (!userId) return;
    const key = `${dateKey}:${userId}:${type}:${findingId}`;
    if (already.has(key)) return;
    already.add(key);
    toCreate.push({ userId, type, title, findingId, dedupeKey: key });
  };

  for (const f of dueSoon) {
    push(f.picId, "FINDING_DUE_SOON", `⏰ ${f.number} jatuh tempo besok`, f.id);
  }
  for (const f of overdue) {
    const daysLate = Math.floor(
      (today.getTime() - f.dueDate!.getTime()) / 86400000,
    );
    const title = `🔴 ${f.number} terlambat ${daysLate} hari`;
    push(f.picId, "FINDING_OVERDUE", title, f.id);
    for (const spvId of spvByDept.get(f.area.departmentId) ?? []) {
      push(spvId, "FINDING_OVERDUE", title, f.id);
    }
    if (daysLate >= 3) {
      for (const a of admins) {
        push(
          a.id,
          "FINDING_ESCALATED",
          `🚨 Eskalasi: ${f.number} terlambat ${daysLate} hari`,
          f.id,
        );
      }
    }
  }

  const notified = toCreate.length
    ? (await prisma.notification.createMany({
        data: toCreate,
        skipDuplicates: true,
      })).count
    : 0;
  return {
    dueSoon: dueSoon.length,
    overdue: overdue.length,
    notified,
  };
}

export async function runDailyJobs() {
  await cleanupExpiredLoginAttempts();
  const audits = await materializeAudits();
  const notif = await sendDueNotifications();
  return { auditsCreated: audits, ...notif, ranAt: new Date().toISOString() };
}
