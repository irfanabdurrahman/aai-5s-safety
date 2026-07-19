/* Seed minimal: master data + 1 user per role.
   Seed historis lengkap ditambahkan di fase polish. */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function requireSeedPassword(): string {
  const value = process.env.SEED_PASSWORD;
  if (!value || value.length < 12) {
    throw new Error("SEED_PASSWORD minimal 12 karakter wajib diisi untuk menjalankan seed");
  }
  return value;
}

const seedPassword = requireSeedPassword();

async function main() {
  const hash = await bcrypt.hash(seedPassword, 12);

  const departments = [
    { code: "DISC", name: "Produksi Disc Brake" },
    { code: "DRUM", name: "Produksi Drum Brake" },
    { code: "CAST", name: "Casting" },
    { code: "MACH", name: "Machining" },
    { code: "ASSY", name: "Assembly" },
    { code: "QA", name: "Quality Assurance" },
    { code: "MTC", name: "Maintenance" },
    { code: "WH", name: "Warehouse" },
    { code: "HRGA", name: "HRGA & EHS" },
  ];
  for (const d of departments) {
    await prisma.department.upsert({
      where: { code: d.code },
      update: { name: d.name },
      create: d,
    });
  }
  const dept = Object.fromEntries(
    (await prisma.department.findMany()).map((d) => [d.code, d]),
  );

  const users = [
    { npk: "10001", name: "Budi Santoso", role: "ADMIN", dept: "HRGA" },
    { npk: "20001", name: "Rina Kartika", role: "SUPERVISOR", dept: "DISC" },
    { npk: "30001", name: "Agus Wibowo", role: "PIC_AREA", dept: "DISC" },
    { npk: "40001", name: "Dedi Kurniawan", role: "KARYAWAN", dept: "DISC" },
  ] as const;
  for (const u of users) {
    await prisma.user.upsert({
      where: { npk: u.npk },
      update: {},
      create: {
        npk: u.npk,
        name: u.name,
        role: u.role,
        passwordHash: hash,
        departmentId: dept[u.dept].id,
      },
    });
  }

  const agus = await prisma.user.findUnique({ where: { npk: "30001" } });
  const areas = [
    { code: "DISC-L1", name: "Line Disc Brake 1", dept: "DISC" },
    { code: "DISC-L2", name: "Line Disc Brake 2", dept: "DISC" },
    { code: "DISC-PA", name: "Area Painting Disc", dept: "DISC" },
  ];
  for (const a of areas) {
    await prisma.area.upsert({
      where: { code: a.code },
      update: {},
      create: {
        code: a.code,
        name: a.name,
        departmentId: dept[a.dept].id,
        picUserId: agus?.id,
      },
    });
  }

  // ---- Template checklist 5S standar ----
  const CRITERIA: Record<string, string[]> = {
    SEIRI: [
      "Tidak ada barang/material yang tidak diperlukan di area kerja",
      "Tidak ada peralatan/tooling rusak yang masih disimpan di area",
      "Dokumen/kertas yang sudah tidak berlaku telah disingkirkan",
      "Material reject/scrap ditempatkan di lokasi khusus yang ditandai",
      "Tidak ada barang pribadi berlebihan di area kerja",
    ],
    SEITON: [
      "Semua barang memiliki tempat yang ditandai dengan label/garis",
      "Peralatan mudah diambil dan dikembalikan (dalam 30 detik)",
      "Jalur forklift/pejalan kaki jelas dan tidak terhalang",
      "Penyimpanan mengikuti prinsip FIFO dan batas ketinggian tumpukan",
      "Papan informasi/visual control terpasang rapi dan terbaru",
    ],
    SEISO: [
      "Lantai bebas dari oli, air, dan chip/gram",
      "Mesin dan peralatan bersih dari debu dan kotoran",
      "Tidak ada kebocoran (oli/air/angin) yang dibiarkan",
      "Tempat sampah tersedia, terpilah, dan tidak meluap",
      "Jadwal kebersihan area terisi dan dijalankan",
    ],
    SEIKETSU: [
      "Standar 5S area (foto/denah standar) terpasang dan terbaru",
      "Penandaan area (garis lantai, label) dalam kondisi baik",
      "Pencahayaan dan ventilasi area kerja memadai",
      "Checklist perawatan harian mesin terisi konsisten",
      "Kondisi abnormal mudah terlihat (visual management berfungsi)",
    ],
    SHITSUKE: [
      "Karyawan memakai APD sesuai standar area",
      "Karyawan memahami dan menjalankan standar 5S areanya",
      "Briefing 5S/safety dilakukan rutin dan tercatat",
      "Temuan 5S sebelumnya sudah ditindaklanjuti tepat waktu",
      "Budaya saling mengingatkan antar rekan kerja berjalan",
    ],
  };

  let template = await prisma.checklistTemplate.findFirst({
    where: { isActive: true },
  });
  if (!template) {
    template = await prisma.checklistTemplate.create({
      data: {
        name: "Checklist 5S Standar AAI",
        description:
          "Checklist patrol 5S standar PT Akebono Brake Astra Indonesia — 25 kriteria, skala 0–4.",
      },
    });
    let order = 0;
    for (const [pillar, texts] of Object.entries(CRITERIA)) {
      for (const text of texts) {
        await prisma.checklistCriterion.create({
          data: {
            templateId: template.id,
            pillar: pillar as never,
            text,
            sortOrder: order++,
          },
        });
      }
    }
    console.log("Template checklist 5S dibuat (25 kriteria).");
  }

  console.log("Seed minimal selesai. Password seed tidak ditampilkan.");
}

main().finally(() => prisma.$disconnect());
