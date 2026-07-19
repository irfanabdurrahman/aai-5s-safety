import {
  closedOnOrBeforeDueDayWib,
  endOfDueDayWib,
} from "./dates";

const RISK_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export type LiveWallContribution = {
  id: string;
  isValid: boolean;
  status: string;
  dueDate: string | Date | null;
  closedAt: string | Date | null;
  reporter: {
    id: string;
    name: string;
    department: { code: string } | null;
  };
  area: {
    department: { id: string; code: string; name: string };
  };
};

export type ReporterStanding = {
  rank: number;
  id: string;
  name: string;
  departmentCode: string | null;
  validCount: number;
  closedCount: number;
  onTimeCount: number;
  score: number;
};

export type DepartmentStanding = {
  rank: number;
  id: string;
  code: string;
  name: string;
  validCount: number;
  closedCount: number;
  onTimeCount: number;
  closureRate: number;
  onTimeRate: number | null;
  score: number;
};

export function sortLiveWall<
  T extends { id: string; riskLevel: string | null; createdAt: string | Date },
>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      (RISK_ORDER[a.riskLevel ?? ""] ?? 4) -
        (RISK_ORDER[b.riskLevel ?? ""] ?? 4) ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
      a.id.localeCompare(b.id),
  );
}

export function chunkLiveWall<T>(items: T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error("Ukuran scene harus positif");
  }
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

export function liveWallSceneRows(sceneSize: number, itemCount: number): number {
  const columns = sceneSize >= 6 ? 3 : sceneSize >= 4 ? 2 : 1;
  return Math.max(1, Math.ceil(itemCount / columns));
}

export type LiveWallSlaState =
  | "NO_DUE_DATE"
  | "ON_TIME"
  | "LATE"
  | "OVERDUE"
  | "PENDING";

export function liveWallSlaState(
  dueDate: Date | string | null,
  closedAt: Date | string | null,
  asOf: Date | string,
): LiveWallSlaState {
  if (!dueDate) return "NO_DUE_DATE";
  if (closedAt) {
    return closedOnOrBeforeDueDayWib(dueDate, closedAt) ? "ON_TIME" : "LATE";
  }
  return new Date(asOf) >= endOfDueDayWib(dueDate) ? "OVERDUE" : "PENDING";
}

export function liveWallPhotoUrl(path: string): string {
  return `/api/files/${path}`;
}

/**
 * Quality-weighted monthly standings. Invalid/duplicate findings score nothing;
 * each valid contribution earns 10 points, verified closure 5, and on-time
 * closure another 5. The closure bonuses prevent raw report volume becoming
 * the only route to recognition.
 */
export function buildLiveWallLeaderboard(
  contributions: LiveWallContribution[],
): {
  reporters: ReporterStanding[];
  departments: DepartmentStanding[];
} {
  const reporterMap = new Map<string, Omit<ReporterStanding, "rank">>();
  const departmentMap = new Map<
    string,
    Omit<DepartmentStanding, "rank" | "closureRate" | "onTimeRate" | "score">
  >();

  for (const finding of contributions) {
    if (!finding.isValid) continue;
    const isClosed = finding.status === "CLOSED" && !!finding.closedAt;
    const isOnTime =
      isClosed && closedOnOrBeforeDueDayWib(finding.dueDate, finding.closedAt);

    const reporter = reporterMap.get(finding.reporter.id) ?? {
      id: finding.reporter.id,
      name: finding.reporter.name,
      departmentCode: finding.reporter.department?.code ?? null,
      validCount: 0,
      closedCount: 0,
      onTimeCount: 0,
      score: 0,
    };
    reporter.validCount += 1;
    reporter.closedCount += isClosed ? 1 : 0;
    reporter.onTimeCount += isOnTime ? 1 : 0;
    reporter.score += 10 + (isClosed ? 5 : 0) + (isOnTime ? 5 : 0);
    reporterMap.set(finding.reporter.id, reporter);

    const department = finding.area.department;
    const team = departmentMap.get(department.id) ?? {
      id: department.id,
      code: department.code,
      name: department.name,
      validCount: 0,
      closedCount: 0,
      onTimeCount: 0,
    };
    team.validCount += 1;
    team.closedCount += isClosed ? 1 : 0;
    team.onTimeCount += isOnTime ? 1 : 0;
    departmentMap.set(department.id, team);
  }

  const reporters = [...reporterMap.values()]
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.onTimeCount - a.onTimeCount ||
        b.closedCount - a.closedCount ||
        a.name.localeCompare(b.name, "id"),
    )
    .map((entry, index) => ({ rank: index + 1, ...entry }));

  const departments = [...departmentMap.values()]
    .map((entry) => {
      const closureRate = entry.closedCount / entry.validCount;
      const onTimeRate = entry.closedCount
        ? entry.onTimeCount / entry.closedCount
        : null;
      return {
        ...entry,
        closureRate,
        onTimeRate,
        score: Math.round(
          (closureRate * 60 + (onTimeRate ?? 0) * 40) * 10,
        ) / 10,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.closedCount - a.closedCount ||
        a.name.localeCompare(b.name, "id"),
    )
    .map((entry, index) => ({ rank: index + 1, ...entry }));

  return { reporters, departments };
}
