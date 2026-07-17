import "server-only";
import { prisma } from "@/lib/prisma";
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

const RULES: TransitionRule[] = [
  {
    // Assign PIC (atau PIC area ambil tugas sendiri)
    from: "OPEN",
    to: "IN_PROGRESS",
    allowed: (actor, f) =>
      canAssignPic(actor.role) ||
      (actor.role === "PIC_AREA" && f.area.picUserId === actor.id),
  },
  {
    // Tutup langsung: temuan tidak valid / duplikat
    from: "OPEN",
    to: "CLOSED",
    allowed: (actor) => isAdminOrSpv(actor.role),
  },
  {
    // PIC selesai perbaikan → minta verifikasi
    from: "IN_PROGRESS",
    to: "PENDING_VERIFICATION",
    allowed: (actor, f) => actor.id === f.picId || actor.role === "ADMIN",
  },
  {
    // Verifikasi diterima → closed (bukan oleh PIC sendiri)
    from: "PENDING_VERIFICATION",
    to: "CLOSED",
    allowed: (actor, f) => canVerify(actor.role) && actor.id !== f.picId,
  },
  {
    // Verifikasi ditolak → kembali dikerjakan
    from: "PENDING_VERIFICATION",
    to: "IN_PROGRESS",
    allowed: (actor) => canVerify(actor.role),
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

/** Supervisor + admin dari departemen sebuah area (untuk notifikasi). */
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
