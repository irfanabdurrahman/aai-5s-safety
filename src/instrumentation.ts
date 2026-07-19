// Scheduler in-process: jalankan job harian ~06:00 WIB.
// Fallback manual: POST /api/cron/run (header x-cron-secret).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const g = globalThis as unknown as { __aaiJobsStarted?: boolean };
  if (g.__aaiJobsStarted) return; // guard HMR/dobel-register
  g.__aaiJobsStarted = true;

  const { runDailyJobs } = await import("@/lib/jobs");

  const msUntilNext6WIB = () => {
    const now = new Date();
    // 06:00 WIB = 23:00 UTC hari sebelumnya
    const next = new Date(now);
    next.setUTCHours(23, 0, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next.getTime() - now.getTime();
  };

  const schedule = () => {
    setTimeout(async () => {
      try {
        const res = await runDailyJobs();
        console.log("[jobs] daily run:", JSON.stringify(res));
      } catch (e) {
        console.error("[jobs] daily run failed:", e);
      }
      schedule(); // jadwalkan lagi untuk besok
    }, msUntilNext6WIB());
  };
  schedule();
  console.log("[jobs] scheduler aktif — job harian 06:00 WIB");
}
