"use client";

import { useEffect, useMemo, useState } from "react";

type GaleriFinding = {
  id: string;
  number: string;
  source: string;
  status: string;
  safetyCategory: string | null;
  riskLevel: string | null;
  pillar: string | null;
  description: string;
  createdAt: string;
  area: { name: string; department: { name: string } };
  reporter: { name: string };
  pic: { name: string } | null;
  photos: { type: "BEFORE" | "AFTER"; filePath: string }[];
};

const STATUS: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Terbuka", cls: "bg-red-500/90" },
  IN_PROGRESS: { label: "Dikerjakan", cls: "bg-amber-500/90" },
  PENDING_VERIFICATION: { label: "Menunggu Verifikasi", cls: "bg-sky-500/90" },
  CLOSED: { label: "Selesai ✔", cls: "bg-emerald-500/90" },
};

const CATEGORY: Record<string, string> = {
  UNSAFE_CONDITION: "Kondisi Tidak Aman",
  UNSAFE_ACT: "Tindakan Tidak Aman",
  NEAR_MISS: "Near Miss",
};
const PILLAR: Record<string, string> = {
  SEIRI: "5S · Ringkas",
  SEITON: "5S · Rapi",
  SEISO: "5S · Resik",
  SEIKETSU: "5S · Rawat",
  SHITSUKE: "5S · Rajin",
};
const RISK: Record<string, string> = {
  LOW: "Risiko Rendah",
  MEDIUM: "Risiko Sedang",
  HIGH: "Risiko Tinggi",
  CRITICAL: "Risiko Kritis",
};

const SLIDE_MS = 8000;

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}

function categoryChips(f: GaleriFinding): string[] {
  const chips: string[] = [];
  if (f.safetyCategory) chips.push(CATEGORY[f.safetyCategory] ?? f.safetyCategory);
  if (f.pillar) chips.push(PILLAR[f.pillar] ?? f.pillar);
  if (f.riskLevel) chips.push(RISK[f.riskLevel] ?? f.riskLevel);
  return chips;
}

