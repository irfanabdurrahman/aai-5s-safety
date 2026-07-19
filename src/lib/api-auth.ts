import "server-only";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import type { Role } from "@/generated/prisma/enums";
import { isSessionUserValid } from "@/lib/session-policy";
import { KIOSK_COOKIE, verifyKioskSession } from "@/lib/kiosk-session";

/** Auth untuk API route: verifikasi JWT LALU cek user masih aktif di DB
 *  (role diambil dari DB, bukan dari token — tahan token stale). */
export async function apiUser(request: NextRequest, roles?: Role[]) {
  const session = await verifySession(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, role: true, isActive: true, mustChangePassword: true, sessionVersion: true, departmentId: true },
  });
  if (!user || !isSessionUserValid(session, user)) return null;
  if (roles && !roles.includes(user.role)) return null;
  return user;
}

/** Akses kiosk setelah one-time token exchange menjadi cookie scoped. */
export function isTvAuthorized(request: NextRequest): Promise<boolean> {
  return verifyKioskSession(request.cookies.get(KIOSK_COOKIE)?.value);
}
