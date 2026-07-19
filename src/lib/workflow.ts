import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type {
  FindingStatus,
  NotificationType,
  Role,
} from "@/generated/prisma/enums";
import type { CurrentUser } from "@/lib/auth";
import { canAssignPic, canVerify } from "@/lib/rbac";

/** Transisi yang diizinkan: from → to → siapa yang boleh. */
type TransitionRule = {
  from: FindingStatus;
  to: FindingStatus;
  allowed: (actor: CurrentUser, finding: FindingForWorkflow) => boolean;
};

export type FindingForWorkflow = {
  id: string;
  number: string;
  status: FindingStatus;
  areaId: string;
  reporterId: string;
  picId: string | null;
  area: { picUserId: string | null; department: { id: string } };
};

const isAdminOrSpv = (role: Role) => role === "SUPERVISOR" || role === "ADMIN";

/** Supervisor hanya berwenang di departemennya sendiri; admin di mana saja. */
function inScope(actor: CurrentUser, f: FindingForWorkflow): boolean {
  if (actor.role === "ADMIN") return true;
  return actor.departmentId === f.area.department.id;
}

const RULES: TransitionRule[] = [
  {
    // Assign PIC (atau PIC area ambil tugas sendiri)
    from: "OPEN",
    to: "IN_PROGRESS",
    allowed: (actor, f) =>
      (canAssignPic(actor.role) && inScope(actor, f)) ||
      (actor.role === "PIC_AREA" && f.area.picUserId === actor.id),
  },
  {
    // Tutup langsung: temuan tidak valid / duplikat
    from: "OPEN",
    to: "CLOSED",
    allowed: (actor, f) => isAdminOrSpv(actor.role) && inScope(actor, f),
  },
  {
    // PIC selesai perbaikan → minta verifikasi
    from: "IN_PROGRESS",
    to: "PENDING_VERIFICATION",
    allowed: (actor, f) => actor.id === f.picId || actor.role === "ADMIN",
  },
  {
    // Verifikasi diterima → closed (bukan PIC sendiri, satu departemen)
    from: "PENDING_VERIFICATION",
    to: "CLOSED",
    allowed: (actor, f) =>
      canVerify(actor.role) && actor.id !== f.picId && inScope(actor, f),
  },
  {
    // Verifikasi ditolak → kembali dikerjakan
    from: "PENDING_VERIFICATION",
    to: "IN_PROGRESS",
    allowed: (actor, f) => canVerify(actor.role) && inScope(actor, f),
  },
];

export function canTransition(
  actor: CurrentUser,
  finding: FindingForWorkflow,
  to: FindingStatus,
): boolean {
  const rule = RULES.find((r) => r.from === finding.status && r.to === to);
  return !!rule && rule.allowed(actor, finding);
}

/** SATU-SATUNYA titik mutasi status temuan.
 *  Compare-and-set pada status lama → aman dari transisi ganda/bersamaan,
 *  lalu tulis riwayat dalam transaksi yang sama.
 *  Return false jika transisi kalah race / tidak berwenang. */
export async function transitionFinding(
  actor: CurrentUser,
  finding: FindingForWorkflow,
  to: FindingStatus,
  opts: {
    note?: string;
    data?: Prisma.FindingUncheckedUpdateManyInput;
  } = {},
): Promise<boolean> {
  if (!canTransition(actor, finding, to)) return false;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.finding.updateMany({
      where: { id: finding.id, status: finding.status }, // CAS: hanya jika status belum berubah
      data: { ...opts.data, status: to },
    });
    if (updated.count === 0) return false; // kalah race — status sudah berubah

    await tx.findingStatusHistory.create({
      data: {
        findingId: finding.id,
        fromStatus: finding.status,
        toStatus: to,
        actorId: actor.id,
        note: opts.note,
      },
    });
    return true;
  });
}

export async function notify(
  userIds: (string | null | undefined)[],
  type: NotificationType,
  title: string,
  opts: { body?: string; findingId?: string; auditId?: string; skip?: string } = {},
) {
  const ids = [...new Set(userIds.filter((x): x is string => !!x))].filter(
    (id) => id !== opts.skip,
  );
  if (!ids.length) return;
  await prisma.notification.createMany({
    data: ids.map((userId) => ({
      userId,
      type,
      title,
      body: opts.body,
      findingId: opts.findingId,
      auditId: opts.auditId,
    })),
  });
}

/** Supervisor departemen + semua admin (untuk notifikasi). */
export async function departmentSupervisors(departmentId: string) {
  const rows = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { role: "SUPERVISOR", departmentId },
        { role: "ADMIN" },
      ],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
