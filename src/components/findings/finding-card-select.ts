/** Select Prisma untuk FindingCard — satu definisi untuk semua halaman list.
 *  Harus selalu sinkron dengan FindingCardData di FindingCard.tsx. */
export const FINDING_CARD_SELECT = {
  id: true,
  number: true,
  source: true,
  status: true,
  riskLevel: true,
  safetyCategory: true,
  pillar: true,
  description: true,
  dueDate: true,
  createdAt: true,
  area: { select: { name: true, department: { select: { code: true } } } },
  reporter: { select: { name: true } },
  pic: { select: { name: true } },
  photos: {
    where: { type: "BEFORE" as const },
    take: 1,
    select: { filePath: true },
  },
} as const;

/** Varian dengan thumbnail foto SESUDAH (untuk antrean verifikasi). */
export const FINDING_CARD_SELECT_AFTER = {
  ...FINDING_CARD_SELECT,
  photos: {
    where: { type: "AFTER" as const },
    take: 1,
    select: { filePath: true },
  },
} as const;
