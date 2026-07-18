import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiUser, isTvAuthorized } from "@/lib/api-auth";

/** Data galeri foto temuan — akses via token TV atau sesi login. */
export async function GET(request: NextRequest) {
  const tvOk = isTvAuthorized(request.nextUrl.searchParams.get("token"));
  const user = tvOk ? null : await apiUser(request);
  if (!tvOk && !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const findings = await prisma.finding.findMany({
    where: { photos: { some: {} } },
    orderBy: { createdAt: "desc" },
    take: 24,
    select: {
      id: true,
      number: true,
      source: true,
      status: true,
      safetyCategory: true,
      riskLevel: true,
      pillar: true,
      description: true,
      createdAt: true,
      area: {
        select: { name: true, department: { select: { name: true } } },
      },
      reporter: { select: { name: true } },
      pic: { select: { name: true } },
      photos: {
        orderBy: { createdAt: "asc" },
        select: { type: true, filePath: true },
      },
    },
  });

  return NextResponse.json({ findings, generatedAt: new Date().toISOString() });
}
