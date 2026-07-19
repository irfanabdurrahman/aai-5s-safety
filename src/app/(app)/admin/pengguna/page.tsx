import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserManager } from "./UserManager";

export const metadata: Metadata = { title: "Kelola Pengguna" };

export default async function PenggunaPage() {
  await requireUser(["ADMIN"]);
  const [users, departments] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        npk: true,
        name: true,
        role: true,
        isActive: true,
        departmentId: true,
        department: { select: { name: true } },
      },
    }),
    prisma.department.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">Kelola Pengguna</h1>
        <p className="text-sm text-muted">
          Akun baru mendapat password sementara unik yang hanya ditampilkan sekali
          kepada admin dan wajib diganti saat login pertama.
        </p>
      </div>
      <UserManager users={users} departments={departments} />
    </div>
  );
}
