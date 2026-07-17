import { NextResponse, type NextRequest } from "next/server";
import { runDailyJobs } from "@/lib/jobs";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runDailyJobs();
  return NextResponse.json({ ok: true, ...result });
}
