"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
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
  });

  const dest = String(formData.get("return") || "/");
  redirect(dest.startsWith("/") && !dest.startsWith("//") ? dest : "/");
}

export async function logout() {
  await destroySessionCookie();
  redirect("/login");
}

const changePasswordSchema = z
  .object({
    current: z.string().min(1, "Password lama wajib diisi"),
    next: z.string().min(6, "Password baru minimal 6 karakter"),
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
  const user = await requireUser();
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

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(parsed.data.next, 10),
      mustChangePassword: false,
    },
  });
  return { ok: true };
}
