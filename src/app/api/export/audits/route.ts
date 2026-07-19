import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiUser } from "@/lib/api-auth";
import { toCsv } from "@/lib/csv";
import { PILLAR_META, PILLAR_ORDER } from "@/lib/labels";

export async function GET(request: NextRequest) {
  const user = await apiUser(request, ["ADMIN", "SUPERVISOR"]);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const audits = await prisma.audit.findMany({
    where: { status: "SUBMITTED", ...(user.role === "SUPERVISOR" ? { area: { departmentId: user.departmentId! } } : {}) },
    orderBy: { submittedAt: "asc" },
    include: {
      area: { include: { department: true } },
      auditor: true,
      scores: { include: { criterion: true } },
      _count: { select: { findings: true } },
    },
  });

  const csv = toCsv(
    [
      "Tanggal",
      "Departemen",
      "Area",
      "Auditor",
      "Skor Total (%)",
      ...PILLAR_ORDER.map((p) => `${PILLAR_META[p].label} (%)`),
      "Jumlah Temuan",
      "Catatan",
    ],
    audits.map((a) => {
      const perPillar = PILLAR_ORDER.map((p) => {
        const scores = a.scores.filter((s) => s.criterion.pillar === p);
        return scores.length
          ? (
              (scores.reduce((sum, s) => sum + s.score, 0) /
                (scores.length * 4)) *
              100
            ).toFixed(0)
          : "";
      });
      return [
        a.submittedAt ? a.submittedAt.toISOString().slice(0, 10) : "",
        a.area.department.name,
        a.area.name,
        a.auditor.name,
        a.totalScore != null ? a.totalScore.toFixed(1) : "",
        ...perPillar,
        a._count.findings,
        a.notes ?? "",
      ];
    }),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit_5s_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
