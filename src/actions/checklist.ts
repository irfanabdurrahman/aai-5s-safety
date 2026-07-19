"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseDateOnly } from "@/lib/dates";
import type { ActionState } from "@/actions/auth";
import { scheduleSchema, firstOccurrence } from "@/lib/schedule";

const criterionSchema = z.object({
  templateId: z.string().min(1),
  pillar: z.enum(["SEIRI", "SEITON", "SEISO", "SEIKETSU", "SHITSUKE"]),
  text: z.string().trim().min(5, "Teks kriteria minimal 5 karakter").max(300),
});

export async function addCriterion(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser(["ADMIN"]);
  const parsed = criterionSchema.safeParse({
    templateId: formData.get("templateId"),
    pillar: formData.get("pillar"),
    text: formData.get("text"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const last = await prisma.checklistCriterion.findFirst({
    where: { templateId: parsed.data.templateId },
    orderBy: { sortOrder: "desc" },
  });
  await prisma.checklistCriterion.create({
    data: { ...parsed.data, sortOrder: (last?.sortOrder ?? 0) + 1 },
  });
  revalidatePath("/admin/checklist");
  return { ok: true };
}

export async function updateCriterion(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser(["ADMIN"]);
  const id = String(formData.get("id") || "");
  const text = String(formData.get("text") || "").trim();
  if (text.length < 5) return { error: "Teks kriteria minimal 5 karakter" };
  await prisma.checklistCriterion.update({ where: { id }, data: { text } });
  revalidatePath("/admin/checklist");
  return { ok: true };
}

export async function toggleCriterion(formData: FormData) {
  await requireUser(["ADMIN"]);
  const id = String(formData.get("id") || "");
  const c = await prisma.checklistCriterion.findUnique({ where: { id } });
  if (!c) return;
  await prisma.checklistCriterion.update({
    where: { id },
    data: { isActive: !c.isActive },
  });
  revalidatePath("/admin/checklist");
}

// ------------------------------------------------------------
// Jadwal audit
// ------------------------------------------------------------
export async function createSchedule(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser(["ADMIN"]);
  const parsed = scheduleSchema.safeParse({
    areaId: formData.get("areaId"),
    auditorId: formData.get("auditorId"),
    frequency: formData.get("frequency"),
    dayOfWeek: formData.get("dayOfWeek") || undefined,
    dayOfMonth: formData.get("dayOfMonth") || undefined,
    startDate: formData.get("startDate"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const template = await prisma.checklistTemplate.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
  if (!template) return { error: "Belum ada template checklist aktif" };

  const startDate = parseDateOnly(parsed.data.startDate);
  const firstDate = firstOccurrence(parsed.data);
  const schedule = await prisma.auditSchedule.create({
    data: {
      areaId: parsed.data.areaId,
      auditorId: parsed.data.auditorId,
      templateId: template.id,
      frequency: parsed.data.frequency,
      dayOfWeek: parsed.data.frequency === "WEEKLY" ? parsed.data.dayOfWeek : null,
      dayOfMonth:
        parsed.data.frequency === "MONTHLY" ? parsed.data.dayOfMonth : null,
      startDate,
    },
  });

  // Buat audit pertama langsung agar auditor melihat tugasnya
  const firstAudit = await prisma.audit.create({
    data: {
      scheduleId: schedule.id,
      areaId: schedule.areaId,
      templateId: schedule.templateId,
      auditorId: schedule.auditorId,
      status: "SCHEDULED",
      scheduledDate: firstDate,
    },
  });
  await prisma.notification.create({
    data: {
      userId: schedule.auditorId,
      type: "AUDIT_DUE",
      title: "Kamu dijadwalkan audit 5S",
      body: `Mulai ${firstDate.toISOString().slice(0, 10)}`,
      auditId: firstAudit.id,
    },
  });

  revalidatePath("/admin/jadwal-audit");
  return { ok: true };
}

export async function toggleSchedule(formData: FormData) {
  await requireUser(["ADMIN"]);
  const id = String(formData.get("id") || "");
  const s = await prisma.auditSchedule.findUnique({ where: { id } });
  if (!s) return;
  await prisma.auditSchedule.update({
    where: { id },
    data: { isActive: !s.isActive },
  });
  revalidatePath("/admin/jadwal-audit");
}
