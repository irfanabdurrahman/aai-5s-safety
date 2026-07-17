import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FindingCard } from "@/components/findings/FindingCard";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Verifikasi" };

export default async function VerifikasiPage() {
  const user = await requireUser(["SUPERVISOR", "ADMIN"]);

  // Supervisor: hanya departemennya; Admin: semua
  const where: Prisma.FindingWhereInput = {
    status: "PENDING_VERIFICATION",
    ...(user.role === "SUPERVISOR" && user.departmentId
      ? { area: { departmentId: user.departmentId } }
      : {}),
  };

  const findings = await prisma.finding.findMany({
    where,
    orderBy: { updatedAt: "asc" },
    select: {
      id: true,
      number: true,
      source: true,
      status: true,
      riskLevel: true,
      safetyCategory: true,
      pillar: true,
      description: true,
      dueDate: true,
      createdAt: true,
      area: { select: { name: true, department: { select: { code: true } } } },
      reporter: { select: { name: true } },
      pic: { select: { name: true } },
      photos: {
        where: { type: "AFTER" },
        take: 1,
        select: { filePath: true },
      },
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">Antrean Verifikasi</h1>
        <p className="text-sm text-muted">
          Perbaikan yang menunggu persetujuanmu
          {user.role === "SUPERVISOR" && user.department
            ? ` di ${user.department.name}`
            : ""}
          .
        </p>
      </div>

      {findings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line py-14 text-center text-sm font-semibold text-muted">
          Tidak ada yang menunggu verifikasi. ✅
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {findings.map((f) => (
            <FindingCard key={f.id} finding={f} />
          ))}
        </div>
      )}
    </div>
  );
}
