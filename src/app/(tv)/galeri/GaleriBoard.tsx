"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  chunkLiveWall,
  liveWallPhotoUrl,
  liveWallSceneRows,
  liveWallSlaState,
  sortLiveWall,
  type DepartmentStanding,
  type ReporterStanding,
} from "@/lib/live-wall";

const SCENE_MS = 12_000;

type GaleriFinding = {
  id: string;
  number: string;
  source: string;
  status: string;
  safetyCategory: string | null;
  riskLevel: string | null;
  pillar: string | null;
  description: string;
  locationDetail: string | null;
  dueDate: string | null;
  closedAt: string | null;
  createdAt: string;
  area: { name: string; department: { name: string; code: string } };
  line: { name: string } | null;
  reporter: { name: string };
  pic: { name: string } | null;
  photos: { id: string; type: "BEFORE" | "AFTER"; filePath: string }[];
};

type LiveWallResponse = {
  findings: GaleriFinding[];
  leaderboard: {
    period: string;
    scoring: {
      validContribution: number;
      verifiedClosure: number;
      onTimeClosure: number;
    };
    reporters: ReporterStanding[];
    departments: DepartmentStanding[];
  };
  generatedAt: string;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Terbuka", cls: "border-rose-400 bg-rose-500 text-white" },
  IN_PROGRESS: {
    label: "Dikerjakan",
    cls: "border-amber-300 bg-amber-400 text-slate-950",
  },
  PENDING_VERIFICATION: {
    label: "Verifikasi",
    cls: "border-sky-300 bg-sky-500 text-white",
  },
  CLOSED: {
    label: "Selesai",
    cls: "border-emerald-300 bg-emerald-500 text-slate-950",
  },
};

const RISK: Record<string, { label: string; cls: string }> = {
  LOW: { label: "Rendah", cls: "border-emerald-400 text-emerald-200" },
  MEDIUM: { label: "Sedang", cls: "border-amber-400 text-amber-200" },
  HIGH: { label: "Tinggi", cls: "border-orange-400 text-orange-200" },
  CRITICAL: { label: "Kritis", cls: "border-rose-400 text-rose-200" },
};

const CATEGORY: Record<string, string> = {
  UNSAFE_CONDITION: "Kondisi tidak aman",
  UNSAFE_ACT: "Tindakan tidak aman",
  NEAR_MISS: "Near miss",
  SEIRI: "Ringkas",
  SEITON: "Rapi",
  SEISO: "Resik",
  SEIKETSU: "Rawat",
  SHITSUKE: "Rajin",
};

