/** CSV sederhana dengan escaping benar; delimiter ; agar Excel ID langsung rapi. */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    const raw = v == null ? "" : String(v);
    // Excel/LibreOffice formula injection: preserve displayed text as literal data.
    const s = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(";")];
  for (const row of rows) lines.push(row.map(esc).join(";"));
  // BOM agar Excel membaca UTF-8 dengan benar
  return "﻿" + lines.join("\r\n");
}
