import { describe, expect, it } from "vitest";
import { scheduleSchema, firstOccurrence } from "./schedule";

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
});
