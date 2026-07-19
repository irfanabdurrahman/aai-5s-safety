import "server-only";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import type { Role } from "@/generated/prisma/enums";

/** Auth untuk API route: verifikasi JWT LALU cek user masih aktif di DB
 *  (role diambil dari DB, bukan dari token — tahan token stale). */
export async function apiUser(request: NextRequest, roles?: Role[]) {
  const session = await verifySession(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, role: true, isActive: true, departmentId: true },
  });
  if (!user || !user.isActive) return null;
  if (roles && !roles.includes(user.role)) return null;
  return user;
}

/** Satu-satunya definisi akses token TV kiosk. */
export function isTvAuthorized(token: string | null | undefined): boolean {
  return !!process.env.TV_TOKEN && token === process.env.TV_TOKEN;
}
