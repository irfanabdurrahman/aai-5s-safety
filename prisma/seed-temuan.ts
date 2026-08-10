/* Import temuan safety REAL dari portal Akebono (menggantikan temuan contoh).
   Sumber data (ekstrak dulu 2 zip dari folder uploads/):
     - /tmp/temuan/dataset/...json  → 158 temuan patrol PIC Night Shift, Jan–Jul 2026 (tanpa foto)
     - /tmp/temuan/demo/...json     → 35 SHE issue Jul 2026 + foto di /tmp/temuan/demo/photos/
   Aksi: hapus SEMUA temuan lama (foto, komentar, histori ikut ter-cascade),
   lalu import ulang dengan mapping area → master data P1–P4. Idempotent-ish:
   aman dijalankan ulang karena selalu flush dulu. */
import "dotenv/config";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { mapArea, guessCategory, guessRisk, normText } from "../src/lib/area-map";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "./uploads");
const DATASET_JSON = "/tmp/temuan/dataset/dataset_temuan_safety_5s_2026-01-01_sd_2026-07-31.json";
const DEMO_JSON = "/tmp/temuan/demo/temuan_safety_data.json";
const DEMO_PHOTOS = "/tmp/temuan/demo";
// Foto patrol (foto_url di dataset) diunduh terpisah dari portal internal
// (lihat data/download-foto-patrol.py), diekstrak ke folder ini:
const DATASET_PHOTOS = "/tmp/temuan/lph";

/** basename foto_url → nama file lokal hasil downloader (spasi → _) */
function fotoLokal(fotoUrl: string): string {
  return path.join(DATASET_PHOTOS, path.basename(fotoUrl.trim()).replace(/ /g, "_"));
}

const REPORTERS = ["40001", "30001", "20001", "10001"]; // rotasi pelapor
const PIC_NPK = "30001"; // Agus — PIC Area
const VERIFIER_NPK = "20001"; // Rina — Supervisor

// ---------- mapping teks area bebas → kode area master data ----------
// (dipindah ke src/lib/area-map.ts — dipakai bersama intake WhatsApp/MCP)

const norm = normText;

type Item = {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM WIB
  description: string;
  locationDetail?: string;
  areaText: string; // teks untuk mapping area/line
  actionNote?: string;
  photos: string[]; // path file sumber di disk (kosong = tanpa foto)
};

