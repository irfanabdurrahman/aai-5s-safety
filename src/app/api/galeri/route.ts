import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiUser, isTvAuthorized } from "@/lib/api-auth";
import { wibDayStart, wibTodayStr } from "@/lib/dates";
import { buildLiveWallLeaderboard } from "@/lib/live-wall";

/** Safety & 5S Live Wall — akses via token TV atau sesi login. */
export async function GET(request: NextRequest) {
  const tvOk = await isTvAuthorized(request);
  const user = tvOk ? null : await apiUser(request);
  if (!tvOk && !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const monthStart = wibDayStart(`${wibTodayStr().slice(0, 8)}01`);
  const [findings, monthlyContributions] = await Promise.all([
    prisma.finding.findMany({
      where: { isValid: true },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 240,
      select: {
        id: true,
        number: true,
        source: true,
        status: true,
        safetyCategory: true,
        riskLevel: true,
        pillar: true,
        description: true,
        locationDetail: true,
        dueDate: true,
        closedAt: true,
        createdAt: true,
        area: {
          select: {
            name: true,
            department: { select: { name: true, code: true } },
          },
        },
        line: { select: { name: true } },
        reporter: { select: { name: true } },
        pic: { select: { name: true } },
        photos: {
          orderBy: [{ type: "asc" }, { createdAt: "asc" }],
          select: { id: true, type: true, filePath: true },
        },
      },
    }),
    prisma.finding.findMany({
      where: { createdAt: { gte: monthStart }, isValid: true },
      select: {
        id: true,
        isValid: true,
        status: true,
        dueDate: true,
        closedAt: true,
        reporter: {
          select: {
            id: true,
            name: true,
            department: { select: { code: true } },
          },
        },
        area: {
          select: {
            department: {
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
    }),
  ]);

  const leaderboard = buildLiveWallLeaderboard(monthlyContributions);

  return NextResponse.json({
    findings,
    leaderboard: {
      period: wibTodayStr().slice(0, 7),
      scoring: {
        validContribution: 10,
        verifiedClosure: 5,
        onTimeClosure: 5,
      },
      reporters: leaderboard.reporters.slice(0, 10),
      departments: leaderboard.departments.slice(0, 8),
    },
    generatedAt: new Date().toISOString(),
  });
}