function useSceneSize() {
  const [size, setSize] = useState(2);
  useEffect(() => {
    const calculate = () => {
      if (window.innerWidth >= 1920) setSize(9);
      else if (window.innerWidth >= 1024) setSize(6);
      else if (window.innerWidth >= 640) setSize(4);
      else setSize(2);
    };
    calculate();
    window.addEventListener("resize", calculate);
    return () => window.removeEventListener("resize", calculate);
  }, []);
  return size;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

function slaLabel(finding: GaleriFinding, asOf: string) {
  const state = liveWallSlaState(finding.dueDate, finding.closedAt, asOf);
  if (state === "NO_DUE_DATE") {
    return { label: "SLA belum ditetapkan", cls: "text-slate-300" };
  }
  if (state === "ON_TIME") {
    return { label: "SLA tepat waktu", cls: "text-emerald-300" };
  }
  if (state === "LATE") {
    return { label: "SLA terlambat", cls: "text-rose-300" };
  }
  return {
    label: `${state === "OVERDUE" ? "SLA lewat" : "SLA"} ${formatDate(finding.dueDate!)}`,
    cls: state === "OVERDUE" ? "text-rose-300" : "text-amber-200",
  };
}

function FindingImage({ finding }: { finding: GaleriFinding }) {
  const [failed, setFailed] = useState(false);
  const [landscape, setLandscape] = useState(false);
  const photo =
    finding.photos.find((entry) => entry.type === "AFTER") ?? finding.photos[0];

  if (!photo || failed) {
    return (
      <div className="flex h-full min-h-32 items-center justify-center bg-[#0b1130] px-4 text-center text-sm font-bold text-slate-300">
        <span aria-hidden="true" className="mr-2 text-2xl">▧</span>
        Foto tidak dapat ditampilkan
      </div>
    );
  }

  const url = liveWallPhotoUrl(photo.filePath);
  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-[#0b1130]">
      {/* Kotak foto berrasio 3:4 (portrait). Foto portrait tampil murni;
          hanya foto landscape yang diberi latar blur agar tidak terpotong. */}
      {landscape && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-md"
          loading="eager"
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`${photo.type === "AFTER" ? "Foto sesudah perbaikan" : "Foto temuan"} ${finding.number}`}
        className={`relative h-full w-full ${landscape ? "object-contain" : "object-cover"}`}
        loading="eager"
        onLoad={(event) =>
          setLandscape(
            event.currentTarget.naturalWidth > event.currentTarget.naturalHeight,
          )
        }
        onError={() => setFailed(true)}
      />
      <span className="absolute left-2 top-2 rounded-md border border-white/40 bg-slate-950/85 px-2 py-1 text-[10px] font-black tracking-wider text-white">
        {photo.type === "AFTER" ? "SESUDAH" : "TEMUAN"}
      </span>
    </div>
  );
}

function FindingCard({
  finding,
  asOf,
  compact,
}: {
  finding: GaleriFinding;
  asOf: string;
  compact: boolean;
}) {
  const status = STATUS[finding.status] ?? STATUS.OPEN;
  const risk = finding.riskLevel ? RISK[finding.riskLevel] : null;
  const sla = slaLabel(finding, asOf);
  const category = finding.safetyCategory ?? finding.pillar;
  const location = [finding.area.name, finding.line?.name, finding.locationDetail]
    .filter(Boolean)
    .join(" · ");
  const hasPhoto = finding.photos.length > 0;
  const descriptionClamp = compact
    ? "line-clamp-4 text-xs"
    : "line-clamp-[7] text-sm";

  return (
    <article className="flex min-h-0 min-w-0 overflow-hidden rounded-xl border-2 border-[#6478b4] bg-gradient-to-b from-[#2b3a6b] to-[#25325c] shadow-[0_14px_32px_rgba(0,0,0,0.55)]">
      {hasPhoto && (
        <div className="h-full min-h-0 max-w-[58%] shrink-0 overflow-hidden border-r-2 border-[#6478b4] aspect-[3/4]">
          <FindingImage finding={finding} />
        </div>
      )}
      <div className={`flex min-h-0 min-w-0 flex-1 flex-col text-slate-100 ${compact ? "gap-1 p-2" : "gap-1.5 p-3"}`}>
        <span className="shrink-0 truncate text-[13px] font-black tracking-wide text-cyan-200">
          {finding.number}
        </span>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <span className={`rounded-md border px-2 py-1 text-[10px] font-black ${status.cls}`}>
            {status.label}
          </span>
          {risk && (
            <span className={`rounded-md border bg-[#182247] px-2 py-1 text-[10px] font-black ${risk.cls}`}>
              {risk.label}
            </span>
          )}
        </div>
        <p className={`${descriptionClamp} min-h-0 font-bold leading-snug`} title={finding.description}>{finding.description}</p>
        <div className={`mt-auto flex shrink-0 flex-col gap-0.5 border-t border-[#5b6ea6] text-slate-300 ${compact ? "pt-1 text-[10px]" : "pt-2 text-[11px]"}`}>
          <p className="truncate" title={location}><span aria-hidden="true">⌖</span> {location || "Lokasi belum diisi"}</p>
          <p className="truncate"><span className="text-slate-400">PIC:</span> {finding.pic?.name ?? "Belum ditugaskan"}</p>
          <p className={`truncate font-bold ${sla.cls}`}>{sla.label}</p>
          <p className="truncate">{CATEGORY[category ?? ""] ?? category ?? finding.source}</p>
        </div>
      </div>
    </article>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];

function HeaderLeaderboard({ data }: { data: LiveWallResponse["leaderboard"] | null }) {
  if (!data) return null;
  return (
    <div
      className="ml-auto hidden min-w-0 items-center gap-2 overflow-hidden lg:flex"
      aria-label="Peringkat kontributor valid bulan ini"
      title="Hanya temuan valid. Poin: +10 kontribusi, +5 selesai, +5 tepat waktu."
    >
      <span className="whitespace-nowrap text-[11px] font-black uppercase leading-tight tracking-[0.15em] text-cyan-300">
        Peringkat
        <br />
        Bulan Ini
      </span>
      {data.reporters.length === 0 ? (
        <span className="whitespace-nowrap rounded-xl border border-[#5f73ab] bg-gradient-to-b from-[#2a3a6a] to-[#233158] px-3 py-2 text-xs font-bold text-[#d4ddf0]">
          Belum ada kontribusi valid bulan ini
        </span>
      ) : (
        <>
          {data.reporters.slice(0, 3).map((person, index) => (
            <span
              key={person.id}
              className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-[#7185c2] bg-gradient-to-b from-[#31427a] to-[#283763] px-3 py-1.5"
            >
              <span className="text-xl" aria-hidden="true">{MEDALS[index]}</span>
              <span className="leading-tight">
                <span className="block text-sm font-black">{person.name}</span>
                <span className="block text-[11px] font-semibold text-[#b3c0e0]">
                  {person.validCount} valid · {person.closedCount} selesai
                </span>
              </span>
              <span className="font-mono text-[15px] font-black text-cyan-300">{person.score}</span>
            </span>
          ))}
          {data.departments.length > 0 && (
            <>
              <span className="h-8 w-px shrink-0 bg-[#5f73ab]" aria-hidden="true" />
              {data.departments.slice(0, 2).map((team, index) => (
                <span
                  key={team.id}
                  className="shrink-0 whitespace-nowrap rounded-xl border border-[#5f73ab] bg-gradient-to-b from-[#2a3a6a] to-[#233158] px-3 py-2 text-xs font-extrabold text-[#d4ddf0]"
                >
                  {index === 0 ? "Dept terbaik: " : ""}
                  <b className="text-emerald-300">{team.code} — {team.score}</b>
                </span>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

function ControlButton({ label, onClick, children, pressed }: { label: string; onClick: () => void; children: React.ReactNode; pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      className="flex h-11 min-w-11 items-center justify-center rounded-lg border border-[#65749f] bg-[#26345d] px-3 text-sm font-black text-white transition hover:bg-[#344572] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
    >
      {children}
    </button>
  );
}

export function GaleriBoard() {
  const [data, setData] = useState<LiveWallResponse | null>(null);
  const [error, setError] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [hiddenPaused, setHiddenPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [progress, setProgress] = useState(0);
  const sceneSize = useSceneSize();
  const startedAt = useRef(0);
  const progressRef = useRef(0);

  const scenes = useMemo(
    () => chunkLiveWall(sortLiveWall(data?.findings ?? []), sceneSize),
    [data?.findings, sceneSize],
  );
  const sceneCount = Math.max(scenes.length, 1);
  const activeSceneIndex = sceneIndex % sceneCount;
  const activeScene = scenes[activeSceneIndex] ?? [];
  const activeSceneRows = liveWallSceneRows(sceneSize, activeScene.length);
  const autoPaused = !playing || interactionPaused || hiddenPaused || reducedMotion;

  const goTo = useCallback((next: number) => {
    setSceneIndex(((next % sceneCount) + sceneCount) % sceneCount);
    startedAt.current = Date.now();
    progressRef.current = 0;
    setProgress(0);
  }, [sceneCount]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/galeri", { cache: "no-store" });
        if (!response.ok) throw new Error("Gagal memuat Live Wall");
        const payload = (await response.json()) as LiveWallResponse;
        if (active) {
          setData(payload);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      }
    };
    void load();
    const refresh = window.setInterval(load, 60_000);
    return () => {
      active = false;
      window.clearInterval(refresh);
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    const visibility = () => setHiddenPaused(document.hidden);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      media.removeEventListener("change", apply);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);


  useEffect(() => {
    if (autoPaused || scenes.length < 2) return;
    if (startedAt.current === 0) startedAt.current = Date.now();
    else startedAt.current = Date.now() - progressRef.current * SCENE_MS;
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      if (elapsed >= SCENE_MS) {
        goTo(activeSceneIndex + 1);
        return;
      }
      progressRef.current = elapsed / SCENE_MS;
      setProgress(progressRef.current);
    }, 100);
    return () => window.clearInterval(timer);
  }, [activeSceneIndex, autoPaused, goTo, scenes.length]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        goTo(activeSceneIndex + 1);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        goTo(activeSceneIndex - 1);
      } else if (event.key === " ") {
        event.preventDefault();
        setPlaying((value) => !value);
      } else if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen().catch(() => undefined);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [activeSceneIndex, goTo]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  };

  if (!data && !error) {
    return <main className="flex min-h-dvh items-center justify-center bg-[#0a0f24] text-lg font-bold text-slate-200" aria-live="polite">Memuat Safety &amp; 5S Live Wall…</main>;
  }

  return (
    <main
      className="flex h-dvh min-h-[520px] flex-col overflow-hidden bg-[#0a0f24] text-white"
      onMouseEnter={() => setInteractionPaused(true)}
      onMouseLeave={() => setInteractionPaused(false)}
      onFocusCapture={() => setInteractionPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setInteractionPaused(false);
      }}
    >
      <header className="flex min-h-[72px] shrink-0 items-center gap-3 border-b-2 border-[#3d4d7e] bg-[#141d3d] px-3 py-2 sm:px-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400 bg-cyan-500/15 text-2xl" aria-hidden="true">🛡</div>
        <div className="min-w-0 shrink-0">
          <h1 className="truncate text-base font-black tracking-tight sm:text-xl">Safety &amp; 5S Live Wall</h1>
          <p className="truncate text-[10px] font-semibold text-slate-300 sm:text-xs">
            {data?.findings.length ?? 0} temuan valid · Diperbarui {data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "—"} WIB
          </p>
        </div>
        <HeaderLeaderboard data={data?.leaderboard ?? null} />
        <Link href="/" className="ml-auto flex h-11 shrink-0 items-center justify-center rounded-lg border border-[#65749f] bg-[#26345d] px-3 text-xs font-black text-white hover:bg-[#344572] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 lg:ml-0" aria-label="Keluar dari Live Wall dan kembali ke aplikasi">
          <span aria-hidden="true" className="mr-1.5">←</span><span className="hidden sm:inline">Kembali ke Aplikasi</span><span className="sm:hidden">Keluar</span>
        </Link>
      </header>

      {error && (
        <div className="border-b border-amber-400 bg-amber-300 px-4 py-2 text-center text-xs font-bold text-slate-950" role="status">
          Koneksi pembaruan terganggu. Menampilkan data terakhir yang tersedia.
        </div>
      )}

      {!data?.findings.length ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center">
          <div className="rounded-2xl border-2 border-dashed border-[#6478b4] bg-[#25325c] p-10">
            <p className="text-4xl" aria-hidden="true">▧</p>
            <p className="mt-3 font-black">Belum ada temuan valid.</p>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 p-3">
          <section className="h-full min-h-0" aria-label={`Scene temuan ${activeSceneIndex + 1} dari ${scenes.length}`}>
            <div className="h-full overflow-hidden rounded-xl">
              <div
                key={`${sceneSize}-${activeSceneIndex}-${scenes[activeSceneIndex]?.map((item) => item.id).join("-")}`}
                className="grid h-full grid-cols-1 gap-3 p-1 sm:grid-cols-2 lg:grid-cols-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500"
                style={{
                  gridTemplateRows: `repeat(${activeSceneRows}, minmax(0, 1fr))`,
                }}
              >
                {activeScene.map((finding) => (
                  <FindingCard
                    key={finding.id}
                    finding={finding}
                    asOf={data.generatedAt}
                    compact={sceneSize === 9}
                  />
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      <footer className="shrink-0 border-t-2 border-[#3d4d7e] bg-[#141d3d] px-3 py-2 sm:px-5">
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-[#344267]" role="progressbar" aria-label="Waktu menuju scene berikutnya" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <div className="h-full bg-cyan-400 motion-safe:transition-[width]" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="flex items-center gap-2">
          <ControlButton label="Scene sebelumnya (panah kiri)" onClick={() => goTo(activeSceneIndex - 1)}>‹</ControlButton>
          <ControlButton label={playing ? "Jeda rotasi otomatis (spasi)" : "Putar rotasi otomatis (spasi)"} onClick={() => setPlaying((value) => !value)} pressed={!playing}>{playing ? "Ⅱ" : "▶"}</ControlButton>
          <ControlButton label="Scene berikutnya (panah kanan)" onClick={() => goTo(activeSceneIndex + 1)}>›</ControlButton>
          <div className="min-w-0 flex-1 text-center text-xs font-bold text-slate-300" aria-live="polite">
            Scene {activeSceneIndex + 1} / {scenes.length}
            <span className="hidden sm:inline"> · {autoPaused ? reducedMotion ? "Rotasi nonaktif: gerakan dikurangi" : "Rotasi dijeda" : "Berikutnya dalam 12 detik"}</span>
          </div>
          <ControlButton label="Aktifkan atau keluar layar penuh (F)" onClick={toggleFullscreen}>⛶</ControlButton>
        </div>
      </footer>
    </main>
  );
}
