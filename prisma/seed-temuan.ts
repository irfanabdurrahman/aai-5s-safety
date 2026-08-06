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

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "./uploads");
const DATASET_JSON = "/tmp/temuan/dataset/dataset_temuan_safety_5s_2026-01-01_sd_2026-07-31.json";
const DEMO_JSON = "/tmp/temuan/demo/temuan_safety_data.json";
const DEMO_PHOTOS = "/tmp/temuan/demo";

const REPORTERS = ["40001", "30001", "20001", "10001"]; // rotasi pelapor
const PIC_NPK = "30001"; // Agus — PIC Area
const VERIFIER_NPK = "20001"; // Rina — Supervisor

// ---------- mapping teks area bebas → kode area master data ----------
const RULES: [RegExp, string][] = [
  [/\bMWC\b|WHEEL CYLINDER/i, "P4-MACHINING-WHEEL-CYLINDER"],
  [/SHOE.*TREATMENT|SA TREATMENT/i, "P4-SHOE-ASSY-TREATMENT"],
  [/SHOE|WELDING/i, "P4-SHOE-ASSY-WELDING"],
  [/\bHPL\b/i, "P3-HPL"],
  [/HPD/i, "P3-HPD-2W"], // HPD 37+ dikoreksi di mapArea()
  [/\bAWC\b/i, "P4-AWC"],
  [/\bCED\b/i, "P4-CED"],
  [/PREFORM.*LINING|LINING.*PREFORM/i, "P3-PREFORM-LINING"],
  [/PREFORM/i, "P3-PREFORM-2W"],
  [/PING ?TEST/i, "P3-PING-TEST"],
  [/PP TREATMENT/i, "P3-PP-TREATMENT"],
  [/CURING|BAKING OVEN/i, "P3-CURING-OVEN-2W"],
  [/PLATING/i, "P1-PLATING"],
  [/PISTON/i, "P1-PISTON"],
  [/T6|HEAT TREATMENT|FURNACE|\bHTR\b/i, "P2-T6"],
  [/CAST|\bCST\b|GRAVITY|MELTING|HOLDING|DIE/i, "P2-MELTING-CASTING"],
  [/PAINT/i, "P2-PAINTING"],
  [/P1.*MACH|MACH.*P1|\bSEL ?\d/i, "P1-MACHINING"],
  [/MACH/i, "P2-MACH-MASTER"],
  [/PRESS FIT|\bPF ?\d/i, "P2-PRESS-FIT"],
  [/BRAKE ASSY|\bBA-?\d/i, "P4-BRAKE-ASSY"],
  [/PLATE ASSY/i, "P4-PLATE-ASSY"],
  [/DUST COVER/i, "P4-DUST-COVER"],
  [/BONDING/i, "P4-BONDING"],
  [/ADHESIVE/i, "P4-LINING-ADHESIVE"],
  [/CAULKING/i, "P3-CAULKING"],
  [/SCHORCH/i, "P3-SCHORCHING"],
  [/SHINWA/i, "P3-INTEGRATED-GRINDING-PAINTING-SHINWA"],
  [/GRINDING.*LINING|LINING.*GRINDING/i, "P3-GRINDING-LINING"],
  [/GRINDING/i, "P3-GRINDING-4W"],
  [/LINN?ING/i, "P3-GRINDING-LINING"],
  [/MIXING|BALANCING/i, "P3-BALANCING-MIXING"],
  [/PACKING|SMALL ?PART/i, "P2-PACKING"],
  [/FINISHING|DUST COLLECTOR/i, "P3-GRINDING-4W"],
  [/APAR|HYDRANT|CHARGER/i, "MTC-WS"],
  [/WWT|UTILITY|WORKSHOP/i, "MTC-WS"],
  [/\bQC\b|FRICTION MATERIAL|TESTING/i, "QA-LAB"],
  [/FLAMMA?BLE|CHEMICAL/i, "WH-FG"],
  [/WAREHOUSE|\bWHS\b|DELIVERY|DOCKING|RECEIVING|\bPPC\b|\bAPS\b|SCRAP|SAMPAH/i, "WH-RCV"],
  [/OFFICE|TOILET|KYUKE|MASJID|\bPOLI\b|R&D|\bWKS\b/i, "HRGA-OF"],
  [/PARKIR|JALAN|GERBANG|GATE|PEDESTRIAN|MENUJU PLANT/i, "HRGA-OF"],
  [/\bP1\b|PLANT 1/i, "P1-ASSEMBLING"],
  [/\bP2\b|PLANT 2/i, "P2-ASSY-CA"],
  [/\bP3\b/i, "P3-HPD-2W"],
  [/\bP4\b/i, "P4-BRAKE-ASSY"],
];

