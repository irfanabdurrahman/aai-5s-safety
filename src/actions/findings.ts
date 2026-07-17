"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { savePhoto } from "@/lib/upload";
import { nextFindingNumber } from "@/lib/numbering";
import {
  canTransition,
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

  const photos = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (photos.length === 0) {
    return { error: "Foto kondisi temuan wajib dilampirkan" };
  }
  if (photos.length > 4) return { error: "Maksimal 4 foto" };

  const area = await prisma.area.findUnique({
    where: { id: parsed.data.areaId },
    include: { department: true },
  });
  if (!area || !area.isActive) return { error: "Area tidak ditemukan" };

  let paths: string[];
  try {
    paths = await Promise.all(photos.map((p) => savePhoto(p)));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan foto" };
  }

  const finding = await prisma.$transaction(async (tx) => {
    const number = await nextFindingNumber(tx, "SAFETY_REPORT");
    const f = await tx.finding.create({
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
          create: paths.map((filePath) => ({
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
    return f;
  });

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

  const finding = await findingForWorkflow(parsed.data.findingId);
  if (!finding) return { error: "Temuan tidak ditemukan" };
  if (!canTransition(user, finding, "IN_PROGRESS")) {
    return { error: "Kamu tidak berwenang menugaskan temuan ini" };
  }
  // PIC area hanya boleh menugaskan dirinya sendiri
  if (user.role === "PIC_AREA" && parsed.data.picId !== user.id) {
    return { error: "PIC area hanya bisa mengambil tugas untuk diri sendiri" };
  }

  const pic = await prisma.user.findUnique({
    where: { id: parsed.data.picId },
  });
  if (!pic || !pic.isActive) return { error: "PIC tidak ditemukan" };

  await prisma.$transaction([
    prisma.finding.update({
      where: { id: finding.id },
      data: {
        status: "IN_PROGRESS",
        picId: pic.id,
        dueDate: new Date(parsed.data.dueDate + "T00:00:00+07:00"),
      },
    }),
    prisma.findingStatusHistory.create({
      data: {
        findingId: finding.id,
        fromStatus: "OPEN",
        toStatus: "IN_PROGRESS",
        actorId: user.id,
        note: `PIC: ${pic.name}, target ${parsed.data.dueDate}`,
      },
    }),
  ]);

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
  if (!canTransition(user, finding, "PENDING_VERIFICATION")) {
    return { error: "Hanya PIC yang ditugaskan yang bisa menyelesaikan perbaikan" };
  }

  const photos = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (photos.length === 0) {
    return { error: "Foto kondisi sesudah perbaikan wajib dilampirkan" };
  }
  if (photos.length > 4) return { error: "Maksimal 4 foto" };

  let paths: string[];
  try {
    paths = await Promise.all(photos.map((p) => savePhoto(p)));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan foto" };
  }

  await prisma.$transaction([
    prisma.finding.update({
      where: { id: finding.id },
      data: {
        status: "PENDING_VERIFICATION",
        actionNote: parsed.data.actionNote,
        photos: {
          create: paths.map((filePath) => ({
            type: "AFTER" as const,
            filePath,
            uploadedById: user.id,
          })),
        },
      },
    }),
    prisma.findingStatusHistory.create({
      data: {
        findingId: finding.id,
        fromStatus: "IN_PROGRESS",
        toStatus: "PENDING_VERIFICATION",
        actorId: user.id,
        note: parsed.data.actionNote.slice(0, 200),
      },
    }),
  ]);

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
  if (!canTransition(user, finding, "CLOSED")) {
    return {
      error:
        finding.picId === user.id
          ? "Verifikator tidak boleh orang yang sama dengan PIC"
          : "Kamu tidak berwenang memverifikasi temuan ini",
    };
  }

  await prisma.$transaction([
    prisma.finding.update({
      where: { id: finding.id },
      data: { status: "CLOSED", verifiedById: user.id, closedAt: new Date() },
    }),
    prisma.findingStatusHistory.create({
      data: {
        findingId: finding.id,
        fromStatus: finding.status,
        toStatus: "CLOSED",
        actorId: user.id,
        note: parsed.data.note || "Verifikasi diterima",
      },
    }),
  ]);

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
  if (finding.status !== "PENDING_VERIFICATION" || !canTransition(user, finding, "IN_PROGRESS")) {
    return { error: "Kamu tidak berwenang menolak verifikasi ini" };
  }

  await prisma.$transaction([
    prisma.finding.update({
      where: { id: finding.id },
      data: { status: "IN_PROGRESS", rejectionNote: parsed.data.note },
    }),
    prisma.findingStatusHistory.create({
      data: {
        findingId: finding.id,
        fromStatus: "PENDING_VERIFICATION",
        toStatus: "IN_PROGRESS",
        actorId: user.id,
        note: `Ditolak: ${parsed.data.note}`,
      },
    }),
  ]);

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
  if (finding.status !== "OPEN" || !canTransition(user, finding, "CLOSED")) {
    return { error: "Kamu tidak berwenang menutup temuan ini" };
  }

  await prisma.$transaction([
    prisma.finding.update({
      where: { id: finding.id },
      data: { status: "CLOSED", verifiedById: user.id, closedAt: new Date() },
    }),
    prisma.findingStatusHistory.create({
      data: {
        findingId: finding.id,
        fromStatus: "OPEN",
        toStatus: "CLOSED",
        actorId: user.id,
        note: `Ditutup (tidak valid): ${parsed.data.note}`,
      },
    }),
  ]);

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
