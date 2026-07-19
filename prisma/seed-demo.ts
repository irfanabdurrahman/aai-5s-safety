/* Seed demo historis: master data lengkap + audit & temuan 45 hari terakhir
   agar dashboard, leaderboard, dan TV langsung hidup.
   Jalankan SETELAH seed.ts:  npx tsx prisma/seed-demo.ts
   Idempotent: skip kalau sudah ada >10 temuan. */
import "dotenv/config";
import bcrypt from "bcryptjs";
import path from "path";
import { mkdir } from "fs/promises";
import sharp from "sharp";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type {
  FiveSPillar,
  RiskLevel,
  SafetyCategory,
} from "../src/generated/prisma/enums";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "./uploads");
const DAY = 86400000;
const now = Date.now();
const daysAgo = (d: number, hour = 9) => {
  const x = new Date(now - d * DAY);
  x.setHours(hour, Math.floor(Math.random() * 50), 0, 0);
  return x;
};

// ---- Foto placeholder (JPEG dari SVG) ----
async function makePhoto(label: string, color: string): Promise<string> {
  const dir = "demo";
  await mkdir(path.join(UPLOAD_DIR, dir), { recursive: true });
  const name = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.jpg`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
    <rect width="800" height="600" fill="${color}"/>
    <rect x="0" y="500" width="800" height="100" fill="rgba(0,0,0,0.35)"/>
    <text x="400" y="560" text-anchor="middle" font-family="Arial" font-size="36"
      font-weight="bold" fill="#fff">${label}</text>
    <text x="400" y="300" text-anchor="middle" font-family="Arial" font-size="120"
      fill="rgba(255,255,255,0.25)">📷</text>
  </svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toFile(
    path.join(UPLOAD_DIR, dir, name),
  );
  return `${dir}/${name}`;
}

async function main() {
  const findingCount = await prisma.finding.count();
  if (findingCount > 10) {
    console.log("Sudah ada data demo (temuan:", findingCount, ") — skip.");
    return;
  }

  const seedPassword = process.env.SEED_PASSWORD;
  if (!seedPassword || seedPassword.length < 12) {
    throw new Error("SEED_PASSWORD minimal 12 karakter wajib diisi untuk seed demo");
  }
  const hash = await bcrypt.hash(seedPassword, 12);
  const dept = Object.fromEntries(
    (await prisma.department.findMany()).map((d) => [d.code, d]),
  );

  // ---- Users ----
  const USERS: [string, string, "KARYAWAN" | "PIC_AREA" | "SUPERVISOR" | "ADMIN", string][] = [
    ["10002", "Siti Rahmawati", "ADMIN", "HRGA"],
    ["20002", "Hendra Gunawan", "SUPERVISOR", "DRUM"],
    ["20003", "Yusuf Maulana", "SUPERVISOR", "CAST"],
    ["20004", "Ratna Sari", "SUPERVISOR", "QA"],
    ["20005", "Bambang Prasetyo", "SUPERVISOR", "ASSY"],
    ["30002", "Eko Prabowo", "PIC_AREA", "DRUM"],
    ["30003", "Slamet Riyadi", "PIC_AREA", "CAST"],
    ["30004", "Joko Susilo", "PIC_AREA", "MACH"],
    ["30005", "Andi Firmansyah", "PIC_AREA", "ASSY"],
    ["30006", "Wawan Setiawan", "PIC_AREA", "MTC"],
    ["30007", "Tri Wahyuni", "PIC_AREA", "WH"],
    ["30008", "Lina Marlina", "PIC_AREA", "QA"],
    ["40002", "Rudi Hartono", "KARYAWAN", "DISC"],
    ["40003", "Fitri Handayani", "KARYAWAN", "DISC"],
    ["40004", "Agung Nugroho", "KARYAWAN", "DRUM"],
    ["40005", "Dewi Anggraini", "KARYAWAN", "CAST"],
    ["40006", "Firman Syahputra", "KARYAWAN", "MACH"],
    ["40007", "Indra Kusuma", "KARYAWAN", "ASSY"],
    ["40008", "Maya Puspita", "KARYAWAN", "QA"],
    ["40009", "Taufik Hidayat", "KARYAWAN", "MTC"],
    ["40010", "Nur Aini", "KARYAWAN", "WH"],
  ];
  for (const [npk, name, role, dcode] of USERS) {
    await prisma.user.upsert({
      where: { npk },
      update: {},
      create: {
        npk,
        name,
        role,
        passwordHash: hash,
        departmentId: dept[dcode].id,
      },
    });
  }
  const users = Object.fromEntries(
    (await prisma.user.findMany()).map((u) => [u.npk, u]),
  );

  // ---- Areas ----
  const AREAS: [string, string, string, string][] = [
    // [code, name, deptCode, pic npk]
    ["DRUM-L1", "Line Drum Brake 1", "DRUM", "30002"],
    ["DRUM-L2", "Line Drum Brake 2", "DRUM", "30002"],
    ["CAST-ML", "Area Melting", "CAST", "30003"],
    ["CAST-MD", "Area Molding", "CAST", "30003"],
    ["MACH-L1", "Line Machining 1", "MACH", "30004"],
    ["MACH-L2", "Line Machining 2", "MACH", "30004"],
    ["ASSY-L1", "Line Assembly 1", "ASSY", "30005"],
    ["ASSY-L2", "Line Assembly 2", "ASSY", "30005"],
    ["QA-LAB", "Laboratorium QA", "QA", "30008"],
    ["MTC-WS", "Workshop Maintenance", "MTC", "30006"],
    ["WH-RCV", "Area Receiving", "WH", "30007"],
    ["WH-FG", "Gudang Finished Goods", "WH", "30007"],
    ["HRGA-OF", "Area Office & Kantin", "HRGA", "30006"],
  ];
  for (const [code, name, dcode, picNpk] of AREAS) {
    await prisma.area.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name,
        departmentId: dept[dcode].id,
        picUserId: users[picNpk].id,
      },
    });
  }
  // PIC untuk area DISC dari seed dasar
  const area = Object.fromEntries(
    (await prisma.area.findMany()).map((a) => [a.code, a]),
  );
  for (const code of ["DISC-L1", "DISC-L2", "DISC-PA"]) {
    await prisma.area.update({
      where: { code },
      data: { picUserId: users["30001"].id },
    });
  }

  // ---- Lines ----
  for (const [name, areaCode] of [
    ["Line 1A", "DISC-L1"],
    ["Line 1B", "DISC-L1"],
    ["Line 2A", "ASSY-L1"],
  ] as const) {
    const exists = await prisma.line.findFirst({
      where: { name, areaId: area[areaCode].id },
    });
    if (!exists)
      await prisma.line.create({
        data: { name, areaId: area[areaCode].id },
      });
  }

  // ---- Template & jadwal ----
  const template = (await prisma.checklistTemplate.findFirst({
    where: { isActive: true },
    include: { criteria: { orderBy: { sortOrder: "asc" } } },
  }))!;

  const SCHEDULES: [string, string, number][] = [
    ["DISC-L1", "20001", 1],
    ["DRUM-L1", "20002", 2],
    ["CAST-ML", "20003", 3],
    ["ASSY-L1", "20005", 4],
    ["WH-FG", "10001", 5],
  ];
  for (const [areaCode, auditorNpk, dow] of SCHEDULES) {
    const exists = await prisma.auditSchedule.findFirst({
      where: { areaId: area[areaCode].id },
    });
    if (!exists) {
      await prisma.auditSchedule.create({
        data: {
          areaId: area[areaCode].id,
          templateId: template.id,
          auditorId: users[auditorNpk].id,
          frequency: "WEEKLY",
          dayOfWeek: dow,
          startDate: daysAgo(42),
        },
      });
    }
  }

  // ---- Audit historis (8 audit, 6 minggu) ----
  const AUDITS: [string, string, number, number][] = [
    // [areaCode, auditorNpk, daysAgo, target skor %]
    ["DISC-L1", "20001", 38, 62],
    ["DRUM-L1", "20002", 35, 71],
    ["CAST-ML", "20003", 30, 58],
    ["ASSY-L1", "20005", 24, 76],
    ["DISC-L1", "20001", 17, 74],
    ["WH-FG", "10001", 12, 83],
    ["CAST-ML", "20003", 8, 69],
    ["ASSY-L1", "20005", 3, 88],
  ];
  for (const [areaCode, auditorNpk, ago, target] of AUDITS) {
    const scheduledDate = daysAgo(ago, 8);
    const audit = await prisma.audit.create({
      data: {
        areaId: area[areaCode].id,
        templateId: template.id,
        auditorId: users[auditorNpk].id,
        status: "SUBMITTED",
        scheduledDate,
        conductedAt: scheduledDate,
        submittedAt: daysAgo(ago, 10),
      },
    });
    // skor per kriteria mendekati target
    let total = 0;
    for (const c of template.criteria) {
      const jitter = Math.random() * 30 - 15;
      const pct = Math.min(100, Math.max(0, target + jitter));
      const score = Math.min(4, Math.max(0, Math.round((pct / 100) * 4)));
      total += score;
      await prisma.auditScore.create({
        data: { auditId: audit.id, criterionId: c.id, score },
      });
    }
    await prisma.audit.update({
      where: { id: audit.id },
      data: {
        totalScore:
          Math.round((total / (template.criteria.length * 4)) * 1000) / 10,
      },
    });
  }

  // ---- Foto placeholder ----
  const photoOil = await makePhoto("Oli tercecer di lantai", "#5b6470");
  const photoCable = await makePhoto("Kabel melintang jalur", "#7a5c46");
  const photoApd = await makePhoto("Pekerja tanpa APD lengkap", "#3f6212");
  const photoStack = await makePhoto("Tumpukan melebihi batas", "#8a4b32");
  const photoClean = await makePhoto("Kondisi sudah diperbaiki", "#166534");
  const photoDark = await makePhoto("Penerangan kurang", "#374151");
  const photoFire = await makePhoto("APAR terhalang barang", "#7f1d1d");
  const photoMess = await makePhoto("Area kerja berantakan", "#78716c");

  // ---- Temuan ----
  type Row = {
    src: "SF" | "5S";
    cat?: SafetyCategory;
    risk?: RiskLevel;
    pillar?: FiveSPillar;
    desc: string;
    areaCode: string;
    reporter: string;
    status: "OPEN" | "IN_PROGRESS" | "PENDING_VERIFICATION" | "CLOSED";
    ago: number;
    dueIn?: number; // hari dari lapor
    pic?: string;
    photo: string;
    action?: string;
  };

  const ROWS: Row[] = [
    // CLOSED (12)
    { src: "SF", cat: "UNSAFE_CONDITION", risk: "HIGH", desc: "Oli tercecer di lantai jalur forklift dekat mesin CNC-03, licin dan berisiko terpeleset.", areaCode: "MACH-L1", reporter: "40006", status: "CLOSED", ago: 42, dueIn: 3, pic: "30004", photo: photoOil, action: "Oli dibersihkan, dipasang drip pan, jadwal patroli kebocoran ditambah." },
    { src: "SF", cat: "UNSAFE_ACT", risk: "MEDIUM", desc: "Operator mengangkat disc rotor tanpa sarung tangan anti-slip.", areaCode: "DISC-L1", reporter: "40002", status: "CLOSED", ago: 40, dueIn: 7, pic: "30001", photo: photoApd, action: "Briefing APD ulang, stok sarung tangan ditambah di line." },
    { src: "SF", cat: "NEAR_MISS", risk: "CRITICAL", desc: "Forklift hampir menabrak pekerja di blind spot receiving; cermin cembung tidak ada.", areaCode: "WH-RCV", reporter: "40010", status: "CLOSED", ago: 38, dueIn: 1, pic: "30007", photo: photoCable, action: "Cermin cembung dipasang, marka jalur pejalan diperjelas." },
    { src: "5S", pillar: "SEITON", desc: "Tumpukan pallet finished goods melebihi batas ketinggian yang diizinkan.", areaCode: "WH-FG", reporter: "20001", status: "CLOSED", ago: 35, dueIn: 7, pic: "30007", photo: photoStack, action: "Tumpukan dibongkar sesuai standar, label batas tinggi dipasang ulang." },
    { src: "SF", cat: "UNSAFE_CONDITION", risk: "MEDIUM", desc: "Penerangan area molding redup, beberapa lampu mati.", areaCode: "CAST-MD", reporter: "40005", status: "CLOSED", ago: 33, dueIn: 7, pic: "30006", photo: photoDark, action: "8 lampu diganti LED, lux level dicek ulang QA." },
    { src: "5S", pillar: "SEISO", desc: "Chip/gram menumpuk di bawah mesin machining line 2.", areaCode: "MACH-L2", reporter: "20001", status: "CLOSED", ago: 30, dueIn: 7, pic: "30004", photo: photoMess, action: "Pembersihan total + jadwal 5 menit 5S per shift." },
    { src: "SF", cat: "UNSAFE_CONDITION", risk: "HIGH", desc: "APAR di dekat area melting terhalang tumpukan material.", areaCode: "CAST-ML", reporter: "40005", status: "CLOSED", ago: 28, dueIn: 3, pic: "30003", photo: photoFire, action: "Material dipindahkan, garis kuning area APAR dicat ulang." },
    { src: "SF", cat: "UNSAFE_ACT", risk: "LOW", desc: "Karyawan duduk di atas pallet saat istirahat.", areaCode: "WH-FG", reporter: "40010", status: "CLOSED", ago: 25, dueIn: 14, pic: "30007", photo: photoMess, action: "Sosialisasi area istirahat, bangku tambahan disediakan." },
    { src: "5S", pillar: "SEIRI", desc: "Tooling rusak masih disimpan bercampur dengan tooling aktif.", areaCode: "DISC-L1", reporter: "20001", status: "CLOSED", ago: 22, dueIn: 7, pic: "30001", photo: photoMess, action: "Red tag campaign, tooling rusak dikarantina." },
    { src: "SF", cat: "NEAR_MISS", risk: "HIGH", desc: "Kabel power melintang di jalur pejalan tanpa cable protector.", areaCode: "ASSY-L1", reporter: "40007", status: "CLOSED", ago: 18, dueIn: 3, pic: "30005", photo: photoCable, action: "Cable tray permanen dipasang di atas jalur." },
    { src: "SF", cat: "UNSAFE_CONDITION", risk: "MEDIUM", desc: "Selang angin bocor di line drum 1, bunyi desis terus menerus.", areaCode: "DRUM-L1", reporter: "40004", status: "CLOSED", ago: 15, dueIn: 7, pic: "30002", photo: photoOil, action: "Selang diganti, fitting dikencangkan, cek berkala masuk checklist." },
    { src: "5S", pillar: "SHITSUKE", desc: "Checklist kebersihan harian tidak terisi 1 minggu terakhir.", areaCode: "QA-LAB", reporter: "20004", status: "CLOSED", ago: 12, dueIn: 7, pic: "30008", photo: photoMess, action: "Reminder harian oleh leader, monitoring mingguan supervisor." },
    // PENDING_VERIFICATION (3)
    { src: "SF", cat: "UNSAFE_CONDITION", risk: "MEDIUM", desc: "Lantai retak di jalur handlift area assembly.", areaCode: "ASSY-L2", reporter: "40007", status: "PENDING_VERIFICATION", ago: 9, dueIn: 7, pic: "30005", photo: photoMess, action: "Lantai ditambal epoxy, jalur dialihkan sementara." },
    { src: "5S", pillar: "SEIKETSU", desc: "Label identifikasi rak sparepart banyak yang pudar/hilang.", areaCode: "MTC-WS", reporter: "10001", status: "PENDING_VERIFICATION", ago: 8, dueIn: 7, pic: "30006", photo: photoStack, action: "Semua label dicetak ulang dengan laminasi." },
    { src: "SF", cat: "UNSAFE_ACT", risk: "HIGH", desc: "Operator membersihkan mesin dalam keadaan running.", areaCode: "DRUM-L2", reporter: "20002", status: "PENDING_VERIFICATION", ago: 6, dueIn: 3, pic: "30002", photo: photoApd, action: "SOP LOTO ditempel di mesin, briefing safety khusus." },
    // IN_PROGRESS (6) — 3 overdue
    { src: "SF", cat: "UNSAFE_CONDITION", risk: "HIGH", desc: "Guard mesin press kendor, bisa terbuka saat operasi.", areaCode: "DRUM-L1", reporter: "40004", status: "IN_PROGRESS", ago: 12, dueIn: 3, pic: "30002", photo: photoMess },
    { src: "5S", pillar: "SEITON", desc: "Material WIP menghalangi akses panel listrik line 1.", areaCode: "DISC-L1", reporter: "20001", status: "IN_PROGRESS", ago: 10, dueIn: 5, pic: "30001", photo: photoStack },
    { src: "SF", cat: "UNSAFE_CONDITION", risk: "CRITICAL", desc: "Bau gas menyengat di sekitar tungku melting shift malam.", areaCode: "CAST-ML", reporter: "40005", status: "IN_PROGRESS", ago: 5, dueIn: 1, pic: "30003", photo: photoFire },
    { src: "SF", cat: "UNSAFE_CONDITION", risk: "MEDIUM", desc: "Exhaust fan lab QA mati, sirkulasi udara buruk.", areaCode: "QA-LAB", reporter: "40008", status: "IN_PROGRESS", ago: 4, dueIn: 7, pic: "30008", photo: photoDark },
    { src: "5S", pillar: "SEISO", desc: "Tempat sampah B3 meluap belum diangkut.", areaCode: "MTC-WS", reporter: "40009", status: "IN_PROGRESS", ago: 3, dueIn: 2, pic: "30006", photo: photoMess },
    { src: "SF", cat: "NEAR_MISS", risk: "MEDIUM", desc: "Pintu emergency exit office susah dibuka, engsel berkarat.", areaCode: "HRGA-OF", reporter: "40003", status: "IN_PROGRESS", ago: 2, dueIn: 7, pic: "30006", photo: photoDark },
    // OPEN (6)
    { src: "SF", cat: "UNSAFE_CONDITION", risk: "HIGH", desc: "Hydraulic hose mesin press drum 2 rembes, oli menetes ke panel.", areaCode: "DRUM-L2", reporter: "40004", status: "OPEN", ago: 2, photo: photoOil },
    { src: "SF", cat: "UNSAFE_ACT", risk: "MEDIUM", desc: "Pekerja kontraktor bekerja di ketinggian tanpa body harness.", areaCode: "HRGA-OF", reporter: "40002", status: "OPEN", ago: 1, photo: photoApd },
    { src: "SF", cat: "NEAR_MISS", risk: "HIGH", desc: "Rak sparepart goyang saat diambil barangnya, hampir roboh.", areaCode: "MTC-WS", reporter: "40009", status: "OPEN", ago: 1, photo: photoStack },
    { src: "5S", pillar: "SEIRI", desc: "Dus bekas menumpuk di pojok area receiving lebih dari 1 minggu.", areaCode: "WH-RCV", reporter: "40010", status: "OPEN", ago: 1, photo: photoMess },
    { src: "SF", cat: "UNSAFE_CONDITION", risk: "LOW", desc: "Keramik lantai kantin pecah di dekat wastafel.", areaCode: "HRGA-OF", reporter: "40008", status: "OPEN", ago: 0, photo: photoMess },
    { src: "SF", cat: "UNSAFE_CONDITION", risk: "CRITICAL", desc: "Crane hoist assembly 2 bunyi abnormal saat angkat beban penuh.", areaCode: "ASSY-L2", reporter: "40007", status: "OPEN", ago: 0, photo: photoMess },
  ];

  let sfCount = 0;
  let fsCount = 0;
  for (const r of ROWS) {
    const num =
      r.src === "SF"
        ? `SF-2026-${String(++sfCount).padStart(4, "0")}`
        : `5S-2026-${String(++fsCount).padStart(4, "0")}`;
    const created = daysAgo(r.ago);
    const due = r.dueIn ? new Date(created.getTime() + r.dueIn * DAY) : null;
    const reporter = users[r.reporter];
    const pic = r.pic ? users[r.pic] : null;
    const a = area[r.areaCode];
    const closedAt =
      r.status === "CLOSED"
        ? new Date(created.getTime() + (r.dueIn ?? 5) * DAY * 0.8)
        : null;
    const spv = Object.values(users).find(
      (u) => u.role === "SUPERVISOR" && u.departmentId === a.departmentId,
    );
    const verifier = spv ?? users["10001"];

    const finding = await prisma.finding.create({
      data: {
        number: num,
        source: r.src === "SF" ? "SAFETY_REPORT" : "AUDIT_5S",
        safetyCategory: r.cat,
        riskLevel: r.risk,
        pillar: r.pillar,
        description: r.desc,
        areaId: a.id,
        reporterId: reporter.id,
        status: r.status,
        picId: pic?.id,
        dueDate: due,
        actionNote: r.action,
        verifiedById: r.status === "CLOSED" ? verifier.id : null,
        closedAt,
        createdAt: created,
        photos: {
          create: [
            {
              type: "BEFORE" as const,
              filePath: r.photo,
              uploadedById: reporter.id,
              createdAt: created,
            },
            ...(r.status === "CLOSED" || r.status === "PENDING_VERIFICATION"
              ? [
                  {
                    type: "AFTER" as const,
                    filePath: photoClean,
                    uploadedById: (pic ?? reporter).id,
                    createdAt: closedAt ?? new Date(),
                  },
                ]
              : []),
          ],
        },
      },
    });

    // riwayat status
    const hist: {
      toStatus: "OPEN" | "IN_PROGRESS" | "PENDING_VERIFICATION" | "CLOSED";
      fromStatus?: "OPEN" | "IN_PROGRESS" | "PENDING_VERIFICATION";
      actorId: string;
      note?: string;
      at: Date;
    }[] = [
      { toStatus: "OPEN", actorId: reporter.id, note: "Temuan dilaporkan", at: created },
    ];
    if (r.status !== "OPEN" && pic) {
      hist.push({
        fromStatus: "OPEN",
        toStatus: "IN_PROGRESS",
        actorId: verifier.id,
        note: `PIC: ${pic.name}`,
        at: new Date(created.getTime() + 4 * 3600000),
      });
    }
    if (r.status === "PENDING_VERIFICATION" || r.status === "CLOSED") {
      hist.push({
        fromStatus: "IN_PROGRESS",
        toStatus: "PENDING_VERIFICATION",
        actorId: (pic ?? reporter).id,
        note: r.action?.slice(0, 100),
        at: new Date((closedAt ?? new Date()).getTime() - 6 * 3600000),
      });
    }
    if (r.status === "CLOSED") {
      hist.push({
        fromStatus: "PENDING_VERIFICATION",
        toStatus: "CLOSED",
        actorId: verifier.id,
        note: "Verifikasi diterima",
        at: closedAt!,
      });
    }
    for (const h of hist) {
      await prisma.findingStatusHistory.create({
        data: {
          findingId: finding.id,
          fromStatus: h.fromStatus,
          toStatus: h.toStatus,
          actorId: h.actorId,
          note: h.note,
          createdAt: h.at,
        },
      });
    }

    // komentar di sebagian temuan
    if (r.ago % 3 === 0 && pic) {
      await prisma.comment.create({
        data: {
          findingId: finding.id,
          userId: pic.id,
          body: "Siap, saya cek ke lokasi dulu hari ini.",
          createdAt: new Date(created.getTime() + 5 * 3600000),
        },
      });
      await prisma.comment.create({
        data: {
          findingId: finding.id,
          userId: reporter.id,
          body: "Terima kasih pak, ditunggu update-nya. 🙏",
          createdAt: new Date(created.getTime() + 6 * 3600000),
        },
      });
    }
  }

  // Counter sinkron dengan nomor terakhir
  await prisma.counter.upsert({
    where: { key: "SF-2026" },
    update: { value: sfCount },
    create: { key: "SF-2026", value: sfCount },
  });
  await prisma.counter.upsert({
    where: { key: "5S-2026" },
    update: { value: fsCount },
    create: { key: "5S-2026", value: fsCount },
  });

  console.log(
    `Seed demo selesai: ${ROWS.length} temuan (SF:${sfCount}, 5S:${fsCount}), 8 audit historis, ${USERS.length} user tambahan.`,
  );
}

main().finally(() => prisma.$disconnect());
