/* Seed master data aktual Plant Karawang (per Jul 2026):
   Department P1–P4 → Area (proses) → Line (mesin/line aktual).
   Idempotent: aman dijalankan berulang (upsert by code / skip line yg sudah ada). */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Helper: range("DB", 1, 7) → ["DB1".."DB7"]; range("HPD ", 1, 31, 2) → ["HPD 01".."HPD 31"] */
function range(prefix: string, from: number, to: number, pad = 0): string[] {
  const out: string[] = [];
  for (let i = from; i <= to; i++) out.push(prefix + String(i).padStart(pad, "0"));
  return out;
}

type AreaDef = { name: string; lines: string[] };
type DeptDef = { code: string; name: string; areas: AreaDef[] };

const DATA: DeptDef[] = [
  {
    code: "P1",
    name: "Produksi P1",
    areas: [
      { name: "Assembling", lines: range("DB", 1, 7) },
      { name: "Plating", lines: range("Plating ", 1, 4) },
      { name: "Machining", lines: range("SEL", 1, 7) },
      { name: "Piston", lines: ["SEL Piston"] },
      { name: "Packing", lines: ["PAC1"] },
    ],
  },
  {
    code: "P2",
    name: "Produksi P2",
    areas: [
      { name: "Assy CA", lines: range("CA", 1, 7) },
      { name: "Assy MC", lines: range("MC", 1, 5) },
      { name: "MB", lines: ["MB1"] },
      { name: "Packing", lines: ["Packing J0-01", "Packing J0-02"] },
      { name: "Mach. Caliper", lines: range("MCA", 1, 8) },
      { name: "Mach. Master", lines: range("MMC", 1, 10) },
      { name: "Press Fit", lines: range("PF", 1, 3) },
      { name: "Painting", lines: ["Painting"] },
      { name: "T6", lines: range("Heat Treatment ", 1, 4) },
      { name: "Melting - Casting", lines: range("Holding ", 1, 16) },
    ],
  },
  {
    code: "P3",
    name: "Produksi P3",
    areas: [
      { name: "Ping test", lines: range("Ping test ", 1, 8) },
      { name: "Caulking", lines: range("Caulking ", 1, 3) },
      { name: "Painting 4W", lines: ["Powder Painting D/P R4"] },
      { name: "Schorching", lines: range("SCH ", 1, 3) },
      { name: "Grinding 4W", lines: range("Grinding 0", 4, 6) },
      { name: "Integrated Grinding - Painting Shinwa", lines: ["Grinding Shinwa"] },
      { name: "Curing Oven 4W", lines: range("COD ", 3, 5) },
      { name: "HPD 4W", lines: range("HPD ", 37, 60) },
      { name: "Preform 4W", lines: range("PFD ", 7, 12, 2) },
      { name: "Painting 2W", lines: ["Powder Painting D/P R2"] },
      { name: "Sliting - Grinding 2W", lines: range("Grinding 0", 1, 3) },
      { name: "Curing Oven 2W", lines: range("COD ", 1, 2) },
      { name: "HPD 2W", lines: range("HPD ", 1, 31, 2) },
      { name: "Preform 2W", lines: range("PFD 0", 1, 6) },
      { name: "PP Treatment", lines: range("PPT 0", 1, 3) },
      { name: "Grinding Lining", lines: ["Grind 1", "Grind 2"] },
      { name: "Curing Oven Lining", lines: ["COL 1", "COL 2"] },
      { name: "HPL", lines: range("HPL 0", 1, 9) },
      { name: "Preform Lining", lines: range("PFL 0", 1, 3) },
      { name: "Balancing - Mixing", lines: range("Mix 0", 1, 3) },
    ],
  },
  {
    code: "P4",
    name: "Produksi P4",
    areas: [
      { name: "Brake Assy", lines: range("BA", 1, 4) },
      { name: "CED", lines: ["CED"] },
      { name: "Plate Assy", lines: range("PA", 1, 3) },
      { name: "Dust Cover", lines: range("DC", 1, 2) },
      { name: "AWC", lines: range("AWC", 1, 5) },
      { name: "Alumite", lines: [] }, // qty 2 tapi tanpa nama line di data sumber
      { name: "Machining Wheel Cylinder", lines: range("MWC", 1, 4) },
      { name: "Machining Piston Wheel Cylinder", lines: range("PWC", 1, 3) },
      { name: "Grinding Piston Wheel Cylinder", lines: ["GWC1"] },
      { name: "SL Grinding", lines: range("SLG ", 1, 3) },
      { name: "Bonding", lines: range("Bonding ", 1, 2) },
      { name: "Shoe Assy Treatment", lines: range("SA Treatment ", 1, 2) },
      { name: "Shoe Assy Welding", lines: range("SA", 1, 4) },
      { name: "Hardening", lines: ["SA Hardening"] },
      { name: "Lining Adhesive", lines: ["Adhesive"] },
    ],
  },
];

function areaCode(deptCode: string, areaName: string): string {
  const slug = areaName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${deptCode}-${slug}`;
}

async function main() {
  let areaCount = 0;
  let lineCount = 0;

  for (const d of DATA) {
    const dept = await prisma.department.upsert({
      where: { code: d.code },
      update: { name: d.name },
      create: { code: d.code, name: d.name },
    });

    for (const a of d.areas) {
      const code = areaCode(d.code, a.name);
      const area = await prisma.area.upsert({
        where: { code },
        update: { name: a.name },
        create: { code, name: a.name, departmentId: dept.id },
      });
      areaCount++;

      const existing = new Set(
        (
          await prisma.line.findMany({
            where: { areaId: area.id },
            select: { name: true },
          })
        ).map((l) => l.name),
      );
      for (const name of a.lines) {
        if (existing.has(name)) continue;
        await prisma.line.create({ data: { name, areaId: area.id } });
        lineCount++;
      }
    }
  }

  console.log(`Selesai: ${DATA.length} departemen, ${areaCount} area diproses, ${lineCount} line baru ditambahkan.`);
}

main().finally(() => prisma.$disconnect());
