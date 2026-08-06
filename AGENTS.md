<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Instruksi operasional AAI 5S & Safety

Baca [`docs/SERVER-OPERATIONS.md`](docs/SERVER-OPERATIONS.md) sampai selesai sebelum melakukan
deployment, update aplikasi di server, migration produksi, perubahan environment variable,
backup/restore, perubahan domain, atau troubleshooting Coolify.

## Konteks produksi (diperbarui 2026-08-06)

- URL produksi: `https://safety5s.irfan-apps.online`.
- **Bukan lagi via Coolify Application.** App Coolify lama `aai-5s-safety`
  (`safety.irfan-apps.online`, UUID `z7bmnywrsgm68nbrhrc1822v`) sudah **dihapus** pada
  2026-08-06 atas permintaan user; jangan membuatnya ulang.
- Produksi berjalan via Docker Compose: project `aai-5s-safety-v2`, file
  `/root/apps/aai-5s-safety-v2/compose.greenfield.yml` (akses `sudo`). Container app
  `safety5s-greenfield-app`, image pinned by digest
  (`127.0.0.1:5000/aai-5s-safety@sha256:…`, tag rilis `release-YYYYMMDD-HHMMSS`),
  port `3000`, routing Traefik via label di network `coolify`.
- **Source yang di-deploy adalah repo `/root/apps/aai-5s-safety-v2` (versi "hardened"),
  BUKAN repo ini.** Kedua repo sudah divergen (repo ini: redesign v2; repo root: hardening
  rilis + migration tambahan). Sinkronkan/rekonsiliasi dulu sebelum merilis dari repo ini.
- Database produksi: container `safety5s-greenfield-db` (postgres:16-alpine), database
  `safety5s_greenfield`, user `safety5s_runtime`, hanya di network internal
  `safety5s-greenfield-internal` (tanpa port host). Akses via `sudo -n docker exec`.
- Foto produksi di named volume `safety5s-greenfield-uploads`, mount `/app/uploads`.
- Database lama `aai_5s_safety` di shared PostgreSQL `main-postgres`
  (`lkxg3fe49a2xuut11a48l3rp`) **masih ada tapi bukan produksi** — dipakai `.env` lokal
  untuk dev. Jangan dianggap sumber data produksi.
- Environment wajib: `DATABASE_URL`, `SESSION_SECRET`, `CRON_SECRET`, `TV_TOKEN`, dan
  `UPLOAD_DIR=/app/uploads`. Pertahankan nilai produksi yang sudah ada saat update rutin.
- Akses TV/galeri memakai one-time token exchange: buka `/galeri?token=…` atau
  `/tv?token=…` → server set cookie kiosk; token mentah tidak diterima langsung di API.
- Container menjalankan `prisma migrate deploy` sebelum server dimulai. Migration produksi harus
  backward-compatible dan dibackup lebih dahulu bila mengubah data/skema secara berisiko.
- Scheduler harian berjalan in-process sekitar 06:00 WIB. Setelah deploy, pastikan log kembali
  memuat `scheduler aktif`.
- Backup terakhir (dump kedua DB + tar volume lama): `/home/irfan/aai-5s-safety-backup-zpU2v4/`.

## Aturan wajib saat update server

- Perlakukan working tree dan perubahan yang belum di-commit sebagai milik user. Periksa
  `git status`, `git diff`, branch, dan remote; jangan reset, checkout, pull, atau menimpa perubahan
  tanpa memastikan source yang memang diminta untuk dirilis.
- Update resource yang sudah ada. Jangan membuat ulang Application, database, volume, atau secret.
- Jangan menampilkan isi `.env`, `.secrets/pgpass`, password database, session secret, cron secret,
  maupun TV token. Jangan menaruh secret di dokumentasi, command argument yang tercetak, log,
  commit, atau jawaban.
- Sebelum build: cek kesehatan container, kapasitas disk, status database, DNS, dan buat backup bila
  ada migration/perubahan data. Server pernah mengalami PostgreSQL `No space left on device`;
  jangan menjalankan `docker system prune` atau cleanup lintas-aplikasi tanpa izin dan audit target.
- Jalankan minimal `npm run lint` dan `npm run build`. Repository tidak memiliki script test umum;
  lakukan smoke test yang relevan dengan perubahan.
- Simpan/tag image produksi lama untuk rollback sebelum menimpa tag `latest`, lalu build, push,
  trigger deployment Coolify, dan pantau queue sampai status final.
- Verifikasi bukan hanya build: TLS/domain, `/login`, autentikasi, koneksi database, migration,
  scheduler, upload/baca foto, dan persistensi volume setelah redeploy.
- Jika tugas tidak meminta deployment atau perubahan produksi, batasi diri pada pemeriksaan
  read-only dan perubahan kode lokal.
