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
  OPEN: { label: "TERBUKA", cls: "bg-red-500/25 text-red-200" },
  IN_PROGRESS: { label: "DIKERJAKAN", cls: "bg-amber-500/25 text-amber-200" },
  PENDING_VERIFICATION: {
    label: "VERIFIKASI",
    cls: "bg-sky-500/25 text-sky-200",
  },
  CLOSED: { label: "SELESAI", cls: "bg-emerald-500/25 text-emerald-200" },
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
    <div className="flex flex-col items-center justify-center rounded-2xl bg-white/[0.07] px-4 py-3">
      <span
        className={`text-[clamp(1.8rem,4vh,3.2rem)] font-extrabold leading-none tabular-nums ${cls}`}
      >
        {value}
      </span>
      <span className="mt-1.5 text-[clamp(0.55rem,1.2vh,0.8rem)] font-bold uppercase tracking-widest text-white/55">
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
        const res = await fetch(
          `/api/tv-data?token=${encodeURIComponent(token)}`,
        );
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

  function goFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }

  if (!data) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#171b46] text-white/60">
        Memuat data…
      </main>
    );
  }

  const medals = ["🥇", "🥈", "🥉", "🏅", "🏅"];

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-gradient-to-br from-[#1b2050] via-[#171b46] to-[#101334] p-[2vh] text-white">
      {/* Header */}
      <header className="flex items-center gap-4">
        <span className="flex h-[5.5vh] w-[5.5vh] items-center justify-center rounded-2xl bg-white/10 text-[3vh]">
          🛡️
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[clamp(1rem,3vh,1.9rem)] font-extrabold tracking-tight">
            5S &amp; Safety — PT Akebono Brake Astra Indonesia
          </h1>
          <p className="text-[clamp(0.6rem,1.5vh,0.95rem)] text-white/50">
            Keselamatan dimulai dari kita semua
          </p>
        </div>
        {data.daysSinceCritical != null && (
          <div className="mr-4 text-center">
            <p className="text-[clamp(1.5rem,4vh,3rem)] font-extrabold leading-none text-emerald-300 tabular-nums">
              {data.daysSinceCritical}
            </p>
            <p className="text-[clamp(0.5rem,1.1vh,0.7rem)] font-bold uppercase tracking-widest text-white/50">
              hari tanpa temuan kritis
            </p>
          </div>
        )}
        <span className="text-[clamp(1.5rem,4vh,3rem)] font-extrabold tabular-nums text-white/85">
          {clock}
        </span>
        <button
          onClick={goFullscreen}
          className="rounded-xl bg-white/10 px-3 py-2 text-[clamp(0.6rem,1.4vh,0.85rem)] font-bold text-white/70 hover:bg-white/20"
        >
          ⛶ Fullscreen
        </button>
      </header>

      {/* KPI */}
      <section className="mt-[1.5vh] grid grid-cols-5 gap-[1.2vh]">
        <Chip value={data.kpis.open} label="Terbuka" cls="text-red-300" />
        <Chip
          value={data.kpis.inProgress}
          label="Dikerjakan"
          cls="text-amber-300"
        />
        <Chip
          value={data.kpis.pending}
          label="Verifikasi"
          cls="text-sky-300"
        />
        <Chip
          value={data.kpis.closedThisMonth}
          label="Selesai Bln Ini"
          cls="text-emerald-300"
        />
        <Chip value={data.kpis.overdue} label="Terlambat" cls="text-red-300" />
      </section>

      {/* Konten utama — 1 layar, tanpa scroll */}
      <div className="mt-[1.5vh] grid min-h-0 flex-1 grid-cols-3 gap-[1.5vh]">
        {/* Temuan terbaru */}
        <section className="col-span-2 flex min-h-0 flex-col">
          <h2 className="mb-[1vh] text-[clamp(0.6rem,1.5vh,0.9rem)] font-bold uppercase tracking-widest text-white/50">
            Temuan Terbaru
          </h2>
          <div className="flex min-h-0 flex-1 flex-col gap-[1.2vh]">
            {data.recent.slice(0, 5).map((f) => {
              const s = STATUS_LABEL[f.status] ?? STATUS_LABEL.OPEN;
              return (
                <div
                  key={f.id}
                  className="flex min-h-0 flex-1 items-center gap-[1.5vh] rounded-2xl bg-white/[0.07] px-[1.5vh]"
                >
                  {f.photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/files/${f.photos[0].filePath}?token=${encodeURIComponent(token)}`}
                      alt=""
                      className="h-[80%] w-[9vh] rounded-xl object-cover"
                    />
                  ) : (
                    <span className="flex h-[80%] w-[9vh] items-center justify-center rounded-xl bg-white/10 text-[3vh]">
                      📋
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[clamp(0.8rem,2.2vh,1.35rem)] font-bold">
                      {f.description}
                    </p>
                    <p className="truncate text-[clamp(0.6rem,1.6vh,1rem)] text-white/50">
                      {f.number} · {f.area.name} · {f.reporter.name}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-[1.3vh] py-[0.7vh] text-[clamp(0.55rem,1.4vh,0.85rem)] font-extrabold ${s.cls}`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Sidebar: leaderboard + skor 5S */}
        <section className="flex min-h-0 flex-col gap-[1.5vh]">
          <div className="flex min-h-0 flex-1 flex-col rounded-2xl bg-white/[0.05] p-[1.5vh]">
            <h2 className="mb-[1vh] text-[clamp(0.6rem,1.5vh,0.9rem)] font-bold uppercase tracking-widest text-emerald-300">
              🏆 Pelapor Teraktif Bulan Ini
            </h2>
            <div className="flex min-h-0 flex-1 flex-col justify-around">
              {data.reporters.slice(0, 5).map((r, i) => (
                <div
                  key={r.user.name + i}
                  className="flex items-center gap-[1.2vh] rounded-xl bg-white/[0.07] px-[1.3vh] py-[0.8vh]"
                >
                  <span className="text-[clamp(0.9rem,2.4vh,1.5rem)]">
                    {medals[i]}
                  </span>
                  <span className="flex-1 truncate text-[clamp(0.7rem,1.9vh,1.15rem)] font-bold">
                    {r.user.name}
                  </span>
                  <span className="text-[clamp(0.75rem,2vh,1.2rem)] font-extrabold tabular-nums text-emerald-300">
                    {r.count}
                  </span>
                </div>
              ))}
              {!data.reporters.length && (
                <p className="text-center text-[1.6vh] text-white/40">
                  Belum ada laporan bulan ini
                </p>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-2xl bg-white/[0.05] p-[1.5vh]">
            <h2 className="mb-[1vh] text-[clamp(0.6rem,1.5vh,0.9rem)] font-bold uppercase tracking-widest text-white/50">
              Skor 5S per Area
            </h2>
            <div className="flex min-h-0 flex-1 flex-col justify-around gap-[0.6vh]">
              {data.areaScores.slice(0, 6).map((a) => (
                <div key={a.id} className="flex items-center gap-[1.2vh]">
                  <span className="w-[14vh] truncate text-[clamp(0.6rem,1.6vh,1rem)] font-semibold">
                    {a.name}
                  </span>
                  <div className="h-[1.1vh] flex-1 overflow-hidden rounded-full bg-white/10">
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
                  <span className="w-[5vh] text-right text-[clamp(0.65rem,1.7vh,1.05rem)] font-extrabold tabular-nums">
                    {a.score.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <footer className="mt-[1vh] flex items-center justify-between text-[clamp(0.5rem,1.2vh,0.75rem)] text-white/30">
        <span>Galeri foto temuan: /galeri?token=…</span>
        <span>
          Pembaruan otomatis tiap 45 detik · Lapor temuan lewat aplikasi di HP
          kamu
        </span>
      </footer>
    </main>
  );
}
