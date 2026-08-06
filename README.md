# AAI 5S & Safety

Aplikasi **5S & Safety Finding** untuk PT Akebono Brake Astra Indonesia — lapor
temuan bahaya dari HP, audit patrol 5S dengan checklist & skor, dan tindak lanjut
sampai closed dengan verifikasi supervisor.

## Fitur

- **Lapor Temuan Safety** — foto → kategori (kondisi/tindakan tidak aman, near miss)
  → tingkat risiko → kirim. Kurang dari 1 menit dari HP.
- **Audit 5S** — checklist Ringkas·Rapi·Resik·Rawat·Rajin (25 kriteria, skor 0–4),
  autosave per kriteria, skor ≤2 bisa langsung dijadikan temuan. Jadwal mingguan/bulanan otomatis.
- **Workflow tindak lanjut** — Terbuka → Dikerjakan (PIC + target) → Verifikasi →
  Selesai. Foto before/after wajib, verifikator ≠ PIC, riwayat lengkap.
- **Eskalasi otomatis** — notifikasi H-1, terlambat, dan eskalasi ≥3 hari ke admin.
- **Dashboard manajemen** — KPI, tren 8 minggu, skor 5S per area, peringkat departemen.
- **Leaderboard** pelapor teraktif + **TV mode** kiosk untuk layar pabrik.
- **Export CSV** temuan & audit untuk laporan P2K3.

## Stack

Next.js 16 (App Router, Server Actions) · Tailwind CSS 4 · PostgreSQL + Prisma 7 ·
JWT session (jose) + bcrypt · Docker.

## Menjalankan (dev)

```bash
cp .env.example .env   # isi DATABASE_URL, SESSION_SECRET, dll
npm install
npx prisma migrate dev
npx tsx prisma/seed.ts        # master data + akun dasar
npx tsx prisma/seed-areas.ts  # master data aktual Plant Karawang: Dept P1–P4 → area → line
npx tsx prisma/seed-demo.ts   # opsional: data demo historis
npm run dev
```

## Akun demo (password: `akebono123`)

| NPK | Nama | Role |
|---|---|---|
| 10001 | Budi Santoso | Admin EHS |
| 20001 | Rina Kartika | Supervisor (Disc) |
| 30001 | Agus Wibowo | PIC Area (Disc) |
| 40001 | Dedi Kurniawan | Karyawan |

## Role

- **Karyawan** — lapor temuan, lihat feed & leaderboard.
- **PIC Area** — kerjakan perbaikan (ambil tugas, foto after, kirim verifikasi).
- **Supervisor** — tugaskan PIC, verifikasi/tolak perbaikan, dashboard.
- **Admin EHS** — semua di atas + master data, checklist, jadwal audit, export.

## Deploy

Docker multi-stage (`Dockerfile`), `prisma migrate deploy` jalan otomatis saat start.
Mount volume persisten ke `/app/uploads` untuk foto. Env wajib: `DATABASE_URL`,
`SESSION_SECRET`, `CRON_SECRET`, `TV_TOKEN`.

Job harian (notifikasi due/overdue + materialisasi audit terjadwal) berjalan
otomatis jam 06:00 WIB, atau manual:

```bash
curl -X POST -H "x-cron-secret: $CRON_SECRET" https://<host>/api/cron/run
```
