# AAI 5S & Safety

Aplikasi 5S & Safety Finding PT Akebono Brake Astra Indonesia untuk pelaporan bahaya dari HP, audit patrol 5S, tindak lanjut berbasis risiko, verifikasi independen, dan monitoring eksekutif.

## Fitur utama

- **Lapor Temuan Safety** — foto, kategori, risiko, area/line, dan deskripsi.
- **Audit 5S** — checklist Ringkas · Rapi · Resik · Rawat · Rajin, autosave skor, audit terjadwal/ad-hoc, serta finding dari kriteria rendah.
- **Workflow tindak lanjut** — Terbuka → Dikerjakan → Menunggu Verifikasi → Selesai, dengan foto before/after dan riwayat status.
- **Dashboard BOD** — critical exposure, SLA on-time, median closure, audit completion, backlog aging, status funnel, risk matrix, tren 8 minggu, skor area, performa departemen, dan escalation queue.
- **Safety & 5S Live Wall** — grid 6 kartu desktop/9 ultrawide, rotasi otomatis per scene, fallback media, keyboard/fullscreen controls, leaderboard kontribusi valid dan performa tim.
- **Notifikasi dan eskalasi** — H-1, overdue, escalation, verification, dan audit due.
- **Export CSV** — scope admin/supervisor sesuai departemen dan proteksi formula injection.

## Stack

Next.js 16 App Router · React 19 · Tailwind CSS 4 · PostgreSQL · Prisma 7 · JWT jose · bcrypt · Docker.

## Menjalankan lokal

```bash
npm ci
npx prisma generate
npm test
npm run typecheck
npm run lint
npm run dev
```

Environment minimum:

```text
DATABASE_URL=postgresql://...
SESSION_SECRET=<random kuat>
CRON_SECRET=<random kuat>
TV_TOKEN=<random kuat>
UPLOAD_DIR=./uploads
```

Seed tidak mempunyai password bawaan. Untuk environment development baru, berikan password seed secara eksplisit dan jangan gunakan pada production:

```bash
SEED_PASSWORD='<minimal-12-karakter>' npx tsx prisma/seed.ts
SEED_PASSWORD='<minimal-12-karakter>' npx tsx prisma/seed-demo.ts
```

## Keamanan akun

- Akun baru dan reset password menerima password sementara acak unik.
- Password sementara hanya ditampilkan sekali kepada admin.
- Pengguna wajib mengganti password saat login pertama.
- Minimum password 12 karakter.
- Reset/ganti password, perubahan role/departemen, dan nonaktivasi akun mencabut sesi lama melalui `sessionVersion`.
- Login dibatasi atomik di PostgreSQL dengan bucket hash per akun dan per IP, sehingga konsisten pada deployment multi-replica tanpa menyimpan NPK/IP mentah.

## Quality gates

```bash
npm test
npm run typecheck
npm run lint
DATABASE_URL='postgresql://build:build@127.0.0.1:5432/build' \
SESSION_SECRET='build-only-not-a-production-secret' npm run build
```

## Deploy

Image Docker:

- multi-stage;
- berjalan sebagai user non-root;
- memiliki healthcheck `/api/health`;
- menyediakan Prisma CLI/migration untuk one-shot release step, tetapi runtime app tidak menjalankan DDL;
- menggunakan volume persisten `/app/uploads`;
- tidak boleh membawa `.env` ke dalam image.

Environment production harus diinjeksi oleh Coolify/runtime secret manager. Gunakan role PostgreSQL khusus aplikasi, bukan superuser.

Jalankan `prisma migrate deploy` sebagai one-shot container/job dengan credential migration sementara sebelum mengalihkan traffic. Jangan memberikan credential DDL tersebut kepada container aplikasi; runtime hanya memakai `DATABASE_URL` role DML.

Sebelum `prisma migrate deploy`, backup dahulu lalu jalankan preflight read-only. Deploy hanya boleh dilanjutkan jika hasilnya `0`:

```sql
SELECT count(*)
FROM (
  SELECT "scheduleId", "scheduledDate"
  FROM "Audit"
  WHERE "scheduleId" IS NOT NULL
  GROUP BY "scheduleId", "scheduledDate"
  HAVING count(*) > 1
) duplicates;
```

## Health

```bash
curl --fail https://safety.irfan-apps.online/api/health
```

Response sehat memuat `status: ok`, `database: reachable`, latency, dan timestamp. Endpoint tidak menampilkan credential atau detail internal database.

## Backup dan restore

Backup wajib mencakup:

1. PostgreSQL custom dump (`pg_dump -Fc`).
2. Volume `/app/uploads`.
3. SHA-256 checksum dan restore manifest.
4. Retensi di storage terpisah.

Contoh validasi:

```bash
pg_restore -l aai_5s_safety.dump >/dev/null
tar -tzf uploads.tar.gz >/dev/null
sha256sum -c SHA256SUMS
```

Lakukan restore drill berkala. Volume persisten bukan pengganti backup.

## Scheduler

Job harian berjalan sekitar 06:00 WIB. Trigger manual menggunakan header rahasia:

```bash
curl -X POST -H "x-cron-secret: $CRON_SECRET" https://safety.irfan-apps.online/api/cron/run
```

Materialisasi audit dilindungi unique constraint dan advisory lock. Notifikasi harian memakai unique dedupe key berbasis tanggal WIB, pengguna, tipe, dan finding agar keduanya idempotent pada beberapa replica.

## Operasional TV/Live Wall

- Pengguna login dapat membuka `/galeri` dari sidebar.
- Kiosk menggunakan token TV yang harus dirotasi secara berkala.
- Token hanya dipakai saat exchange awal menjadi cookie kiosk `HttpOnly`, `Secure`, dan `SameSite=Strict`; aplikasi langsung redirect ke URL bersih tanpa token.
- Hindari membagikan URL exchange awal melalui screenshot atau kanal publik.
- Tombol kembali, pause/play, previous/next, fullscreen, keyboard control, dan reduced-motion tersedia.
