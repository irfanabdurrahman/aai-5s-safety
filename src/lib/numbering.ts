import type { Prisma } from "@/generated/prisma/client";
import type { FindingSource } from "@/generated/prisma/enums";

/** Nomor temuan berurutan per prefix+tahun, aman dari race (dipanggil dalam transaksi).
 *  Contoh hasil: SF-2026-0001, 5S-2026-0012 */
export async function nextFindingNumber(
  tx: Prisma.TransactionClient,
  source: FindingSource,
): Promise<string> {
  const prefix = source === "SAFETY_REPORT" ? "SF" : "5S";
  const key = `${prefix}-${new Date().getFullYear()}`;
  const counter = await tx.counter.upsert({
    where: { key },
    update: { value: { increment: 1 } },
    create: { key, value: 1 },
  });
  return `${key}-${String(counter.value).padStart(4, "0")}`;
}