function photoUrl(path: string, token: string | null) {
  return `/api/files/${path}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Jakarta",
  });
}

export function GaleriBoard({ token }: { token: string | null }) {
  const [findings, setFindings] = useState<GaleriFinding[]>([]);
  const [idx, setIdx] = useState(0);
  const [isTv, setIsTv] = useState(false);

  useEffect(() => {
    // TV = layar lebar landscape; HP = feed vertikal ala Instagram
    const mq = window.matchMedia("(min-width: 1024px) and (orientation: landscape)");
    const apply = () => setIsTv(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/galeri${token ? `?token=${encodeURIComponent(token)}` : ""}`,
        );
        if (res.ok && alive) {
          const d = await res.json();
          setFindings(d.findings ?? []);
        }
      } catch {
        /* biarkan data lama */
      }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [token]);

  // Auto-advance slide di mode TV
  useEffect(() => {
    if (!isTv || findings.length < 2) return;
    const t = setInterval(
      () => setIdx((i) => (i + 1) % findings.length),
      SLIDE_MS,
    );
    return () => clearInterval(t);
  }, [isTv, findings.length]);

  const current = findings[idx % Math.max(findings.length, 1)];
  const chips = useMemo(
    () => (current ? categoryChips(current) : []),
    [current],
  );

  if (!findings.length) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#171b46] text-white/60">
        Belum ada temuan berfoto.
      </main>
    );
  }

  /* ============ MODE TV: slideshow fullscreen ============ */
  if (isTv) {
    const before = current.photos.find((p) => p.type === "BEFORE");
    const after = current.photos.find((p) => p.type === "AFTER");
    const st = STATUS[current.status] ?? STATUS.OPEN;
    return (
      <main
        className="relative flex h-dvh overflow-hidden bg-[#101334] text-white"
        onDoubleClick={() =>
          document.fullscreenElement
            ? document.exitFullscreen()
            : document.documentElement.requestFullscreen().catch(() => {})
        }
      >
        {/* Background blur dari foto */}
        {before && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={current.id + "-bg"}
            src={photoUrl(before.filePath, token)}
            alt=""
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-2xl"
          />
        )}

        <div
          key={current.id}
          className="galeri-slide relative z-10 flex w-full items-center gap-[3vw] p-[4vh]"
        >
          {/* Foto utama (before + after bila ada) */}
          <div className="flex h-full min-w-0 flex-1 items-center justify-center gap-[2vh]">
            {before && (
              <figure className="flex h-full max-w-[55%] flex-col">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl(before.filePath, token)}
                  alt="Foto temuan"
                  className="min-h-0 flex-1 rounded-3xl object-cover shadow-2xl"
                />
                {after && (
                  <figcaption className="mt-[1vh] text-center text-[1.6vh] font-bold text-red-300">
                    SEBELUM
                  </figcaption>
                )}
              </figure>
            )}
            {after && (
              <figure className="flex h-full max-w-[55%] flex-col">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl(after.filePath, token)}
                  alt="Foto sesudah perbaikan"
                  className="min-h-0 flex-1 rounded-3xl object-cover shadow-2xl"
                />
                <figcaption className="mt-[1vh] text-center text-[1.6vh] font-bold text-emerald-300">
                  SESUDAH
                </figcaption>
              </figure>
            )}
          </div>

          {/* Panel info */}
          <div className="flex w-[34vw] shrink-0 flex-col gap-[2vh]">
            <div className="flex items-center gap-3">
              <span className="text-[2.4vh] font-extrabold text-white/60">
                {current.number}
              </span>
              <span
                className={`rounded-full px-[1.6vh] py-[0.7vh] text-[1.6vh] font-extrabold ${st.cls}`}
              >
                {st.label}
              </span>
            </div>
            <p className="text-[clamp(1rem,3.2vh,2.1rem)] font-bold leading-snug">
              {current.description}
            </p>
            <div className="flex flex-wrap gap-[1vh]">
              {chips.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-white/15 px-[1.6vh] py-[0.7vh] text-[1.6vh] font-bold"
                >
                  {c}
                </span>
              ))}
            </div>
            <div className="mt-[1vh] flex items-center gap-[1.5vh] rounded-2xl bg-white/10 p-[1.8vh]">
              <span className="flex h-[6vh] w-[6vh] items-center justify-center rounded-full bg-emerald-500/80 text-[2.2vh] font-extrabold">
                {initials(current.reporter.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[2.2vh] font-extrabold">
                  {current.reporter.name}
                </p>
                <p className="truncate text-[1.7vh] text-white/60">
                  📍 {current.area.name} · {current.area.department.name} ·{" "}
                  {fmtDate(current.createdAt)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Progress slide */}
        <div className="absolute inset-x-0 bottom-0 z-20 flex gap-1 p-[1.5vh]">
          {findings.map((f, i) => (
            <button
              key={f.id}
              onClick={() => setIdx(i)}
              aria-label={`Slide ${i + 1}`}
              className={`h-[0.8vh] flex-1 rounded-full transition-colors ${
                i === idx % findings.length ? "bg-emerald-400" : "bg-white/20"
              }`}
            />
          ))}
        </div>

        <div className="absolute right-[2vh] top-[2vh] z-20 text-[1.5vh] font-bold text-white/40">
          {(idx % findings.length) + 1} / {findings.length} · Galeri Temuan 5S
          &amp; Safety
        </div>
      </main>
    );
  }

  /* ============ MODE HP: feed vertikal ala Instagram ============ */
  return (
    <main className="snap-feed h-dvh overflow-y-auto bg-[#101334]">
      <header className="sticky top-0 z-20 flex items-center gap-2 bg-[#171b46]/95 px-4 py-3 text-white backdrop-blur">
        <span className="text-lg">🛡️</span>
        <h1 className="text-sm font-extrabold">Galeri Temuan — AAI 5S &amp; Safety</h1>
      </header>
      {findings.map((f) => {
        const st = STATUS[f.status] ?? STATUS.OPEN;
        const before = f.photos.find((p) => p.type === "BEFORE");
        const after = f.photos.find((p) => p.type === "AFTER");
        return (
          <article
            key={f.id}
            className="mx-auto max-w-lg border-b border-white/10 pb-4 text-white"
          >
            {/* Header ala IG */}
            <div className="flex items-center gap-2.5 px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/80 text-xs font-extrabold">
                {initials(f.reporter.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold">
                  {f.reporter.name}
                </p>
                <p className="truncate text-[11px] text-white/55">
                  📍 {f.area.name} · {fmtDate(f.createdAt)}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${st.cls}`}
              >
                {st.label}
              </span>
            </div>

            {/* Foto */}
            {before && (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl(before.filePath, token)}
                  alt="Foto temuan"
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
                {after && (
                  <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold">
                    SEBELUM
                  </span>
                )}
              </div>
            )}
            {after && (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl(after.filePath, token)}
                  alt="Foto sesudah perbaikan"
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
                <span className="absolute left-3 top-3 rounded-full bg-emerald-600/90 px-2.5 py-1 text-[10px] font-bold">
                  SESUDAH
                </span>
              </div>
            )}

            {/* Caption */}
            <div className="space-y-2 px-4 pt-3">
              <p className="text-sm leading-snug">
                <span className="font-extrabold text-white/70">
                  {f.number}
                </span>{" "}
                {f.description}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {categoryChips(f).map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </article>
        );
      })}
      <p className="py-6 text-center text-xs text-white/40">
        Menampilkan {findings.length} temuan berfoto terbaru
      </p>
    </main>
  );
}
