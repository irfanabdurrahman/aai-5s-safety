import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OrgManager } from "./OrgManager";

export const metadata: Metadata = { title: "Departemen & Area" };

export default async function DepartemenPage() {
  await requireUser(["ADMIN"]);
  const [departments, areas, lines, picCandidates] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.area.findMany({
      orderBy: { name: "asc" },
      include: {
        department: { select: { name: true } },
        picUser: { select: { name: true } },
      },
    }),
    prisma.line.findMany({
      orderBy: { name: "asc" },
      include: { area: { select: { name: true } } },
    }),
    prisma.user.findMany({
      where: { isActive: true, role: { in: ["PIC_AREA", "SUPERVISOR"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">Departemen, Area &amp; Line</h1>
        <p className="text-sm text-muted">
          Struktur lokasi pabrik untuk pelaporan temuan dan audit 5S.
        </p>
      </div>
      <OrgManager
        departments={departments}
        areas={areas}
        lines={lines}
        picCandidates={picCandidates}
      />
    </div>
  );
}
