import type { Role } from "@/generated/prisma/enums";

export const ROLE_LABELS: Record<Role, string> = {
  KARYAWAN: "Karyawan",
  PIC_AREA: "PIC Area",
  SUPERVISOR: "Supervisor",
  ADMIN: "Admin EHS",
};

export const canAssignPic = (role: Role) =>
  role === "SUPERVISOR" || role === "ADMIN";

export const canVerify = (role: Role) =>
  role === "SUPERVISOR" || role === "ADMIN";

export const canManageMasterData = (role: Role) => role === "ADMIN";

export const canViewDashboard = (role: Role) =>
  role === "SUPERVISOR" || role === "ADMIN";

/** Prefix route → role yang boleh akses (dipakai proxy + nav). */
export const ROUTE_ROLES: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/dashboard", roles: ["SUPERVISOR", "ADMIN"] },
  { prefix: "/verifikasi", roles: ["SUPERVISOR", "ADMIN"] },
];
