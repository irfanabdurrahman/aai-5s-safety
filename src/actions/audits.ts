"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { savePhoto, removePhotos } from "@/lib/upload";
import { saveBatchAtomically } from "@/lib/upload-batch";
import { nextFindingNumber } from "@/lib/numbering";
import { notify, departmentSupervisors } from "@/lib/workflow";
import type { ActionState } from "@/actions/auth";
import { wibToday } from "@/lib/dates";

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
  // Audit hanya oleh PIC area ke atas — bukan karyawan umum
  const user = await requireUser(["PIC_AREA", "SUPERVISOR", "ADMIN"]);
  const parsed = adhocSchema.safeParse({ areaId: formData.get("areaId") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const area = await prisma.area.findUnique({
    where: { id: parsed.data.areaId },
  });
  if (!area || !area.isActive) return { error: "Area tidak ditemukan" };

  const template = await prisma.checklistTemplate.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
  if (!template) {
    return { error: "Belum ada template checklist aktif. Hubungi admin." };
  }

  const audit = await prisma.audit.create({
    data: {
      areaId: area.id,
      templateId: template.id,
      auditorId: user.id,
      status: "IN_PROGRESS",
      scheduledDate: wibToday(),
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

  const error = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${parsed.data.auditId}))`;
    const audit = await tx.audit.findUnique({
      where: { id: parsed.data.auditId },
    });
    if (!audit || audit.status !== "IN_PROGRESS") return "Audit tidak aktif";
    if (audit.auditorId !== user.id && user.role !== "ADMIN") {
      return "Kamu bukan auditor audit ini";
    }

    const criterion = await tx.checklistCriterion.findUnique({
      where: { id: parsed.data.criterionId },
    });
    if (
      !criterion ||
      !criterion.isActive ||
      criterion.templateId !== audit.templateId
    ) {
      return "Kriteria tidak valid untuk audit ini";
    }

    await tx.auditScore.upsert({
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
    return null;
  });
  return error ? { error } : { ok: true };
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
  if (!criterion || !criterion.isActive || criterion.templateId !== audit.templateId) {
    return { error: "Kriteria tidak valid untuk audit ini" };
  }

  const photos = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
  let paths: string[] = [];
  try {
    paths = await saveBatchAtomically(
      photos.slice(0, 4),
      savePhoto,
      removePhotos,
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan foto" };
  }

  let finding;
  try {
    finding = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${audit.id}))`;
      const currentAudit = await tx.audit.findUnique({
        where: { id: audit.id },
        include: { area: true },
      });
      if (!currentAudit || currentAudit.status !== "IN_PROGRESS") {
        throw new Error("AUDIT_NOT_ACTIVE");
      }
      if (currentAudit.auditorId !== user.id && user.role !== "ADMIN") {
        throw new Error("AUDIT_FORBIDDEN");
      }
      const currentCriterion = await tx.checklistCriterion.findUnique({
        where: { id: criterion.id },
      });
      if (
        !currentCriterion ||
        !currentCriterion.isActive ||
        currentCriterion.templateId !== currentAudit.templateId
      ) {
        throw new Error("CRITERION_INVALID");
      }
      const number = await nextFindingNumber(tx, "AUDIT_5S");
      return tx.finding.create({
      data: {
        number,
        source: "AUDIT_5S",
        auditId: currentAudit.id,
        criterionId: currentCriterion.id,
        pillar: currentCriterion.pillar,
        description: parsed.data.description,
        areaId: currentAudit.areaId,
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
  } catch {
    await removePhotos(paths);
    return { error: "Gagal membuat temuan audit. Silakan coba lagi." };
  }

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

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
    const audit = await tx.audit.findUnique({
      where: { id },
      include: {
        area: true,
        scores: true,
        template: { include: { criteria: { where: { isActive: true } } } },
      },
    });
    if (!audit || audit.status !== "IN_PROGRESS") {
      return { error: "Audit tidak aktif" } as const;
    }
    if (audit.auditorId !== user.id && user.role !== "ADMIN") {
      return { error: "Kamu bukan auditor audit ini" } as const;
    }

    const activeIds = new Set(audit.template.criteria.map((c) => c.id));
    const validScores = audit.scores.filter((s) => activeIds.has(s.criterionId));
    const totalCriteria = activeIds.size;
    if (!totalCriteria || validScores.length < totalCriteria) {
      return {
        error: `Masih ada ${Math.max(0, totalCriteria - validScores.length)} kriteria yang belum dinilai`,
      } as const;
    }

    const totalScore =
      (validScores.reduce((sum, score) => sum + score.score, 0) /
        (totalCriteria * 4)) *
      100;
    const roundedScore = Math.round(totalScore * 10) / 10;
    const updated = await tx.audit.updateMany({
      where: { id, status: "IN_PROGRESS" },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        totalScore: roundedScore,
        notes: notes || null,
      },
    });
    if (updated.count !== 1) return { error: "Audit telah berubah" } as const;
    return {
      auditId: audit.id,
      areaName: audit.area.name,
      departmentId: audit.area.departmentId,
      totalScore: roundedScore,
    } as const;
  });

  if ("error" in result) return { error: result.error };

  const supervisorIds = await departmentSupervisors(result.departmentId);
  await notify(
    supervisorIds,
    "AUDIT_DUE",
    `Audit 5S ${result.areaName} selesai — skor ${result.totalScore.toFixed(0)}%`,
    { auditId: result.auditId, skip: user.id },
  );

  revalidatePath("/audit");
  redirect(`/audit/${id}/hasil`);
}
