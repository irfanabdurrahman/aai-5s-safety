import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReportForm } from "./ReportForm";

export const metadata: Metadata = { title: "Lapor Temuan" };

export default async function LaporPage() {
  const user = await requireUser();
  const areas = await prisma.area.findMany({
    where: { isActive: true },
    orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      departmentId: true,
      department: { select: { name: true } },
      lines: {
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      },
    },
  });

  // Default: area pertama dari departemen si pelapor
  const defaultAreaId =
    areas.find((a) => a.departmentId === user.departmentId)?.id ?? areas[0]?.id;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">Lapor Temuan Safety</h1>
        <p className="text-sm text-muted">
          Lihat bahaya? Foto, jelaskan singkat, kirim. Tim akan menindaklanjuti.
        </p>
      </div>
      <ReportForm
        areas={areas.map((a) => ({
          id: a.id,
          name: a.name,
          departmentName: a.department.name,
          lines: a.lines,
        }))}
        defaultAreaId={defaultAreaId}
      />
    </div>
  );
}
