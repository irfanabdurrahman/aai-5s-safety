<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Instruksi operasional AAI 5S & Safety

Baca [`docs/SERVER-OPERATIONS.md`](docs/SERVER-OPERATIONS.md) sampai selesai sebelum melakukan
deployment, update aplikasi di server, migration produksi, perubahan environment variable,
backup/restore, perubahan domain, atau troubleshooting Coolify.

## Konteks produksi (diperbarui 2026-08-29, rilis OAuth MCP)

- **OAuth 2.1 authorization server untuk MCP** ditambahkan di rilis
  `release-20260829-234754` (image digest
  `sha256:dd560a1814044d07dc50480060f34c83d0dbc27186a6a6cea59089a2185018d5`),
  supaya `/api/mcp` bisa dipasang sebagai custom connector di **claude.ai web**
  dan **ChatGPT web** (keduanya mensyaratkan OAuth, bukan static token).
  Endpoint MCP tetap bisa diakses dengan `MCP_TOKEN` statis (jalur lama,
  Claude Code CLI dsb) — OAuth cuma jalur tambahan, tidak menggantikan.
  - Endpoint baru: `/oauth/authorize` (halaman consent, gate-nya password
    admin terpisah — BUKAN akun NPK), `/oauth/token`,
    `/.well-known/oauth-protected-resource/api/mcp` (RFC 9728, path-aware
    karena resource URL `/api/mcp`), `/.well-known/oauth-authorization-server`
    (RFC 8414).
  - Resource identity di-fix ke `https://safety5s.com/api/mcp` — saat setup
    connector di claude.ai/ChatGPT, URL MCP server **wajib** `safety5s.com`
    (bukan `irfan-apps.online`), karena audience token divalidasi persis
    terhadap nilai itu.
  - Secret baru di `runtime.env`: `MCP_OAUTH_CLIENT_ID`, `MCP_OAUTH_CLIENT_SECRET`
    (pre-registered client, ditempel manual user di UI connector),
    `MCP_OAUTH_ADMIN_PASSWORD` (password consent, terpisah dari akun NPK
    manapun sesuai keputusan user). Nilai tersimpan sekali di
    `/root/secure/aai-5s-safety-greenfield/oauth-credentials-for-user.txt`
    (root-only) untuk diserahkan ke user — hapus setelah user konfirmasi
    sudah disimpan di tempat aman.
  - Tabel Prisma baru (migration `20260829213000_oauth_authorization_server`,
    murni tabel baru, tidak mengubah tabel lama): `OAuthAuthCode` (kode
    otorisasi sekali-pakai, TTL 5 menit, consume atomik via raw SQL),
    `OAuthToken` (access token 1 jam + refresh token 30 hari, rotate saat
    refresh, simpan **hash** SHA-256 bukan raw value).
  - `src/proxy.ts` — `/oauth` dan `/.well-known` ditambahkan ke
    `PUBLIC_PATHS` (di luar gate sesi NPK; punya gate sendiri via password
    admin). Jangan hilangkan ini saat edit `proxy.ts` — tanpanya halaman
    consent & metadata discovery ke-redirect ke `/login`.
  - PKCE S256 wajib di-enforce, redirect_uri di-whitelist eksplisit
    (`https://claude.ai/api/mcp/auth_callback`, `https://chatgpt.com/connector_platform_oauth_redirect`,
    `https://chatgpt.com/connector/oauth/*`) via parsing `URL()` (bukan
    string prefix) di `src/lib/oauth.ts`.
  - **Pelajaran penting**: `withMcpAuth` dari paket `mcp-handler` punya
    default `required: false` — TANPA `required: true` eksplisit, request
    tanpa token akan diteruskan ke handler MCP TANPA cek auth sama sekali.
    Ini sempat ke-deploy tanpa sengaja (celah singkat, langsung diperbaiki).
    Selalu set `required: true` eksplisit kalau pernah refactor
    `src/app/api/mcp/route.ts`.
  - Uji end-to-end penuh (authorize → consent → code → token exchange →
    panggil tool MCP) sudah diverifikasi jalan via curl (simulasi form
    server-action Next.js) sebelum rilis dianggap selesai.

## Konteks produksi (diperbarui 2026-08-29, domain)

- URL produksi: `https://safety5s.irfan-apps.online`, juga dapat diakses via domain custom
  `https://safety5s.com` dan `https://www.safety5s.com` (ditambahkan 2026-08-29; user sudah
  mengarahkan DNS domain tersebut ke `109.199.98.96`). Ketiga host dilayani oleh container yang
  sama (`safety5s-greenfield-app`) via satu Traefik router dengan rule
  `(Host(safety5s.irfan-apps.online) || Host(safety5s.com) || Host(www.safety5s.com)) && PathPrefix(/)`
  di `/root/apps/aai-5s-safety-v2/compose.greenfield.yml`. TLS Let's Encrypt aktif untuk ketiganya.
  Backup file compose sebelum perubahan: `compose.greenfield.yml.bak-20260829-204105` (di server,
  folder yang sama).
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
- Environment opsional integrasi (fitur MCP & intake WhatsApp): `MCP_TOKEN`,
  `WA_INTAKE_SECRET`, `WA_GROUP_ID`, `WAHA_BASE_URL`, `WAHA_API_KEY`, `WAHA_SESSION`.
  Bila kosong, endpoint `/api/mcp` dan `/api/intake/whatsapp` menolak semua request (aman by default).
- Integrasi WhatsApp berjalan via container **`safety5s-waha`** (WAHA CORE, network `coolify`),
  session `default`, webhook `message` → app dengan header `x-intake-secret`. QR pairing dan
  pengisian `WA_GROUP_ID` adalah langkah manual user; detail di `docs/SERVER-OPERATIONS.md`
  (pembaruan 2026-08-10).
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
