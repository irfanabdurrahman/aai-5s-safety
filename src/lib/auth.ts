import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
  verifySession,
  type SessionPayload,
} from "@/lib/session";
import type { Role } from "@/generated/prisma/enums";
import { isSessionUserValid } from "@/lib/session-policy";

export async function createSessionCookie(payload: SessionPayload) {
  const token = await signSession(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // INSECURE_COOKIES=1 hanya untuk QA internal lewat HTTP polos
    secure:
      process.env.NODE_ENV === "production" &&
      process.env.INSECURE_COOKIES !== "1",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function destroySessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
});

/** User lengkap dari DB (di-cache per request). Null jika sesi invalid/nonaktif. */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: { department: true, picAreas: { where: { isActive: true } } },
  });
  if (!user || !isSessionUserValid(session, user, true)) return null;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Untuk server component/action: redirect ke login jika belum masuk,
 *  atau ke beranda jika role tidak diizinkan. */
export async function requireUser(roles?: Role[], allowPasswordChange = false): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !allowPasswordChange) redirect("/profil");
  if (roles && !roles.includes(user.role)) redirect("/");
  return user;
}
