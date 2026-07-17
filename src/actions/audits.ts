"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { savePhoto } from "@/lib/upload";
import { nextFindingNumber } from "@/lib/numbering";
import { notify, departmentSupervisors } from "@/lib/workflow";
import type { ActionState } from "@/actions/auth";

export type AuditFindingState = ActionState & { findingNumber?: string };

// ------------------------------------------------------------
// Mulai audit ad-hoc
// ------------------------------------------------------------
const adhocSchema = z.object({
  areaId: z.string().min(1, "Pilih area yang diaudit"),
});

export async function startAdhocAudit(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = adhocSchema.safeParse({ areaId: formData.get("areaId") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const template = await prisma.checklistTemplate.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
  if (!template) {
    return { error: "Belum ada template checklist aktif. Hubungi admin." };
  }

  const audit = await prisma.audit.create({
    data: {
      areaId: parsed.data.areaId,
      templateId: template.id,
      auditorId: user.id,
      status: "IN_PROGRESS",
      scheduledDate: new Date(),
      conductedAt: new Date(),
    },
  });
  redirect(`/audit/${audit.id}`);
}

/** Mulai kerjakan audit terjadwal. */
export async function startAudit(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("auditId") || "");
  const audit = await prisma.audit.findUnique({ where: { id } });
  if (!audit || audit.status !== "SCHEDULED") return;
  if (audit.auditorId !== user.id && user.role !== "ADMIN") return;
  await prisma.audit.update({
    where: { id },
    data: { status: "IN_PROGRESS", conductedAt: new Date() },
  });
  redirect(`/audit/${id}`);
}

// ------------------------------------------------------------
// Autosave skor per kriteria
// ------------------------------------------------------------
const scoreSchema = z.object({
  auditId: z.string().min(1),
  criterionId: z.string().min(1),
  score: z.coerce.number().int().min(0).max(4),
  note: z.string().trim().max(300).optional(),
});

export async function saveScore(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = scoreSchema.safeParse({
    auditId: formData.get("auditId"),
    criterionId: formData.get("criterionId"),
    score: formData.get("score"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const audit = await prisma.audit.findUnique({
    where: { id: parsed.data.auditId },
  });
  if (!audit || audit.status !== "IN_PROGRESS") {
    return { error: "Audit tidak aktif" };
  }
  if (audit.auditorId !== user.id && user.role !== "ADMIN") {
    return { error: "Kamu bukan auditor audit ini" };
  }

  await prisma.auditScore.upsert({
    where: {
      auditId_criterionId: {
        auditId: parsed.data.auditId,
        criterionId: parsed.data.criterionId,
      },
    },
    update: { score: parsed.data.score, note: parsed.data.note },
    create: {
      auditId: parsed.data.auditId,
      criterionId: parsed.data.criterionId,
      score: parsed.data.score,
      note: parsed.data.note,
    },
  });
  return { ok: true };
}

// ------------------------------------------------------------
// Buat temuan dari kriteria skor rendah (dalam audit berjalan)
// ------------------------------------------------------------
const auditFindingSchema = z.object({
  auditId: z.string().min(1),
  criterionId: z.string().min(1),
  description: z
    .string()
    .trim()
    .min(10, "Jelaskan temuan minimal 10 karakter")
    .max(1000),
});

export async function createAuditFinding(
  _prev: AuditFindingState,
  formData: FormData,
): Promise<AuditFindingState> {
  const user = await requireUser();
  const parsed = auditFindingSchema.safeParse({
    auditId: formData.get("auditId"),
    criterionId: formData.get("criterionId"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const audit = await prisma.audit.findUnique({
    where: { id: parsed.data.auditId },
    include: { area: true },
  });
  if (!audit || audit.status !== "IN_PROGRESS") {
    return { error: "Audit tidak aktif" };
  }
  if (audit.auditorId !== user.id && user.role !== "ADMIN") {
    return { error: "Kamu bukan auditor audit ini" };
  }
  const criterion = await prisma.checklistCriterion.findUnique({
    where: { id: parsed.data.criterionId },
  });
  if (!criterion) return { error: "Kriteria tidak ditemukan" };

  const photos = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
  let paths: string[] = [];
  try {
    paths = await Promise.all(photos.slice(0, 4).map((p) => savePhoto(p)));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan foto" };
  }

  const finding = await prisma.$transaction(async (tx) => {
    const number = await nextFindingNumber(tx, "AUDIT_5S");
    return tx.finding.create({
      data: {
        number,
        source: "AUDIT_5S",
        auditId: audit.id,
        criterionId: criterion.id,
        pillar: criterion.pillar,
        description: parsed.data.description,
        areaId: audit.areaId,
        reporterId: user.id,
        photos: {
          create: paths.map((filePath) => ({
            type: "BEFORE" as const,
            filePath,
            uploadedById: user.id,
          })),
        },
        statusHistory: {
          create: {
            toStatus: "OPEN",
            actorId: user.id,
            note: "Temuan dari audit 5S",
          },
        },
      },
    });
  });

  revalidatePath(`/audit/${audit.id}`);
  return { ok: true, findingNumber: finding.number };
}

// ------------------------------------------------------------
// Submit audit → hitung skor total, notifikasi
// ------------------------------------------------------------
export async function submitAudit(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const id = String(formData.get("auditId") || "");
  const notes = String(formData.get("notes") || "").slice(0, 1000);

  const audit = await prisma.audit.findUnique({
    where: { id },
    include: {
      area: true,
      scores: true,
      template: { include: { criteria: { where: { isActive: true } } } },
    },
  });
  if (!audit || audit.status !== "IN_PROGRESS") {
    return { error: "Audit tidak aktif" };
  }
  if (audit.auditorId !== user.id && user.role !== "ADMIN") {
    return { error: "Kamu bukan auditor audit ini" };
  }

  const totalCriteria = audit.template.criteria.length;
  if (audit.scores.length < totalCriteria) {
    return {
      error: `Masih ada ${totalCriteria - audit.scores.length} kriteria yang belum dinilai`,
    };
  }

  const totalScore =
    (audit.scores.reduce((s, x) => s + x.score, 0) / (totalCriteria * 4)) * 100;

  await prisma.audit.update({
    where: { id },
    data: {
      status: "SUBMITTED",
      submittedAt: new Date(),
      totalScore: Math.round(totalScore * 10) / 10,
      notes: notes || null,
    },
  });

  const supervisorIds = await departmentSupervisors(audit.area.departmentId);
  await notify(
    supervisorIds,
    "AUDIT_DUE",
    `Audit 5S ${audit.area.name} selesai — skor ${totalScore.toFixed(0)}%`,
    { auditId: audit.id, skip: user.id },
  );

  revalidatePath("/audit");
  redirect(`/audit/${id}/hasil`);
}
