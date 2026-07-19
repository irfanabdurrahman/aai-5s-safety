import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { healthIdentity } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const identity = healthIdentity(process.env);
    return NextResponse.json(
      {
        status: "ok",
        database: "reachable",
        ...identity,
        latencyMs: Math.round(performance.now() - startedAt),
        timestamp: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        database: "unreachable",
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
