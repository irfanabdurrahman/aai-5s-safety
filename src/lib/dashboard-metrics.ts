import { closedOnOrBeforeDueDayWib } from "./dates";

export const FINDING_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "PENDING_VERIFICATION",
  "CLOSED",
] as const;

export const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const SAFETY_CATEGORIES = [
  "UNSAFE_CONDITION",
  "UNSAFE_ACT",
  "NEAR_MISS",
] as const;

export type FindingStatus = (typeof FINDING_STATUSES)[number];
export type RiskLevel = (typeof RISK_LEVELS)[number];
export type SafetyCategory = (typeof SAFETY_CATEGORIES)[number];

type DashboardFinding = {
  status: FindingStatus | string;
  riskLevel: RiskLevel | string | null;
  safetyCategory: SafetyCategory | string | null;
  createdAt: Date;
  closedAt: Date | null;
  dueDate: Date | null;
  isValid: boolean;
};

type AuditObservation = {
  areaId: string;
  status: string;
};

const DAY_MS = 86_400_000;

function elapsedDays(from: Date, to: Date) {
  return Math.max(0, (to.getTime() - from.getTime()) / DAY_MS);
}

function emptyStatusRow(): Record<FindingStatus, number> {
  return {
    OPEN: 0,
    IN_PROGRESS: 0,
    PENDING_VERIFICATION: 0,
    CLOSED: 0,
  };
}

function emptyCategoryRow(): Record<SafetyCategory, number> {
  return { UNSAFE_CONDITION: 0, UNSAFE_ACT: 0, NEAR_MISS: 0 };
}

function isKnownStatus(value: string): value is FindingStatus {
  return FINDING_STATUSES.includes(value as FindingStatus);
}

function isKnownRisk(value: string | null): value is RiskLevel {
  return value != null && RISK_LEVELS.includes(value as RiskLevel);
}

function isKnownCategory(value: string | null): value is SafetyCategory {
  return value != null && SAFETY_CATEGORIES.includes(value as SafetyCategory);
}

/** Pure derivation for BOD dashboard metrics from persisted finding fields. */
export function calculateDashboardMetrics(
  findings: DashboardFinding[],
  now = new Date(),
) {
  const valid = findings.filter((finding) => finding.isValid);
  const active = valid.filter((finding) => finding.status !== "CLOSED");
  const closed = valid.filter(
    (finding) => finding.status === "CLOSED" && finding.closedAt,
  );
  const slaEligible = closed.filter((finding) => finding.dueDate);
  const onTime = slaEligible.filter((finding) =>
    closedOnOrBeforeDueDayWib(finding.dueDate, finding.closedAt),
  ).length;

  const closeDays = closed
    .map((finding) => elapsedDays(finding.createdAt, finding.closedAt!))
    .sort((a, b) => a - b);
  const middle = Math.floor(closeDays.length / 2);
  const medianCloseDays = closeDays.length
    ? closeDays.length % 2
      ? closeDays[middle]
      : (closeDays[middle - 1] + closeDays[middle]) / 2
    : null;

  const ages = active.map((finding) => elapsedDays(finding.createdAt, now));
  const funnel = emptyStatusRow();
  const riskByStatus = Object.fromEntries(
    RISK_LEVELS.map((risk) => [risk, emptyStatusRow()]),
  ) as Record<RiskLevel, Record<FindingStatus, number>>;
  const riskByCategory = Object.fromEntries(
    RISK_LEVELS.map((risk) => [risk, emptyCategoryRow()]),
  ) as Record<RiskLevel, Record<SafetyCategory, number>>;

  for (const finding of valid) {
    if (isKnownStatus(finding.status)) funnel[finding.status]++;
    if (isKnownRisk(finding.riskLevel)) {
      if (isKnownStatus(finding.status)) {
        riskByStatus[finding.riskLevel][finding.status]++;
      }
      if (isKnownCategory(finding.safetyCategory)) {
        riskByCategory[finding.riskLevel][finding.safetyCategory]++;
      }
    }
  }

  return {
    active: active.length,
    criticalActive: active.filter(
      (finding) => finding.riskLevel === "CRITICAL",
    ).length,
    overdueCritical: active.filter(
      (finding) =>
        finding.riskLevel === "CRITICAL" &&
        finding.dueDate != null &&
        finding.dueDate < now,
    ).length,
    onTimeRate: slaEligible.length
      ? Math.round((onTime / slaEligible.length) * 100)
      : null,
    medianCloseDays,
    backlogAging: {
      under7: ages.filter((age) => age < 7).length,
      days7to14: ages.filter((age) => age >= 7 && age <= 14).length,
      over14: ages.filter((age) => age > 14).length,
    },
    funnel,
    riskByStatus,
    riskByCategory,
  };
}

/** Pure audit progress for the selected reporting period. */
export function calculateAuditProgress(
  audits: AuditObservation[],
  activeAreas: number,
) {
  const submitted = audits.filter((audit) => audit.status === "SUBMITTED").length;
  const coveredAreas = new Set(audits.map((audit) => audit.areaId)).size;

  return {
    scheduled: audits.length,
    submitted,
    completionRate: audits.length
      ? Math.round((submitted / audits.length) * 100)
      : null,
    coveredAreas,
    activeAreas,
    coverageRate: activeAreas
      ? Math.round((coveredAreas / activeAreas) * 100)
      : null,
  };
}

type DepartmentMetric = {
  code: string;
  name: string;
  closed: number;
  open: number;
  onTimeRatio: number | null;
  avg5s: number | null;
};

/** Rank using only observed dimensions; no invented neutral fallback. */
export function rankDepartments(rows: DepartmentMetric[]) {
  return rows
    .map((row) => {
      const dimensions = [
        row.onTimeRatio == null ? null : row.onTimeRatio * 100,
        row.avg5s,
      ].filter((value): value is number => value != null);
      return {
        ...row,
        composite: dimensions.length
          ? dimensions.reduce((sum, value) => sum + value, 0) /
            dimensions.length
          : null,
      };
    })
    .sort((a, b) => {
      if (a.composite == null) return b.composite == null ? 0 : 1;
      if (b.composite == null) return -1;
      return b.composite - a.composite;
    });
}

/** Numeric narrative only; null explicitly remains unavailable rather than invented. */
export function createSafetyPulse(input: {
  active: number;
  criticalActive: number;
  overdueCritical: number;
  onTimeRate: number | null;
  auditCompletionRate: number | null;
}) {
  const sla =
    input.onTimeRate == null
      ? "SLA belum tersedia karena belum ada temuan selesai dengan target."
      : `Ketepatan waktu penyelesaian ${input.onTimeRate}%.`;
  const audits =
    input.auditCompletionRate == null
      ? "Progres audit periode ini belum tersedia."
      : `Penyelesaian audit periode ini ${input.auditCompletionRate}%.`;

  return `${input.active} temuan aktif, ${input.criticalActive} kritis dan ${input.overdueCritical} melewati target. ${sla} ${audits}`;
}
