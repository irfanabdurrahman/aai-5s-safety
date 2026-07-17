"use client";

import { useEffect, useState } from "react";

type TvData = {
  kpis: {
    open: number;
    inProgress: number;
    pending: number;
    closedThisMonth: number;
    overdue: number;
  };
  daysSinceCritical: number | null;
  areaScores: {
    id: string;
    name: string;
    departmentCode: string;
    score: number;
    prevScore: number | null;
  }[];
  reporters: { rank: number; count: number; user: { name: string } }[];
  recent: {
    id: string;
    number: string;
    status: string;
    riskLevel: string | null;
    description: string;
    area: { name: string };
    reporter: { name: string };
    photos: { filePath: string }[];
  }[];
  generatedAt: string;
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "TERBUKA", cls: "bg-red-500/20 text-red-300" },
  IN_PROGRESS: { label: "DIKERJAKAN", cls: "bg-amber-500/20 text-amber-300" },
  PENDING_VERIFICATION: {
    label: "VERIFIKASI",
    cls: "bg-sky-500/20 text-sky-300",
  },
  CLOSED: { label: "SELESAI", cls: "bg-emerald-500/20 text-emerald-300" },
};

function Chip({
  value,
  label,
  cls,
}: {
  value: number | string;
  label: string;
  cls: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-white/[0.06] px-6 py-4">
      <span className={`text-5xl font-extrabold tabular-nums ${cls}`}>
        {value}
      </span>
      <span className="mt-1 text-xs font-bold uppercase tracking-widest text-white/50">
        {label}
      </span>
    </div>
  );
}

export function TvBoard({ token }: { token: string }) {
  const [data, setData] = useState<TvData | null>(null);
  const [clock, setClock] = useState("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/tv-data?token=${encodeURIComponent(token)}`);
        if (res.ok && alive) setData(await res.json());
      } catch {
        /* koneksi putus — biarkan data lama tampil */
      }
    };
    load();
    const t = setInterval(load, 45_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [token]);

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Jakarta",
        }),
      );
    tick();
    const t = setInterval(tick, 10_000);
    return () => clearInterval(t);
  }, []);

  if (!data) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#0a1428] text-white/60">
        Memuat data…
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col bg-[#0a1428] p-6 text-white">
      {/* Header */}
      <header className="flex items-center gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-2xl">
          🛡️
        </span>
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight">
            5S &amp; Safety — PT Akebono Brake Astra Indonesia
          </h1>
          <p className="text-sm text-white/50">
            Keselamatan dimulai dari kita semua
          </p>
        </div>
        {data.daysSinceCritical != null && (
          <div className="mr-6 text-center">
            <p className="text-4xl font-extrabold text-emerald-300 tabular-nums">
              {data.daysSinceCritical}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
              hari tanpa temuan kritis
            </p>
          </div>
        )}
        <span className="text-4xl font-extrabold tabular-nums text-white/80">
          {clock}
        </span>
      </header>

      {/* KPI */}
      <section className="mt-6 grid grid-cols-5 gap-4">
        <Chip value={data.kpis.open} label="Terbuka" cls="text-red-300" />
        <Chip
          value={data.kpis.inProgress}
          label="Dikerjakan"
          cls="text-amber-300"
        />
        <Chip
          value={data.kpis.pending}
          label="Tunggu Verifikasi"
          cls="text-sky-300"
        />
        <Chip
          value={data.kpis.closedThisMonth}
          label="Selesai Bulan Ini"
          cls="text-emerald-300"
        />
        <Chip value={data.kpis.overdue} label="Terlambat" cls="text-red-300" />
      </section>

      <div className="mt-6 grid flex-1 grid-cols-3 gap-6">
        {/* Temuan terbaru */}
        <section className="col-span-2">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-white/50">
            Temuan Terbaru
          </h2>
          <div className="space-y-2.5">
            {data.recent.slice(0, 6).map((f) => {
              const s = STATUS_LABEL[f.status] ?? STATUS_LABEL.OPEN;
              return (
                <div
                  key={f.id}
                  className="flex items-center gap-4 rounded-2xl bg-white/[0.06] p-3"
                >
                  {f.photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/files/${f.photos[0].filePath}?token=${encodeURIComponent(token)}`}
                      alt=""
                      className="h-16 w-16 rounded-xl object-cover"
                    />
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/10 text-2xl">
                      📋
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-bold">{f.description}</p>
                    <p className="text-sm text-white/50">
                      {f.number} · {f.area.name} · {f.reporter.name}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold ${s.cls}`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Sidebar: skor 5S + top pelapor */}
        <section className="space-y-6">
          <div>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-white/50">
              Skor 5S per Area
            </h2>
            <div className="space-y-2">
              {data.areaScores.map((a) => (
                <div key={a.id} className="flex items-center gap-3">
                  <span className="w-36 truncate text-sm font-semibold">
                    {a.name}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${
                        a.score >= 80
                          ? "bg-emerald-400"
                          : a.score >= 60
                            ? "bg-amber-400"
                            : "bg-red-400"
                      }`}
                      style={{ width: `${a.score}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-sm font-extrabold tabular-nums">
                    {a.score.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-white/50">
              Pelapor Teraktif Bulan Ini
            </h2>
            <div className="space-y-2">
              {data.reporters.map((r, i) => (
                <div
                  key={r.user.name + i}
                  className="flex items-center gap-3 rounded-xl bg-white/[0.06] px-4 py-2.5"
                >
                  <span className="text-xl">
                    {["🥇", "🥈", "🥉", "🏅", "🏅"][i]}
                  </span>
                  <span className="flex-1 truncate text-sm font-bold">
                    {r.user.name}
                  </span>
                  <span className="text-sm font-extrabold tabular-nums text-white/70">
                    {r.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <footer className="mt-4 text-right text-[11px] text-white/30">
        Pembaruan otomatis tiap 45 detik · Lapor temuan lewat aplikasi di HP kamu
      </footer>
    </main>
  );
}
