import { describe, expect, it } from "vitest";
import {
  effectiveScheduleStart,
  firstOccurrence,
  missingOccurrencesThrough,
  scheduleCreationDates,
  occurrencesThrough,
  scheduleSchema,
} from "./schedule";

describe("schedule validation", () => {
  it("requires the frequency-specific day", () => {
    expect(scheduleSchema.safeParse({ areaId:"a", auditorId:"u", frequency:"WEEKLY", startDate:"2026-07-20" }).success).toBe(false);
    expect(scheduleSchema.safeParse({ areaId:"a", auditorId:"u", frequency:"MONTHLY", startDate:"2026-07-20" }).success).toBe(false);
    expect(scheduleSchema.safeParse({ areaId:"a", auditorId:"u", frequency:"ONCE", startDate:"2026-07-20" }).success).toBe(true);
  });
  it("moves first weekly occurrence to the selected weekday", () => expect(firstOccurrence({ frequency:"WEEKLY", dayOfWeek:5, startDate:"2026-07-20" }).toISOString().slice(0,10)).toBe("2026-07-24"));

  it.each([
    ["2026-01-31", "2026-02-28"],
    ["2026-03-31", "2026-04-28"],
  ])(
    "moves a late-month start %s to day 28 of the immediate next month",
    (startDate, expected) => {
      expect(
        firstOccurrence({
          frequency: "MONTHLY",
          dayOfMonth: 28,
          startDate,
        }).toISOString().slice(0, 10),
      ).toBe(expected);
    },
  );

  it("catches up monthly and weekly occurrences after a missed job day", () => {
    expect(
      occurrencesThrough(
        {
          frequency: "MONTHLY",
          dayOfMonth: 20,
          startDate: "2026-06-20",
        },
        new Date("2026-06-20T00:00:00Z"),
        new Date("2026-07-21T00:00:00Z"),
      ).map((date) => date.toISOString().slice(0, 10)),
    ).toEqual(["2026-07-20"]);

    expect(
      occurrencesThrough(
        {
          frequency: "WEEKLY",
          dayOfWeek: 1,
          startDate: "2026-07-06",
        },
        new Date("2026-07-06T00:00:00Z"),
        new Date("2026-07-21T00:00:00Z"),
      ).map((date) => date.toISOString().slice(0, 10)),
    ).toEqual(["2026-07-13", "2026-07-20"]);
  });

  it("never emits an occurrence before the effective start date", () => {
    expect(
      occurrencesThrough(
        {
          frequency: "WEEKLY",
          dayOfWeek: 1,
          startDate: "2026-07-21",
        },
        null,
        new Date("2026-07-20T00:00:00Z"),
      ),
    ).toEqual([]);
  });

  it("normalizes a past start to creation day instead of creating historical backfill", () => {
    expect(
      effectiveScheduleStart(
        "2026-01-01",
        new Date("2026-07-19T00:00:00Z"),
      ).toISOString().slice(0, 10),
    ).toBe("2026-07-19");
  });

  it("uses the calendar date in WIB for a creation timestamp", () => {
    expect(
      effectiveScheduleStart(
        "2026-01-01",
        new Date("2026-07-18T18:00:00Z"),
      ).toISOString().slice(0, 10),
    ).toBe("2026-07-19");
  });

  it("derives persisted start and first occurrence from the same creation timestamp", () => {
    const createdAt = new Date("2026-07-19T17:00:01Z");
    const dates = scheduleCreationDates(
      {
        frequency: "ONCE",
        startDate: "2026-07-19",
      },
      createdAt,
    );

    expect(dates.createdAt).toBe(createdAt);
    expect(dates.startDate.toISOString().slice(0, 10)).toBe("2026-07-20");
    expect(dates.firstDate.toISOString().slice(0, 10)).toBe("2026-07-20");
  });

  it("fills an internal missed occurrence without duplicating existing dates", () => {
    expect(
      missingOccurrencesThrough(
        {
          frequency: "MONTHLY",
          dayOfMonth: 20,
          startDate: "2026-06-20",
        },
        [
          new Date("2026-06-20T00:00:00Z"),
          new Date("2026-08-20T00:00:00Z"),
        ],
        new Date("2026-08-21T00:00:00Z"),
      ).map((date) => date.toISOString().slice(0, 10)),
    ).toEqual(["2026-07-20"]);
  });

  it("fills leading gaps from the effective boundary", () => {
    expect(
      missingOccurrencesThrough(
        {
          frequency: "WEEKLY",
          dayOfWeek: 1,
          startDate: "2026-07-06",
        },
        [new Date("2026-07-20T00:00:00Z")],
        new Date("2026-07-21T00:00:00Z"),
      ).map((date) => date.toISOString().slice(0, 10)),
    ).toEqual(["2026-07-06", "2026-07-13"]);
  });

  it("never repeats an ONCE schedule that already has any occurrence", () => {
    expect(
      missingOccurrencesThrough(
        {
          frequency: "ONCE",
          startDate: "2026-07-19",
        },
        [new Date("2026-01-01T00:00:00Z")],
        new Date("2026-07-20T00:00:00Z"),
      ),
    ).toEqual([]);
  });
});