function mapArea(text: string): string {
  for (const [re, code] of RULES) {
    if (re.test(text)) {
      if (code === "P3-HPD-2W") {
        const m = text.match(/HPD ?(\d+)/i);
        if (m && parseInt(m[1], 10) >= 32) return "P3-HPD-4W";
      }
      return code;
    }
  }
  return "HRGA-OF";
}

// ---------- heuristik kategori & risiko dari teks ----------
function guessCategory(t: string): "UNSAFE_CONDITION" | "UNSAFE_ACT" | "NEAR_MISS" {
  if (/near miss|nyaris|hampir (ter)?(jatuh|celaka|tertabrak)/i.test(t)) return "NEAR_MISS";
  if (/tanpa APD|tidak (memakai|menggunakan|pakai) APD|melanggar|tidak memakai helm/i.test(t))
    return "UNSAFE_ACT";
  return "UNSAFE_CONDITION";
}

function guessRisk(t: string): "LOW" | "MEDIUM" | "HIGH" {
  if (/bocor|listrik|\bapi\b|terbakar|jatuh|terbentur|terjepit|tersengat|tumpah|meledak|ambruk|licin|tersandung|menjuntai|tergelincir/i.test(t))
    return "HIGH";
  if (/tidak rapi|kurang rapi|berantakan|kotor|debu|terhalang/i.test(t)) return "LOW";
  return "MEDIUM";
}

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

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
  for (const r of dataset.records as any[]) {
    items.push({
      date: r.tanggal_data,
      time: /^\d{2}:\d{2}$/.test(r.jam || "") ? r.jam : "08:00",
      description: String(r.temuan).trim(),
      locationDetail: r.area,
      areaText: `${r.area} ${r.temuan}`,
      actionNote: r.progress_improvement?.trim() || undefined,
      photos: [],
    });
  }

  const demo = JSON.parse(fs.readFileSync(DEMO_JSON, "utf8"));
  for (const f of demo.findings as any[]) {
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

  items.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  console.log(`Total item diimport: ${items.length}`);

  // ---- 3. Import ----
  const photoDir = path.join(UPLOAD_DIR, "2026", "07");
  await fsp.mkdir(photoDir, { recursive: true });

  let counter = 0;
  let photoCount = 0;
  const unmapped: string[] = [];
  const cutoff = "2026-07-15"; // >= ini dianggap "baru", status divariasikan

  for (const [i, it] of items.entries()) {
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
    const hist = [
      { fromStatus: null, toStatus: "OPEN", actorId: reporter.id, at: createdAt },
    ] as any[];
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
        at: closedAt,
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

    // foto
    for (const src of it.photos) {
      if (!fs.existsSync(src)) continue;
      const dest = path.join(photoDir, path.basename(src));
      await fsp.copyFile(src, dest);
      await prisma.findingPhoto.create({
        data: {
          findingId: finding.id,
          type: "BEFORE",
          filePath: `2026/07/${path.basename(src)}`,
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
  if (unmapped.length) console.log("GAGAL mapping area:", unmapped);
}

main().finally(() => prisma.$disconnect());
