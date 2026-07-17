import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import { toCsv } from "@/lib/csv";
import {
  STATUS_META,
  RISK_META,
  CATEGORY_META,
  PILLAR_META,
  SOURCE_META,
} from "@/lib/labels";
import type { Prisma } from "@/generated/prisma/client";

function fmtDate(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export async function GET(request: NextRequest) {
  const session = await verifySession(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (!session || (session.role !== "ADMIN" && session.role !== "SUPERVISOR")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const where: Prisma.FindingWhereInput = {};
  if (sp.get("dari")) where.createdAt = { gte: new Date(sp.get("dari")!) };
  if (sp.get("sampai")) {
    const end = new Date(sp.get("sampai")!);
    end.setDate(end.getDate() + 1);
    where.createdAt = { ...(where.createdAt as object), lt: end };
  }

  const findings = await prisma.finding.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      area: { include: { department: true } },
      reporter: true,
      pic: true,
      verifiedBy: true,
    },
  });

  const csv = toCsv(
    [
      "Nomor",
      "Sumber",
      "Status",
      "Kategori Safety",
      "Pilar 5S",
      "Risiko",
      "Deskripsi",
      "Departemen",
      "Area",
      "Detail Lokasi",
      "Pelapor",
      "NPK Pelapor",
      "PIC",
      "Target",
      "Tindakan",
      "Diverifikasi Oleh",
      "Tgl Lapor",
      "Tgl Selesai",
    ],
    findings.map((f) => [
      f.number,
      SOURCE_META[f.source].label,
      STATUS_META[f.status].label,
      f.safetyCategory ? CATEGORY_META[f.safetyCategory].label : "",
      f.pillar ? PILLAR_META[f.pillar].label : "",
      f.riskLevel ? RISK_META[f.riskLevel].label : "",
      f.description,
      f.area.department.name,
      f.area.name,
      f.locationDetail ?? "",
      f.reporter.name,
      f.reporter.npk,
      f.pic?.name ?? "",
      fmtDate(f.dueDate),
      f.actionNote ?? "",
      f.verifiedBy?.name ?? "",
      fmtDate(f.createdAt),
      fmtDate(f.closedAt),
    ]),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="temuan_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
