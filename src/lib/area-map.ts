/* Mapping teks bebas (caption WA, laporan portal, dll) → kode area master data.
   Dipakai oleh intake WhatsApp/MCP (src/lib/intake.ts) dan prisma/seed-temuan.ts.
   Urutan RULES penting: aturan spesifik harus di atas aturan umum. */

const RULES: [RegExp, string][] = [
  [/\bMWC\b|WHEEL CYLINDER/i, "P4-MACHINING-WHEEL-CYLINDER"],
  [/SHOE.*TREATMENT|SA TREATMENT/i, "P4-SHOE-ASSY-TREATMENT"],
  [/SHOE|WELDING/i, "P4-SHOE-ASSY-WELDING"],
  [/\bHPL\b/i, "P3-HPL"],
  [/HPD/i, "P3-HPD-2W"], // HPD 32+ dikoreksi di mapArea()
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

/** Tebak kode area master data dari teks bebas. Fallback: HRGA-OF (area umum). */
export function mapArea(text: string): string {
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

export function guessCategory(t: string): "UNSAFE_CONDITION" | "UNSAFE_ACT" | "NEAR_MISS" {
  if (/near miss|nyaris|hampir (ter)?(jatuh|celaka|tertabrak)/i.test(t)) return "NEAR_MISS";
  if (/tanpa APD|tidak (memakai|menggunakan|pakai) APD|melanggar|tidak memakai helm/i.test(t))
    return "UNSAFE_ACT";
  return "UNSAFE_CONDITION";
}

export function guessRisk(t: string): "LOW" | "MEDIUM" | "HIGH" {
  if (/bocor|listrik|\bapi\b|terbakar|jatuh|terbentur|terjepit|tersengat|tumpah|meledak|ambruk|licin|tersandung|menjuntai|tergelincir/i.test(t))
    return "HIGH";
  if (/tidak rapi|kurang rapi|berantakan|kotor|debu|terhalang/i.test(t)) return "LOW";
  return "MEDIUM";
}

/** Normalisasi teks untuk pencocokan nama line (huruf besar, alfanumerik saja). */
export const normText = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Caption pesan grup dianggap temuan bila mengandung kata kunci ini. */
export const INTAKE_KEYWORD =
  /(temuan|safety|5s|5r|near[\s-]?miss|bahaya|unsafe|\bk3\b)/i;
