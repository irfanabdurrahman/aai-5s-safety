import { describe, expect, it } from "vitest";
import {
  buildLiveWallLeaderboard,
  chunkLiveWall,
  liveWallPhotoUrl,
  liveWallSceneRows,
  liveWallSlaState,
  sortLiveWall,
} from "./live-wall";

const item = (id: string, riskLevel: string | null, createdAt: string) => ({
  id,
  riskLevel,
  createdAt,
});

const contribution = (
  id: string,
  reporterId: string,
  status: string,
  dueDate: string | null,
  closedAt: string | null,
  isValid = true,
) => ({
  id,
  isValid,
  status,
  dueDate,
  closedAt,
  reporter: {
    id: reporterId,
    name: reporterId === "u1" ? "Ayu" : "Bima",
    department: { code: reporterId === "u1" ? "HSE" : "OPS" },
  },
  area: {
    department: {
      id: reporterId === "u1" ? "d1" : "d2",
      code: reporterId === "u1" ? "HSE" : "OPS",
      name: reporterId === "u1" ? "Health & Safety" : "Operations",
    },
  },
});

describe("Live Wall helpers", () => {
  it("sorts deterministically by risk then newest then id", () =>
    expect(
      sortLiveWall([
        item("a", "LOW", "2026-01-02"),
        item("b", "CRITICAL", "2026-01-01"),
        item("c", "CRITICAL", "2026-01-01"),
      ]).map((x) => x.id),
    ).toEqual(["b", "c", "a"]));

  it("chunks scenes without losing finding bindings", () =>
    expect(
      chunkLiveWall(
        [
          item("a", null, "2026-01-01"),
          item("b", null, "2026-01-01"),
          item("c", null, "2026-01-01"),
        ],
        2,
      ).map((x) => x.map((y) => y.id)),
    ).toEqual([["a", "b"], ["c"]]));

  it("never copies kiosk credentials into photo URLs", () => {
    expect(liveWallPhotoUrl("findings/a.jpg")).toBe(
      "/api/files/findings/a.jpg",
    );
  });

  it("uses actual active-scene item count for deterministic grid rows", () => {
    expect(liveWallSceneRows(9, 9)).toBe(3);
    expect(liveWallSceneRows(9, 2)).toBe(1);
    expect(liveWallSceneRows(6, 4)).toBe(2);
    expect(liveWallSceneRows(4, 1)).toBe(1);
  });

  it("centralizes Live Wall SLA state on the WIB due-day boundary", () => {
    expect(
      liveWallSlaState(
        "2026-07-10T00:00:00.000Z",
        "2026-07-10T16:59:59.000Z",
        "2026-07-11T00:00:00.000Z",
      ),
    ).toBe("ON_TIME");
    expect(
      liveWallSlaState(
        "2026-07-10T00:00:00.000Z",
        "2026-07-10T17:00:00.000Z",
        "2026-07-11T00:00:00.000Z",
      ),
    ).toBe("LATE");
  });

  it("uses the WIB end of a due date as the on-time boundary", () => {
    const result = buildLiveWallLeaderboard([
      contribution(
        "late-evening",
        "u1",
        "CLOSED",
        "2026-07-10T00:00:00.000Z",
        "2026-07-10T18:00:00.000Z",
      ),
    ]);

    expect(result.reporters[0]).toEqual(
      expect.objectContaining({ closedCount: 1, onTimeCount: 0, score: 15 }),
    );
  });

  it("ranks only valid contributions and adds closure and on-time bonuses", () => {
    const result = buildLiveWallLeaderboard([
      contribution("1", "u1", "CLOSED", "2026-07-10", "2026-07-10"),
      contribution("2", "u1", "CLOSED", "2026-07-10", "2026-07-12"),
      contribution("3", "u2", "OPEN", null, null),
      contribution("spam", "u2", "CLOSED", null, "2026-07-01", false),
    ]);

    expect(result.reporters).toEqual([
      expect.objectContaining({
        rank: 1,
        name: "Ayu",
        validCount: 2,
        closedCount: 2,
        onTimeCount: 1,
        score: 35,
      }),
      expect.objectContaining({
        rank: 2,
        name: "Bima",
        validCount: 1,
        closedCount: 0,
        onTimeCount: 0,
        score: 10,
      }),
    ]);
    expect(result.departments[0]).toEqual(
      expect.objectContaining({
        code: "HSE",
        validCount: 2,
        closureRate: 1,
        onTimeRate: 0.5,
      }),
    );
  });
});