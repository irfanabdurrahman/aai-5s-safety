import { z } from "zod";

export const scheduleSchema = z
  .object({
    areaId: z.string().min(1, "Pilih area"),
    auditorId: z.string().min(1, "Pilih auditor"),
    frequency: z.enum(["WEEKLY", "MONTHLY", "ONCE"]),
    dayOfWeek: z.coerce.number().int().min(1).max(7).optional(),
    dayOfMonth: z.coerce.number().int().min(1).max(28).optional(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal mulai wajib"),
  })
  .superRefine((value, context) => {
    if (value.frequency === "WEEKLY" && !value.dayOfWeek) {
      context.addIssue({
        code: "custom",
        message: "Hari wajib untuk jadwal mingguan",
        path: ["dayOfWeek"],
      });
    }
    if (value.frequency === "MONTHLY" && !value.dayOfMonth) {
      context.addIssue({
        code: "custom",
        message: "Tanggal wajib untuk jadwal bulanan",
        path: ["dayOfMonth"],
      });
    }
  });

type ScheduleRule = {
  frequency: "WEEKLY" | "MONTHLY" | "ONCE";
  startDate: string | Date;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
};

function dateOnly(value: string | Date): Date {
  const date = typeof value === "string" ? new Date(`${value}T00:00:00.000Z`) : value;
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function wibDateOnly(value: Date): Date {
  const calendarDate = value.toLocaleDateString("en-CA", {
    timeZone: "Asia/Jakarta",
  });
  return new Date(`${calendarDate}T00:00:00.000Z`);
}

export function effectiveScheduleStart(
  requestedStart: string | Date,
  createdOn: Date,
): Date {
  const requested = dateOnly(requestedStart);
  const created = wibDateOnly(createdOn);
  return requested > created ? requested : created;
}

export function scheduleCreationDates(
  rule: ScheduleRule,
  createdAt: Date,
) {
  const startDate = effectiveScheduleStart(rule.startDate, createdAt);
  return {
    createdAt,
    startDate,
    firstDate: firstOccurrence({ ...rule, startDate }),
  };
}

export function firstOccurrence(rule: ScheduleRule): Date {
  const date = dateOnly(rule.startDate);
  if (rule.frequency === "WEEKLY") {
    const target = (rule.dayOfWeek ?? 1) % 7;
    date.setUTCDate(
      date.getUTCDate() + ((target - date.getUTCDay() + 7) % 7),
    );
  } else if (rule.frequency === "MONTHLY") {
    const target = rule.dayOfMonth ?? 1;
    if (date.getUTCDate() > target) {
      date.setUTCDate(1);
      date.setUTCMonth(date.getUTCMonth() + 1);
    }
    date.setUTCDate(target);
  }
  return date;
}

function nextOccurrence(rule: ScheduleRule, current: Date): Date | null {
  if (rule.frequency === "ONCE") return null;
  const next = new Date(current);
  if (rule.frequency === "WEEKLY") {
    next.setUTCDate(next.getUTCDate() + 7);
  } else {
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + 1);
    next.setUTCDate(rule.dayOfMonth ?? 1);
  }
  return next;
}

/**
 * Return every due occurrence after lastOccurrence through the supplied date.
 * The stored startDate is the effective creation/start boundary, so this catches
 * up scheduler outages without inventing historical obligations.
 */
export function occurrencesThrough(
  rule: ScheduleRule,
  lastOccurrence: Date | null,
  throughDate: Date,
): Date[] {
  const through = dateOnly(throughDate);
  const lowerBound = lastOccurrence ? dateOnly(lastOccurrence) : null;
  const occurrences: Date[] = [];
  let current: Date | null = firstOccurrence(rule);

  // 10 years of weekly recurrences is well above a realistic catch-up window
  // and provides a fail-closed guard against malformed recurrence arithmetic.
  for (let count = 0; current && count < 600; count++) {
    if (current > through) break;
    if (!lowerBound || current > lowerBound) occurrences.push(new Date(current));
    current = nextOccurrence(rule, current);
  }
  if (current && current <= through) {
    throw new Error("Rentang catch-up jadwal melebihi batas aman");
  }
  return occurrences;
}

export function missingOccurrencesThrough(
  rule: ScheduleRule,
  existingOccurrences: Date[],
  throughDate: Date,
): Date[] {
  if (rule.frequency === "ONCE" && existingOccurrences.length > 0) return [];
  const existing = [...existingOccurrences].sort(
    (a, b) => a.getTime() - b.getTime(),
  );
  const existingKeys = new Set(
    existing.map((date) => dateOnly(date).toISOString().slice(0, 10)),
  );
  return occurrencesThrough(rule, null, throughDate).filter(
    (date) => !existingKeys.has(date.toISOString().slice(0, 10)),
  );
}
