import { describe, expect, it } from "vitest";
import {
  calculateAuditProgress,
  calculateDashboardMetrics,
  createSafetyPulse,
  rankDepartments,
} from "./dashboard-metrics";

describe("calculateDashboardMetrics", () => {
  it("derives SLA, critical, median close, aging and funnel without synthetic data", () => {
    const now = new Date("2026-07-20T00:00:00Z");
    const metrics = calculateDashboardMetrics(
      [
        {
          status: "CLOSED",
          riskLevel: "HIGH",
          safetyCategory: "UNSAFE_CONDITION",
          createdAt: new Date("2026-07-10T00:00:00Z"),
          closedAt: new Date("2026-07-12T00:00:00Z"),
          dueDate: new Date("2026-07-13T00:00:00Z"),
          isValid: true,
        },
        {
          status: "OPEN",
          riskLevel: "CRITICAL",
          safetyCategory: "NEAR_MISS",
          createdAt: new Date("2026-07-01T00:00:00Z"),
          closedAt: null,
          dueDate: new Date("2026-07-10T00:00:00Z"),
          isValid: true,
        },
        {
          status: "IN_PROGRESS",
          riskLevel: "LOW",
          safetyCategory: null,
          createdAt: new Date("2026-07-19T00:00:00Z"),
          closedAt: null,
          dueDate: new Date("2026-07-25T00:00:00Z"),
          isValid: true,
        },
      ],
      now,
    );

    expect(metrics.criticalActive).toBe(1);
    expect(metrics.overdueCritical).toBe(1);
    expect(metrics.onTimeRate).toBe(100);
    expect(metrics.medianCloseDays).toBe(2);
    expect(metrics.backlogAging.over14).toBe(1);
    expect(metrics.funnel.OPEN).toBe(1);
  });

  it("uses midnight WIB, not UTC midnight, as the due-day boundary", () => {
    const base = {
      status: "CLOSED",
      riskLevel: "MEDIUM",
      safetyCategory: "UNSAFE_ACT",
      createdAt: new Date("2026-07-18T00:00:00Z"),
      dueDate: new Date("2026-07-20T00:00:00Z"),
      isValid: true,
    };
    const metrics = calculateDashboardMetrics(
      [
        { ...base, closedAt: new Date("2026-07-20T16:59:59Z") },
        { ...base, closedAt: new Date("2026-07-20T17:00:01Z") },
      ],
      new Date("2026-07-21T00:00:00Z"),
    );

    expect(metrics.onTimeRate).toBe(50);
  });

  it("builds risk by status and category matrices from valid findings only", () => {
    const base = {
      createdAt: new Date("2026-07-01T00:00:00Z"),
      closedAt: null,
      dueDate: null,
      isValid: true,
    };
    const metrics = calculateDashboardMetrics(
      [
        {
          ...base,
          status: "OPEN",
          riskLevel: "CRITICAL",
          safetyCategory: "NEAR_MISS",
        },
        {
          ...base,
          status: "CLOSED",
          closedAt: new Date("2026-07-02T00:00:00Z"),
          riskLevel: "CRITICAL",
          safetyCategory: "NEAR_MISS",
        },
        {
          ...base,
          status: "IN_PROGRESS",
          riskLevel: "HIGH",
          safetyCategory: "UNSAFE_CONDITION",
          isValid: false,
        },
      ],
      new Date("2026-07-20T00:00:00Z"),
    );

    expect(metrics.riskByStatus.CRITICAL).toEqual({
      OPEN: 1,
      IN_PROGRESS: 0,
      PENDING_VERIFICATION: 0,
      CLOSED: 1,
    });
    expect(metrics.riskByCategory.CRITICAL.NEAR_MISS).toBe(2);
    expect(metrics.riskByCategory.HIGH.UNSAFE_CONDITION).toBe(0);
  });
});

describe("calculateAuditProgress", () => {
  it("derives scheduled completion and active-area coverage", () => {
    const progress = calculateAuditProgress(
      [
        { areaId: "a", status: "SUBMITTED" },
        { areaId: "a", status: "SUBMITTED" },
        { areaId: "b", status: "SCHEDULED" },
      ],
      ["a", "b", "c", "d"],
    );

    expect(progress).toEqual({
      scheduled: 3,
      submitted: 2,
      completionRate: 67,
      coveredAreas: 1,
      activeAreas: 4,
      coverageRate: 25,
    });
  });

  it("returns null rates when a denominator has no observations", () => {
    expect(calculateAuditProgress([], [])).toEqual({
      scheduled: 0,
      submitted: 0,
      completionRate: null,
      coveredAreas: 0,
      activeAreas: 0,
      coverageRate: null,
    });
  });

  it("counts only touched active areas and keeps the cohort at or below 100%", () => {
    expect(
      calculateAuditProgress(
        [
          { areaId: "scheduled-only", status: "SCHEDULED" },
          { areaId: "active", status: "IN_PROGRESS" },
          { areaId: "retired", status: "SUBMITTED" },
        ],
        ["scheduled-only", "active"],
      ),
    ).toEqual({
      scheduled: 3,
      submitted: 1,
      completionRate: 33,
      coveredAreas: 1,
      activeAreas: 2,
      coverageRate: 50,
    });
  });
});

describe("rankDepartments", () => {
  it("ranks only from available dimensions without neutral placeholder scores", () => {
    const rows = rankDepartments([
      {
        code: "A",
        name: "Alpha",
        closed: 2,
        open: 1,
        onTimeRatio: 1,
        avg5s: null,
      },
      {
        code: "B",
        name: "Beta",
        closed: 2,
        open: 1,
        onTimeRatio: null,
        avg5s: 80,
      },
      {
        code: "C",
        name: "No data",
        closed: 0,
        open: 0,
        onTimeRatio: null,
        avg5s: null,
      },
    ]);

    expect(rows.map((row) => row.code)).toEqual(["A", "B", "C"]);
    expect(rows[0].composite).toBe(100);
    expect(rows[1].composite).toBe(80);
    expect(rows[2].composite).toBeNull();
  });
});

describe("createSafetyPulse", () => {
  it("produces a numeric narrative and preserves unavailable rates", () => {
    const pulse = createSafetyPulse({
      active: 9,
      criticalActive: 2,
      overdueCritical: 1,
      onTimeRate: null,
      auditCompletionRate: 75,
    });

    expect(pulse).toContain("9 temuan aktif");
    expect(pulse).toContain("2 kritis");
    expect(pulse).toContain("1 melewati target");
    expect(pulse).toContain("SLA belum tersedia");
    expect(pulse).toContain("75%");
  });
});
