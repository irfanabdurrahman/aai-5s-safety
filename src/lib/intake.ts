/* Service bersama untuk pembuatan temuan dari kanal eksternal
   (webhook WhatsApp & tool MCP `buat_temuan`). Field yang tidak bisa
   ditebak dari teks diberi default konservatif — bisa dikoreksi lewat UI. */
import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { nextFindingNumber } from "@/lib/numbering";
import { savePhotoBuffer } from "@/lib/upload";
import { notify, departmentSupervisors } from "@/lib/workflow";
import { mapArea, guessCategory, guessRisk, normText } from "@/lib/area-map";

const intakeSchema = z.object({
  description: z
    .string()
    .trim()
    .min(10, "Jelaskan temuan minimal 10 karakter")
    .max(1000),
  areaText: z.string().trim().max(300).optional(),
  reporterNpk: z.string().trim().min(1).default("WA-BOT"),
});

export type IntakeInput = z.input<typeof intakeSchema> & {
  photos?: { data: Buffer; mime: string }[];
};

export type IntakeResult =
  | { ok: true; number: string; id: string; areaName: string; photoCount: number }
  | { ok: false; error: string };

/** Buat temuan SAFETY_REPORT status OPEN dari teks (+ foto opsional). */
export async function createFindingFromIntake(input: IntakeInput): Promise<IntakeResult> {
  const parsed = intakeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const reporter = await prisma.user.findUnique({
    where: { npk: parsed.data.reporterNpk },
  });
  if (!reporter || !reporter.isActive) {
    return { ok: false, error: `User pelapor ${parsed.data.reporterNpk} tidak ditemukan/aktif` };
  }

  const searchText = [parsed.data.areaText, parsed.data.description]
    .filter(Boolean)
    .join(" ");
  const area = await prisma.area.findUnique({
    where: { code: mapArea(searchText) },
    include: { lines: { where: { isActive: true } } },
  });
  if (!area || !area.isActive) return { ok: false, error: "Area tujuan tidak ditemukan" };

  const textNorm = normText(searchText);
  const line = area.lines.find(
    (l) => normText(l.name).length >= 3 && textNorm.includes(normText(l.name)),
  );

  let photoPaths: string[] = [];
  try {
    photoPaths = await Promise.all(
      (input.photos ?? []).slice(0, 4).map((p) => savePhotoBuffer(p.data, p.mime)),
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menyimpan foto" };
  }

  const finding = await prisma.$transaction(async (tx) => {
    const number = await nextFindingNumber(tx, "SAFETY_REPORT");
    return tx.finding.create({
      data: {
        number,
        source: "SAFETY_REPORT",
        safetyCategory: guessCategory(searchText),
        riskLevel: guessRisk(searchText),
        description: parsed.data.description,
        locationDetail: parsed.data.areaText || null,
        areaId: area.id,
        lineId: line?.id ?? null,
        reporterId: reporter.id,
        photos: {
          create: photoPaths.map((filePath) => ({
            type: "BEFORE" as const,
            filePath,
            uploadedById: reporter.id,
          })),
        },
        statusHistory: {
          create: { toStatus: "OPEN", actorId: reporter.id, note: "Temuan dilaporkan via kanal eksternal" },
        },
      },
    });
  });

  const supervisorIds = await departmentSupervisors(area.departmentId);
  await notify(
    [area.picUserId, ...supervisorIds],
    "FINDING_ASSIGNED",
    `Temuan baru ${finding.number} di ${area.name}`,
    {
      body: parsed.data.description.slice(0, 120),
      findingId: finding.id,
      skip: reporter.id,
    },
  );

  return {
    ok: true,
    number: finding.number,
    id: finding.id,
    areaName: area.name,
    photoCount: photoPaths.length,
  };
}