async function main() {
  // ---- 0. Load master data & user ----
  const areas = await prisma.area.findMany({ include: { lines: true } });
  const areaByCode = new Map(areas.map((a) => [a.code, a]));
  const users = new Map(
    (await prisma.user.findMany({ where: { npk: { in: [...REPORTERS, PIC_NPK, VERIFIER_NPK] } } })).map(
      (u) => [u.npk, u],
    ),
  );
  const pic = users.get(PIC_NPK)!;
  const verifier = users.get(VERIFIER_NPK)!;

  // ---- 1. Hapus semua temuan lama + file fotonya ----
  const oldPhotos = await prisma.findingPhoto.findMany({ select: { filePath: true } });
  const oldCount = await prisma.finding.count();
  await prisma.finding.deleteMany({});
  for (const p of oldPhotos) {
    await fsp.rm(path.join(UPLOAD_DIR, p.filePath), { force: true });
  }
  await fsp.rm(path.join(UPLOAD_DIR, "demo"), { recursive: true, force: true });
  await prisma.counter.deleteMany({ where: { key: { in: ["SF-2026", "5S-2026"] } } });
  console.log(`Temuan lama dihapus: ${oldCount} (foto: ${oldPhotos.length})`);

  // ---- 2. Baca data sumber ----
  const items: Item[] = [];

  const dataset = JSON.parse(fs.readFileSync(DATASET_JSON, "utf8"));
  type DatasetRecord = {
    tanggal_data: string;
    jam?: string;
    area: string;
    temuan: string;
    progress_improvement?: string;
    foto_url?: string;
  };
  for (const r of dataset.records as DatasetRecord[]) {
    const jam = r.jam && /^\d{2}:\d{2}$/.test(r.jam) ? r.jam : "08:00";
    items.push({
      date: r.tanggal_data,
      time: jam,
      description: String(r.temuan).trim(),
      locationDetail: r.area,
      areaText: `${r.area} ${r.temuan}`,
      actionNote: r.progress_improvement?.trim() || undefined,
      photos: r.foto_url?.trim() ? [fotoLokal(r.foto_url)] : [],
    });
  }

  const demo = JSON.parse(fs.readFileSync(DEMO_JSON, "utf8"));
  type DemoFinding = { date: string; description: string; attachment_files?: string[] };
  for (const f of demo.findings as DemoFinding[]) {
    items.push({
      date: f.date,
      time: "09:00",
      description: String(f.description).replace(/^SHE issue:\s*/i, "").trim(),
      areaText: f.description,
      photos: (f.attachment_files as string[])
        .filter((p) => /\.(jpe?g|png|webp)$/i.test(p))
        .map((p) => path.join(DEMO_PHOTOS, p)),
    });
  }

  // Hanya import temuan yang punya foto di data sumber (permintaan user:
  // temuan tanpa foto tidak usah ditampilkan sama sekali).
  const tanpaFoto = items.filter((it) => it.photos.length === 0).length;
  const bersumberFoto = items.filter((it) => it.photos.length > 0);
  bersumberFoto.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  console.log(
    `Total item diimport: ${bersumberFoto.length} (dilewati tanpa foto: ${tanpaFoto})`,
  );

  // ---- 3. Import ----
  let counter = 0;
  let missingPhoto = 0;
  let photoCount = 0;
  const unmapped: string[] = [];
  const cutoff = "2026-07-15"; // >= ini dianggap "baru", status divariasikan

  for (const [i, it] of bersumberFoto.entries()) {
    const area = areaByCode.get(mapArea(it.areaText));
    if (!area) {
      unmapped.push(it.areaText.slice(0, 80));
      continue;
    }
    const reporter = users.get(REPORTERS[i % REPORTERS.length])!;
    const createdAt = new Date(`${it.date}T${it.time}:00+07:00`);
    const number = `SF-2026-${String(++counter).padStart(4, "0")}`;

    // line: cocokkan nama line area tsb di teks
    const textNorm = norm(it.areaText);
    const line = area.lines.find((l) => norm(l.name).length >= 3 && textNorm.includes(norm(l.name)));

    // status
    let status: "OPEN" | "IN_PROGRESS" | "PENDING_VERIFICATION" | "CLOSED";
    if (it.date < cutoff) status = "CLOSED";
    else status = (["OPEN", "IN_PROGRESS", "PENDING_VERIFICATION", "CLOSED"] as const)[i % 4];
    if (/berjalan dengan aman|aman tidak ada kejadian|tidak ada kecelakaan/i.test(it.description))
      status = "CLOSED";

    const done = status === "CLOSED" || status === "PENDING_VERIFICATION";
    const assigned = done || status === "IN_PROGRESS";
    const dueDate = new Date(it.date + "T00:00:00Z");
    dueDate.setUTCDate(dueDate.getUTCDate() + 7);
    const closedAt =
      status === "CLOSED" ? new Date(createdAt.getTime() + 3 * 24 * 3600 * 1000) : null;

    const finding = await prisma.finding.create({
      data: {
        number,
        source: "SAFETY_REPORT",
        safetyCategory: guessCategory(it.areaText),
        riskLevel: guessRisk(it.areaText),
        description: it.description,
        locationDetail: it.locationDetail ?? null,
        reporterId: reporter.id,
        areaId: area.id,
        lineId: line?.id ?? null,
        status,
        picId: assigned ? pic.id : null,
        dueDate: assigned ? dueDate : null,
        actionNote: done ? (it.actionNote ?? "Perbaikan sudah dilakukan di area terkait.") : null,
        verifiedById: status === "CLOSED" ? verifier.id : null,
        closedAt,
        createdAt,
      },
    });

    // histori status
    type HistRow = {
      fromStatus: "OPEN" | "IN_PROGRESS" | "PENDING_VERIFICATION" | "CLOSED" | null;
      toStatus: "OPEN" | "IN_PROGRESS" | "PENDING_VERIFICATION" | "CLOSED";
      actorId: string;
      at: Date;
    };
    const hist: HistRow[] = [
      { fromStatus: null, toStatus: "OPEN", actorId: reporter.id, at: createdAt },
    ];
    if (assigned)
      hist.push({
        fromStatus: "OPEN",
        toStatus: "IN_PROGRESS",
        actorId: pic.id,
        at: new Date(createdAt.getTime() + 1 * 24 * 3600 * 1000),
      });
    if (done)
      hist.push({
        fromStatus: "IN_PROGRESS",
        toStatus: "PENDING_VERIFICATION",
        actorId: pic.id,
        at: new Date(createdAt.getTime() + 2 * 24 * 3600 * 1000),
      });
    if (status === "CLOSED")
      hist.push({
        fromStatus: "PENDING_VERIFICATION",
        toStatus: "CLOSED",
        actorId: verifier.id,
        at: closedAt ?? new Date(),
      });
    await prisma.findingStatusHistory.createMany({
      data: hist.map((h) => ({
        findingId: finding.id,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        actorId: h.actorId,
        createdAt: h.at,
      })),
    });

    // foto — simpan per folder bulan sesuai tanggal temuan
    const [yyyy, mm] = it.date.split("-");
    for (const src of it.photos) {
      if (!fs.existsSync(src)) {
        missingPhoto++;
        continue;
      }
      const photoDir = path.join(UPLOAD_DIR, yyyy, mm);
      await fsp.mkdir(photoDir, { recursive: true });
      const dest = path.join(photoDir, path.basename(src));
      await fsp.copyFile(src, dest);
      await prisma.findingPhoto.create({
        data: {
          findingId: finding.id,
          type: "BEFORE",
          filePath: `${yyyy}/${mm}/${path.basename(src)}`,
          uploadedById: reporter.id,
          createdAt,
        },
      });
      photoCount++;
    }
  }

  await prisma.counter.upsert({
    where: { key: "SF-2026" },
    update: { value: counter },
    create: { key: "SF-2026", value: counter },
  });

  console.log(`Import selesai: ${counter} temuan, ${photoCount} foto.`);
  if (missingPhoto)
    console.log(
      `PERINGATAN: ${missingPhoto} foto tidak ditemukan di disk (cek ${DATASET_PHOTOS}).`,
    );
  if (unmapped.length) console.log("GAGAL mapping area:", unmapped);
}

main().finally(() => prisma.$disconnect());
