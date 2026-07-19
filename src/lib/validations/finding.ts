import { z } from "zod";

export const safetyReportSchema = z.object({
  safetyCategory: z.enum(["UNSAFE_CONDITION", "UNSAFE_ACT", "NEAR_MISS"]),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  areaId: z.string().min(1, "Pilih area lokasi temuan"),
  lineId: z.string().optional(),
  locationDetail: z.string().trim().max(160).optional(),
  description: z
    .string()
    .trim()
    .min(10, "Jelaskan temuan minimal 10 karakter")
    .max(1000),
});

export const assignSchema = z.object({
  findingId: z.string().min(1),
  picId: z.string().min(1, "Pilih PIC penanggung jawab"),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tentukan batas waktu perbaikan"),
});

export const completeFixSchema = z.object({
  findingId: z.string().min(1),
  actionNote: z
    .string()
    .trim()
    .min(10, "Jelaskan tindakan perbaikan minimal 10 karakter")
    .max(1000),
});

export const verdictSchema = z.object({
  findingId: z.string().min(1),
  note: z.string().trim().max(500).optional(),
});

export const rejectSchema = z.object({
  findingId: z.string().min(1),
  note: z
    .string()
    .trim()
    .min(5, "Beri alasan penolakan (min. 5 karakter)")
    .max(500),
});

export const commentSchema = z.object({
  findingId: z.string().min(1),
  body: z.string().trim().min(1, "Komentar tidak boleh kosong").max(500),
});
