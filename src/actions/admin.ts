"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import type { ActionState } from "@/actions/auth";
import { generateTemporaryPassword } from "@/lib/password";

export type TemporaryPasswordState = ActionState & { temporaryPassword?: string };

// ------------------------------------------------------------
// Pengguna
// ------------------------------------------------------------
const userSchema = z.object({
  npk: z
    .string()
    .trim()
    .min(3, "NPK minimal 3 karakter")
    .max(20)
    .regex(/^[0-9A-Za-z-]+$/, "NPK hanya angka/huruf"),
  name: z.string().trim().min(3, "Nama minimal 3 karakter").max(80),
  role: z.enum(["KARYAWAN", "PIC_AREA", "SUPERVISOR", "ADMIN"]),
  departmentId: z.string().min(1, "Pilih departemen"),
});

export async function createUser(
  _prev: ActionState,
  formData: FormData,
): Promise<TemporaryPasswordState> {
  await requireUser(["ADMIN"]);
  const parsed = userSchema.safeParse({
    npk: formData.get("npk"),
    name: formData.get("name"),
    role: formData.get("role"),
    departmentId: formData.get("departmentId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (await prisma.user.findUnique({ where: { npk: parsed.data.npk } })) {
    return { error: `NPK ${parsed.data.npk} sudah terdaftar` };
  }

  const temporaryPassword = generateTemporaryPassword();
  await prisma.user.create({
    data: {
      ...parsed.data,
      passwordHash: await bcrypt.hash(temporaryPassword, 12),
      mustChangePassword: true,
    },
  });
  revalidatePath("/admin/pengguna");
  return { ok: true, temporaryPassword };
}

export async function updateUser(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireUser(["ADMIN"]);
  const id = String(formData.get("id") || "");
  const parsed = userSchema
    .omit({ npk: true })
    .safeParse({
      name: formData.get("name"),
      role: formData.get("role"),
      departmentId: formData.get("departmentId"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (id === admin.id && parsed.data.role !== "ADMIN") {
    return { error: "Tidak bisa menurunkan role akun sendiri" };
  }
  const existing = await prisma.user.findUnique({
    where: { id },
    select: { role: true, departmentId: true },
  });
  if (!existing) return { error: "Pengguna tidak ditemukan" };
  const securityContextChanged =
    existing.role !== parsed.data.role ||
    existing.departmentId !== parsed.data.departmentId;
  await prisma.user.update({
    where: { id },
    data: {
      ...parsed.data,
      ...(securityContextChanged ? { sessionVersion: { increment: 1 } } : {}),
    },
  });
  revalidatePath("/admin/pengguna");
  return { ok: true };
}

export async function toggleUserActive(formData: FormData) {
  const admin = await requireUser(["ADMIN"]);
  const id = String(formData.get("id") || "");
  if (id === admin.id) return;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || !user.isActive) return;
  await prisma.user.update({
    where: { id },
    data: {
      isActive: false,
      sessionVersion: { increment: 1 },
    },
  });
  revalidatePath("/admin/pengguna");
}

export async function resetPassword(
  _prev: TemporaryPasswordState,
  formData: FormData,
): Promise<TemporaryPasswordState> {
  await requireUser(["ADMIN"]);
  const id = String(formData.get("id") || "");
  const temporaryPassword = generateTemporaryPassword();
  await prisma.user.update({
    where: { id },
    data: {
      isActive: true,
      passwordHash: await bcrypt.hash(temporaryPassword, 12),
      mustChangePassword: true,
      sessionVersion: { increment: 1 },
    },
  });
  revalidatePath("/admin/pengguna");
  return { ok: true, temporaryPassword };
}

// ------------------------------------------------------------
// Departemen / Area / Line
// ------------------------------------------------------------
const deptSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Kode minimal 2 karakter")
    .max(10)
    .transform((s) => s.toUpperCase()),
  name: z.string().trim().min(3, "Nama minimal 3 karakter").max(60),
});

export async function saveDepartment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser(["ADMIN"]);
  const id = String(formData.get("id") || "");
  const parsed = deptSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const existing = await prisma.department.findUnique({
    where: { code: parsed.data.code },
  });
  if (existing && existing.id !== id) {
    return { error: `Kode ${parsed.data.code} sudah dipakai` };
  }

  if (id) {
    await prisma.department.update({ where: { id }, data: parsed.data });
  } else {
    await prisma.department.create({ data: parsed.data });
  }
  revalidatePath("/admin/departemen");
  return { ok: true };
}

const areaSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Kode minimal 2 karakter")
    .max(15)
    .transform((s) => s.toUpperCase()),
  name: z.string().trim().min(3, "Nama minimal 3 karakter").max(60),
  departmentId: z.string().min(1, "Pilih departemen"),
  picUserId: z.string().optional(),
});

export async function saveArea(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser(["ADMIN"]);
  const id = String(formData.get("id") || "");
  const parsed = areaSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    departmentId: formData.get("departmentId"),
    picUserId: formData.get("picUserId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const existing = await prisma.area.findUnique({
    where: { code: parsed.data.code },
  });
  if (existing && existing.id !== id) {
    return { error: `Kode ${parsed.data.code} sudah dipakai` };
  }

  const data = { ...parsed.data, picUserId: parsed.data.picUserId || null };
  if (id) {
    await prisma.area.update({ where: { id }, data });
  } else {
    await prisma.area.create({ data });
  }
  revalidatePath("/admin/departemen");
  return { ok: true };
}

const lineSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(60),
  areaId: z.string().min(1, "Pilih area"),
});

export async function saveLine(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser(["ADMIN"]);
  const id = String(formData.get("id") || "");
  const parsed = lineSchema.safeParse({
    name: formData.get("name"),
    areaId: formData.get("areaId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (id) {
    await prisma.line.update({ where: { id }, data: parsed.data });
  } else {
    await prisma.line.create({ data: parsed.data });
  }
  revalidatePath("/admin/departemen");
  return { ok: true };
}

export async function toggleEntityActive(formData: FormData) {
  await requireUser(["ADMIN"]);
  const id = String(formData.get("id") || "");
  const kind = String(formData.get("kind") || "");
  if (kind === "department") {
    const d = await prisma.department.findUnique({ where: { id } });
    if (d)
      await prisma.department.update({
        where: { id },
        data: { isActive: !d.isActive },
      });
  } else if (kind === "area") {
    const a = await prisma.area.findUnique({ where: { id } });
    if (a)
      await prisma.area.update({
        where: { id },
        data: { isActive: !a.isActive },
      });
  } else if (kind === "line") {
    const l = await prisma.line.findUnique({ where: { id } });
    if (l)
      await prisma.line.update({
        where: { id },
        data: { isActive: !l.isActive },
      });
  }
  revalidatePath("/admin/departemen");
}
