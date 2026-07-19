"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { savePhoto, removePhotos } from "@/lib/upload";
import { saveBatchAtomically } from "@/lib/upload-batch";
import { nextFindingNumber } from "@/lib/numbering";
import { parseDateOnly, toDateStr, wibToday } from "@/lib/dates";
import {
  transitionFinding,
  notify,
  departmentSupervisors,
  type FindingForWorkflow,
} from "@/lib/workflow";
import {
  safetyReportSchema,
  assignSchema,
  completeFixSchema,
  verdictSchema,
  rejectSchema,
  commentSchema,
} from "@/lib/validations/finding";
import type { ActionState } from "@/actions/auth";

async function findingForWorkflow(
  id: string,
): Promise<FindingForWorkflow | null> {
  return prisma.finding.findUnique({
    where: { id },
    select: {
      id: true,
      number: true,
      status: true,
      areaId: true,
      reporterId: true,
      picId: true,
      area: {
        select: { picUserId: true, department: { select: { id: true } } },
      },
    },
  });
}

function revalidateFinding(id: string) {
  revalidatePath("/temuan");
  revalidatePath(`/temuan/${id}`);
  revalidatePath("/tugas-saya");
  revalidatePath("/verifikasi");
  revalidatePath("/");
}

async function savePhotos(
  formData: FormData,
  required: boolean,
): Promise<{ paths?: string[]; error?: string }> {
  const photos = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (photos.length === 0) {
    return required
      ? { error: "Foto wajib dilampirkan" }
      : { paths: [] };
  }
  if (photos.length > 4) return { error: "Maksimal 4 foto" };
  try {
    return {
      paths: await saveBatchAtomically(photos, savePhoto, removePhotos),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan foto" };
  }
}

// ------------------------------------------------------------
// Lapor temuan safety (ad-hoc)
// ------------------------------------------------------------
export async function createSafetyReport(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = safetyReportSchema.safeParse({
    safetyCategory: formData.get("safetyCategory"),
    riskLevel: formData.get("riskLevel"),
    areaId: formData.get("areaId"),
    lineId: formData.get("lineId") || undefined,
    locationDetail: formData.get("locationDetail") || undefined,
    description: formData.get("description"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const area = await prisma.area.findUnique({
    where: { id: parsed.data.areaId },
    include: { department: true },
  });
  if (!area || !area.isActive) return { error: "Area tidak ditemukan" };

  // Line (opsional) harus milik area yang dipilih & aktif
  if (parsed.data.lineId) {
    const line = await prisma.line.findUnique({
      where: { id: parsed.data.lineId },
    });
    if (!line || !line.isActive || line.areaId !== area.id) {
      return { error: "Line tidak sesuai dengan area yang dipilih" };
    }
  }

  const saved = await savePhotos(formData, true);
  if (saved.error) return { error: "Foto kondisi temuan wajib dilampirkan" };

  let finding;
  try {
    finding = await prisma.$transaction(async (tx) => {
      const number = await nextFindingNumber(tx, "SAFETY_REPORT");
      return tx.finding.create({
      data: {
        number,
        source: "SAFETY_REPORT",
        safetyCategory: parsed.data.safetyCategory,
        riskLevel: parsed.data.riskLevel,
        description: parsed.data.description,
        locationDetail: parsed.data.locationDetail,
        areaId: parsed.data.areaId,
        lineId: parsed.data.lineId || null,
        reporterId: user.id,
        photos: {
          create: saved.paths!.map((filePath) => ({
            type: "BEFORE" as const,
            filePath,
            uploadedById: user.id,
          })),
        },
        statusHistory: {
          create: { toStatus: "OPEN", actorId: user.id, note: "Temuan dilaporkan" },
        },
      },
      });
    });
  } catch {
    await removePhotos(saved.paths ?? []);
    return { error: "Gagal menyimpan temuan. Silakan coba lagi." };
  }

  const supervisorIds = await departmentSupervisors(area.departmentId);
  await notify(
    [area.picUserId, ...supervisorIds],
    "FINDING_ASSIGNED",
    `Temuan baru ${finding.number} di ${area.name}`,
    {
      body: parsed.data.description.slice(0, 120),
      findingId: finding.id,
      skip: user.id,
    },
  );

  revalidateFinding(finding.id);
  redirect(`/temuan/${finding.id}?baru=1`);
}

// ------------------------------------------------------------
// Assign PIC + due date (Supervisor/Admin), atau PIC ambil tugas
// ------------------------------------------------------------
export async function assignPic(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = assignSchema.safeParse({
    findingId: formData.get("findingId"),
    picId: formData.get("picId"),
    dueDate: formData.get("dueDate"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const dueDate = parseDateOnly(parsed.data.dueDate);
  if (dueDate < wibToday()) {
    return { error: "Target selesai tidak boleh tanggal yang sudah lewat" };
  }

  const finding = await findingForWorkflow(parsed.data.findingId);
  if (!finding) return { error: "Temuan tidak ditemukan" };
  // PIC area hanya boleh menugaskan dirinya sendiri
  if (user.role === "PIC_AREA" && parsed.data.picId !== user.id) {
    return { error: "PIC area hanya bisa mengambil tugas untuk diri sendiri" };
  }

  const pic = await prisma.user.findUnique({
    where: { id: parsed.data.picId },
  });
  if (!pic || !pic.isActive || pic.role !== "PIC_AREA" || pic.departmentId !== finding.area.department.id) {
    return { error: "PIC harus PIC Area aktif dari departemen temuan" };
  }

  const ok = await transitionFinding(user, finding, "IN_PROGRESS", {
    note: `PIC: ${pic.name}, target ${toDateStr(dueDate)}`,
    data: { picId: pic.id, dueDate },
  });
  if (!ok) return { error: "Kamu tidak berwenang menugaskan temuan ini" };

  await notify(
    [pic.id, finding.reporterId],
    "FINDING_ASSIGNED",
    `${finding.number} ditugaskan ke ${pic.name}`,
    { findingId: finding.id, skip: user.id },
  );

  revalidateFinding(finding.id);
  return { ok: true };
}

// ------------------------------------------------------------
// PIC selesai perbaikan → minta verifikasi (wajib foto after)
// ------------------------------------------------------------
export async function completeFix(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = completeFixSchema.safeParse({
    findingId: formData.get("findingId"),
    actionNote: formData.get("actionNote"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const finding = await findingForWorkflow(parsed.data.findingId);
  if (!finding) return { error: "Temuan tidak ditemukan" };
  // Authorization and workflow state are checked before reading/writing uploads.
  if (!(user.id === finding.picId || user.role === "ADMIN") || finding.status !== "IN_PROGRESS") {
    return { error: "Hanya PIC yang ditugaskan yang bisa menyelesaikan perbaikan" };
  }

  const saved = await savePhotos(formData, true);
  if (saved.error) {
    return { error: "Foto kondisi sesudah perbaikan wajib dilampirkan" };
  }

  try {
    const transitioned = await prisma.$transaction(async (tx) => {
      const updated = await tx.finding.updateMany({
        where: { id: finding.id, status: "IN_PROGRESS", picId: finding.picId },
        data: {
          status: "PENDING_VERIFICATION",
          actionNote: parsed.data.actionNote,
        },
      });
      if (updated.count !== 1) return false;

      await tx.findingStatusHistory.create({
        data: {
          findingId: finding.id,
          fromStatus: "IN_PROGRESS",
          toStatus: "PENDING_VERIFICATION",
          actorId: user.id,
          note: parsed.data.actionNote.slice(0, 200),
        },
      });
      await tx.findingPhoto.createMany({
        data: saved.paths!.map((filePath) => ({
          findingId: finding.id,
          type: "AFTER" as const,
          filePath,
          uploadedById: user.id,
        })),
      });
      return true;
    });

    if (!transitioned) {
      await removePhotos(saved.paths ?? []);
      return { error: "Status temuan telah berubah. Muat ulang halaman." };
    }
  } catch {
    await removePhotos(saved.paths ?? []);
    return { error: "Gagal menyimpan perbaikan. Silakan coba lagi." };
  }

  const area = await prisma.area.findUnique({ where: { id: finding.areaId } });
  const supervisorIds = area
    ? await departmentSupervisors(area.departmentId)
    : [];
  await notify(
    supervisorIds,
    "FINDING_SUBMITTED_FOR_VERIFICATION",
    `${finding.number} menunggu verifikasi`,
    { findingId: finding.id, skip: user.id },
  );

  revalidateFinding(finding.id);
  return { ok: true };
}

// ------------------------------------------------------------
// Verifikasi: terima & tutup
// ------------------------------------------------------------
export async function verifyClose(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = verdictSchema.safeParse({
    findingId: formData.get("findingId"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const finding = await findingForWorkflow(parsed.data.findingId);
  if (!finding) return { error: "Temuan tidak ditemukan" };

  const ok = await transitionFinding(user, finding, "CLOSED", {
    note: parsed.data.note || "Verifikasi diterima",
    data: { verifiedById: user.id, closedAt: new Date() },
  });
  if (!ok) {
    return {
      error:
        finding.picId === user.id
          ? "Verifikator tidak boleh orang yang sama dengan PIC"
          : "Kamu tidak berwenang memverifikasi temuan ini",
    };
  }

  await notify(
    [finding.reporterId, finding.picId],
    "FINDING_VERIFIED_CLOSED",
    `${finding.number} selesai & terverifikasi ✔`,
    { findingId: finding.id, skip: user.id },
  );

  revalidateFinding(finding.id);
  return { ok: true };
}

// ------------------------------------------------------------
// Verifikasi: tolak → kembali dikerjakan
// ------------------------------------------------------------
export async function rejectVerification(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = rejectSchema.safeParse({
    findingId: formData.get("findingId"),
    note: formData.get("note"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const finding = await findingForWorkflow(parsed.data.findingId);
  if (!finding) return { error: "Temuan tidak ditemukan" };
  if (finding.status !== "PENDING_VERIFICATION") {
    return { error: "Temuan tidak sedang menunggu verifikasi" };
  }

  const ok = await transitionFinding(user, finding, "IN_PROGRESS", {
    note: `Ditolak: ${parsed.data.note}`,
    data: { rejectionNote: parsed.data.note },
  });
  if (!ok) return { error: "Kamu tidak berwenang menolak verifikasi ini" };

  await notify(
    [finding.picId],
    "FINDING_REJECTED",
    `Verifikasi ${finding.number} ditolak — perlu perbaikan ulang`,
    { body: parsed.data.note, findingId: finding.id, skip: user.id },
  );

  revalidateFinding(finding.id);
  return { ok: true };
}

// ------------------------------------------------------------
// Tutup langsung: temuan tidak valid (Supervisor/Admin)
// ------------------------------------------------------------
export async function invalidateFinding(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = rejectSchema.safeParse({
    findingId: formData.get("findingId"),
    note: formData.get("note"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const finding = await findingForWorkflow(parsed.data.findingId);
  if (!finding) return { error: "Temuan tidak ditemukan" };
  if (finding.status !== "OPEN") {
    return { error: "Hanya temuan berstatus Terbuka yang bisa ditutup tidak valid" };
  }

  const ok = await transitionFinding(user, finding, "CLOSED", {
    note: `Ditutup (tidak valid): ${parsed.data.note}`,
    data: {
      isValid: false,
      verifiedById: user.id,
      closedAt: new Date(),
      rejectionNote: parsed.data.note,
    },
  });
  if (!ok) return { error: "Kamu tidak berwenang menutup temuan ini" };

  await notify(
    [finding.reporterId],
    "FINDING_INVALIDATED",
    `${finding.number} ditutup: ${parsed.data.note.slice(0, 80)}`,
    { findingId: finding.id, skip: user.id },
  );

  revalidateFinding(finding.id);
  return { ok: true };
}

// ------------------------------------------------------------
// Komentar koordinasi
// ------------------------------------------------------------
export async function addComment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = commentSchema.safeParse({
    findingId: formData.get("findingId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const finding = await findingForWorkflow(parsed.data.findingId);
  if (!finding) return { error: "Temuan tidak ditemukan" };

  await prisma.comment.create({
    data: {
      findingId: finding.id,
      userId: user.id,
      body: parsed.data.body,
    },
  });

  await notify(
    [finding.reporterId, finding.picId],
    "NEW_COMMENT",
    `${user.name} berkomentar di ${finding.number}`,
    { body: parsed.data.body.slice(0, 120), findingId: finding.id, skip: user.id },
  );

  revalidatePath(`/temuan/${finding.id}`);
  return { ok: true };
}
