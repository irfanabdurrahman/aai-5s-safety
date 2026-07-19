/* Konvensi tanggal aplikasi:
   - Kolom @db.Date (dueDate, scheduledDate) & startDate disimpan sebagai
     UTC-midnight dari TANGGAL KALENDER WIB yang dimaksud (Postgres DATE
     memotong komponen tanggal dalam UTC — jangan pernah tulis offset +07:00).
   - Timestamp asli (createdAt, closedAt) tetap waktu sebenarnya; batas harian
     WIB untuk filter timestamp pakai wibDayStart(). */

const WIB_TZ = "Asia/Jakarta";

/** "YYYY-MM-DD" tanggal kalender hari ini menurut WIB. */
export function wibTodayStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: WIB_TZ });
}

/** Parse "YYYY-MM-DD" menjadi UTC-midnight (representasi kolom DATE). */
export function parseDateOnly(s: string): Date {
  return new Date(s + "T00:00:00Z");
}

/** Tanggal WIB hari ini sebagai UTC-midnight — pembanding untuk kolom DATE. */
export function wibToday(): Date {
  return parseDateOnly(wibTodayStr());
}

/** ISO day-of-week (1=Senin..7=Minggu) untuk tanggal WIB hari ini. */
export function wibDow(): number {
  return ((wibToday().getUTCDay() + 6) % 7) + 1;
}

/** Tanggal dalam bulan (1..31) menurut WIB hari ini. */
export function wibDayOfMonth(): number {
  return wibToday().getUTCDate();
}

/** Momen 00:00 WIB dari tanggal "YYYY-MM-DD" — batas filter untuk timestamp. */
export function wibDayStart(s: string): Date {
  return new Date(s + "T00:00:00+07:00");
}

/** Momen 00:00 WIB setelah tanggal DATE berakhir. */
export function endOfDueDayWib(date: Date | string): Date {
  const due = new Date(date);
  const dateOnly = due.toISOString().slice(0, 10);
  const nextDate = addDays(parseDateOnly(dateOnly), 1).toISOString().slice(0, 10);
  return wibDayStart(nextDate);
}

export function closedOnOrBeforeDueDayWib(
  dueDate: Date | string | null,
  closedAt: Date | string | null,
): boolean {
  if (!dueDate || !closedAt) return false;
  return new Date(closedAt) < endOfDueDayWib(dueDate);
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

/** "YYYY-MM-DD" dari Date UTC-midnight. */
export function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}
