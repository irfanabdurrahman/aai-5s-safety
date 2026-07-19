"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { safeReturnUrl } from "@/lib/safe-return";
import { passwordSchema } from "@/lib/password";
import {
  consumeLoginAttempt,
  resetLoginAttempts,
} from "@/lib/login-throttle";
import { clientIpFromHeaders } from "@/lib/login-throttle-policy";
import { headers } from "next/headers";
import {
  createSessionCookie,
  destroySessionCookie,
  requireUser,
} from "@/lib/auth";

export type ActionState = { error?: string; ok?: boolean };

const loginSchema = z.object({
  npk: z.string().trim().min(1, "NPK wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
});

export async function login(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    npk: formData.get("npk"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const headerStore = await headers();
  const ip = clientIpFromHeaders(headerStore);
  if (!(await consumeLoginAttempt(ip, parsed.data.npk))) {
    return { error: "NPK atau password salah. Coba lagi nanti." };
  }

  const user = await prisma.user.findUnique({
    where: { npk: parsed.data.npk },
  });
  if (!user || !user.isActive) {
    return { error: "NPK atau password salah" };
  }
  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    return { error: "NPK atau password salah" };
  }

  await createSessionCookie({
    sub: user.id,
    npk: user.npk,
    name: user.name,
    role: user.role,
    mcp: user.mustChangePassword,
    sv: user.sessionVersion,
  });

  await resetLoginAttempts(parsed.data.npk);
  // Wajib ganti password sementara sebelum ke mana-mana
  if (user.mustChangePassword) redirect("/profil");
  redirect(safeReturnUrl(formData.get("return")));
}

export async function logout() {
  await destroySessionCookie();
  redirect("/login");
}

const changePasswordSchema = z
  .object({
    current: z.string().min(1, "Password lama wajib diisi"),
    next: passwordSchema,
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, {
    message: "Konfirmasi password tidak sama",
    path: ["confirm"],
  });

export async function changePassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser(undefined, true);
  const parsed = changePasswordSchema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const valid = await bcrypt.compare(parsed.data.current, user.passwordHash);
  if (!valid) return { error: "Password lama salah" };

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(parsed.data.next, 12),
      mustChangePassword: false,
      sessionVersion: { increment: 1 },
    },
  });
  // Terbitkan ulang sesi tanpa flag wajib-ganti-password
  await createSessionCookie({
    sub: user.id,
    npk: user.npk,
    name: user.name,
    role: user.role,
    mcp: false,
    sv: updated.sessionVersion,
  });
  return { ok: true };
}
