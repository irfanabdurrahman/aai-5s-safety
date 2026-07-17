import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getKpis, getAreaScores } from "@/lib/kpi";
import { getReporterLeaderboard } from "@/lib/leaderboard";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!process.env.TV_TOKEN || token !== process.env.TV_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [kpis, areaScores, reporters, recent] = await Promise.all([
    getKpis(),
    getAreaScores(),
    getReporterLeaderboard("month"),
    prisma.finding.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        number: true,
        status: true,
        riskLevel: true,
        description: true,
        createdAt: true,
        area: { select: { name: true } },
        reporter: { select: { name: true } },
        photos: {
          where: { type: "BEFORE" },
          take: 1,
          select: { filePath: true },
        },
      },
    }),
  ]);

  // Hari tanpa kecelakaan proxy: hari sejak temuan CRITICAL terakhir
  const lastCritical = await prisma.finding.findFirst({
    where: { riskLevel: "CRITICAL" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const daysSinceCritical = lastCritical
    ? Math.floor((Date.now() - lastCritical.createdAt.getTime()) / 86400000)
    : null;

  return NextResponse.json({
    kpis,
    daysSinceCritical,
    areaScores: areaScores.filter((a) => a.score != null).slice(0, 8),
    reporters: reporters.slice(0, 5),
    recent,
    generatedAt: new Date().toISOString(),
  });
}
