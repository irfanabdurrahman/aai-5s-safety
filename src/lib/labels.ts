import type {
  FindingStatus,
  RiskLevel,
  SafetyCategory,
  FiveSPillar,
  FindingSource,
  AuditStatus,
} from "@/generated/prisma/enums";

type Tone = "brand" | "accent" | "ok" | "warn" | "danger" | "info" | "neutral";

export const STATUS_META: Record<
  FindingStatus,
  { label: string; tone: Tone }
> = {
  OPEN: { label: "Terbuka", tone: "danger" },
  IN_PROGRESS: { label: "Dikerjakan", tone: "warn" },
  PENDING_VERIFICATION: { label: "Menunggu Verifikasi", tone: "info" },
  CLOSED: { label: "Selesai", tone: "ok" },
};

export const RISK_META: Record<RiskLevel, { label: string; tone: Tone }> = {
  LOW: { label: "Rendah", tone: "neutral" },
  MEDIUM: { label: "Sedang", tone: "info" },
  HIGH: { label: "Tinggi", tone: "warn" },
  CRITICAL: { label: "Kritis", tone: "danger" },
};

/** Saran batas waktu default (hari) per tingkat risiko. */
export const RISK_DUE_DAYS: Record<RiskLevel, number> = {
  CRITICAL: 1,
  HIGH: 3,
  MEDIUM: 7,
  LOW: 14,
};

export const CATEGORY_META: Record<
  SafetyCategory,
  { label: string; short: string }
> = {
  UNSAFE_CONDITION: { label: "Kondisi Tidak Aman", short: "Kondisi" },
  UNSAFE_ACT: { label: "Tindakan Tidak Aman", short: "Tindakan" },
  NEAR_MISS: { label: "Nyaris Celaka (Near Miss)", short: "Near Miss" },
};

export const PILLAR_META: Record<
  FiveSPillar,
  { label: string; jp: string; desc: string }
> = {
  SEIRI: { label: "Ringkas", jp: "Seiri", desc: "Singkirkan yang tidak perlu" },
  SEITON: { label: "Rapi", jp: "Seiton", desc: "Tata dengan teratur" },
  SEISO: { label: "Resik", jp: "Seiso", desc: "Bersihkan area kerja" },
  SEIKETSU: { label: "Rawat", jp: "Seiketsu", desc: "Pertahankan standar" },
  SHITSUKE: { label: "Rajin", jp: "Shitsuke", desc: "Disiplin & kebiasaan" },
};

export const PILLAR_ORDER: FiveSPillar[] = [
  "SEIRI",
  "SEITON",
  "SEISO",
  "SEIKETSU",
  "SHITSUKE",
];

export const SOURCE_META: Record<FindingSource, { label: string }> = {
  SAFETY_REPORT: { label: "Laporan Safety" },
  AUDIT_5S: { label: "Audit 5S" },
};

export const AUDIT_STATUS_META: Record<
  AuditStatus,
  { label: string; tone: Tone }
> = {
  SCHEDULED: { label: "Terjadwal", tone: "neutral" },
  IN_PROGRESS: { label: "Berlangsung", tone: "warn" },
  SUBMITTED: { label: "Selesai", tone: "ok" },
};

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

/** Terlambat = due lewat & belum selesai (dihitung, bukan status). */
export function isOverdue(f: {
  dueDate: Date | null;
  status: FindingStatus;
}): boolean {
  if (!f.dueDate || f.status === "CLOSED") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return f.dueDate < today;
}
