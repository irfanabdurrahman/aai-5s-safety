# Runbook Server, Coolify, PostgreSQL, dan Update Aplikasi

Dokumen ini adalah sumber operasional untuk AI/operator yang mengelola **AAI 5S & Safety**.
Informasi diverifikasi secara read-only dari server pada **2026-08-06**. Verifikasi ulang fakta
yang dapat berubah sebelum bertindak dan jangan menyimpan kredensial di repository.

> **PEMBARUAN BESAR 2026-08-06 (sore):** App Coolify `aai-5s-safety`
> (`safety.irfan-apps.online`, UUID `z7bmnywrsgm68nbrhrc1822v`) **sudah dihapus** atas
> permintaan user, termasuk container dan volume `aai-5s-safety-uploads` (backup tersimpan di
> `/home/irfan/aai-5s-safety-backup-zpU2v4/`). Produksi sekarang adalah stack **greenfield**
> `https://safety5s.irfan-apps.online` yang berjalan via Docker Compose — lihat tabel di bawah.
> Instruksi Coolify-spesifik di bagian 7 (trigger deployment via Tinker) dan referensi ke UUID
> aplikasi lama **tidak berlaku lagi**; prinsip umum (backup, verifikasi, rollback, secret) tetap
> berlaku.

> **PEMBARUAN 2026-08-10:** Rilis `release-20260810-201544` menambahkan server MCP
> (`/api/mcp`, auth `Authorization: Bearer $MCP_TOKEN`, 6 tools baca + `buat_temuan`) dan
> intake WhatsApp (`/api/intake/whatsapp`, auth header `x-intake-secret`). Container baru
> **`safety5s-waha`** (image `devlikeapro/waha`, network `coolify`, restart `unless-stopped`)
> menjalankan WAHA CORE session `default` dengan webhook `message` →
> `http://safety5s-greenfield-app:3000/api/intake/whatsapp` (custom header `x-intake-secret`).
> Env baru di `runtime.env`: `MCP_TOKEN`, `WA_INTAKE_SECRET`, `WAHA_BASE_URL=http://safety5s-waha:3000`,
> `WAHA_API_KEY`, `WAHA_SESSION=default`, dan `WA_GROUP_ID` (**masih kosong** — isi dengan chat id
> grup WA setelah bot discan & dimasukkan ke grup, lalu `docker compose up -d app` ulang).
> User `WA-BOT` (Bot WhatsApp) dibuat di DB produksi sebagai pelapor temuan dari intake.
> QR pairing WAHA: `GET http://<ip-waha>:3000/api/default/auth/qr` dengan header `X-Api-Key`
> (QR cepat kedaluwarsa, ambil ulang bila perlu). Backup pre-deploy rilis ini:
> `/home/irfan/aai-5s-safety-backup-deploy-aTM9BO/`.

> **PEMBARUAN 2026-08-29 (malam):** Rilis `release-20260829-234754` menambahkan
> **OAuth 2.1 authorization server** di aplikasi supaya `/api/mcp` bisa dipasang sebagai
> custom connector di claude.ai web & ChatGPT web (bukan hanya Bearer token statis via
> Claude Code CLI). Endpoint baru: `/oauth/authorize`, `/oauth/token`,
> `/.well-known/oauth-protected-resource/api/mcp`, `/.well-known/oauth-authorization-server`.
> Gate consent-nya password admin terpisah (`MCP_OAUTH_ADMIN_PASSWORD`), bukan akun NPK.
> 2 tabel baru (`OAuthAuthCode`, `OAuthToken`) via migration
> `20260829213000_oauth_authorization_server` — murni tabel baru, tidak mengubah data lama.
> **Resource URL di-fix ke `https://safety5s.com/api/mcp`** — connector claude.ai/ChatGPT
> WAJIB pakai domain `safety5s.com`, bukan `irfan-apps.online`. Detail lengkap lihat AGENTS.md
> bagian "Konteks produksi (rilis OAuth MCP)". Sudah diuji end-to-end via curl (authorize →
> consent → code → token → panggil tool) sebelum dianggap selesai.

> **PEMBARUAN 2026-08-29:** Domain custom `safety5s.com` (dan `www.safety5s.com`) milik user
> ditambahkan sebagai alias produksi. DNS A record kedua domain sudah diarahkan user ke
> `109.199.98.96` (di luar `irfan-apps.online`, jadi bukan bagian wildcard). Traefik router
> `safety5s-greenfield-http`/`-https` di `compose.greenfield.yml` diupdate agar rule `Host(...)`
> mencakup ketiga hostname sekaligus (OR), lalu `docker compose up -d app` untuk recreate
> container (tanpa rebuild image, tanpa migration). TLS Let's Encrypt terverifikasi jalan untuk
> ketiga domain. Backup file sebelum edit: `compose.greenfield.yml.bak-20260829-204105`.

## 1. Inventaris produksi

| Komponen | Konfigurasi saat diverifikasi (2026-08-06) |
| --- | --- |
| URL produksi | `https://safety5s.irfan-apps.online`, `https://safety5s.com`, `https://www.safety5s.com` (alias, ditambahkan 2026-08-29) |
| IP publik | `109.199.98.96` |
| Cara deploy | Docker Compose, project `aai-5s-safety-v2` |
| File compose | `/root/apps/aai-5s-safety-v2/compose.greenfield.yml` (akses `sudo`) |
| Source deployed | repo `/root/apps/aai-5s-safety-v2` (versi hardened, **bukan** repo ini) |
| Container app | `safety5s-greenfield-app` (restart `unless-stopped`) |
| Image aktif | `127.0.0.1:5000/aai-5s-safety@sha256:…` pinned by digest; tag rilis `release-YYYYMMDD-HHMMSS` |
| Registry lokal | container `local-registry`, `127.0.0.1:5000` (catatan: tag `latest` bisa tertinggal — jangan dipakai untuk rilis, pakai digest/tag rilis) |
| Routing | label Traefik di container (network `coolify`), TLS Let's Encrypt |
| Port aplikasi | `3000` |
| PostgreSQL produksi | container `safety5s-greenfield-db` (postgres:16-alpine), network internal `safety5s-greenfield-internal`, tanpa port host |
| Database aplikasi | `safety5s_greenfield`, user `safety5s_runtime` |
| Volume foto | `safety5s-greenfield-uploads` → `/app/uploads` |
| DB lama (non-produksi) | `aai_5s_safety` di `main-postgres` (`lkxg3fe49a2xuut11a48l3rp:5432`) — dipakai `.env` lokal untuk dev |
| Stack staging | `aai-5s-safety-staging-app` + `aai-5s-safety-staging-db` (jangan disentuh tanpa scope) |
| Git remote | `https://github.com/irfanabdurrahman/aai-5s-safety.git` |

Coolify masih mengelola aplikasi lain di server ini; `coolify-proxy` (Traefik) tetap menjadi
reverse proxy untuk stack greenfield. Jangan mengubah port binding `coolify-proxy`, konfigurasi
Tailscale, autentikasi SSH, atau resource aplikasi lain.

Akses DB produksi hanya via exec (tidak ada port host):

```bash
sudo -n docker exec safety5s-greenfield-db \
  psql -U safety5s_runtime -d safety5s_greenfield -c 'select 1'
```

Untuk menjalankan script (seed/maintenance) terhadap DB produksi, jalankan container sementara
di network internalnya, mis. dengan repo ter-mount dan `DATABASE_URL` diambil dari env container
app (jangan dicetak).

## 2. Keadaan khusus aplikasi

- Dockerfile memakai Node 22 slim dan Next.js standalone.
- Pada startup container, command menjalankan `npx prisma migrate deploy && node server.js`.
  Jika migration gagal, server tidak akan start.
- Aplikasi belum mempunyai `/api/health`; health check Coolify saat ini disabled. `/api/health`
  akan menghasilkan 404 dan tidak boleh dipakai sebagai bukti sehat.
- Smoke check publik yang tersedia: `/login` harus 200 dan endpoint terproteksi tanpa token harus
  401. Root `/` dapat merespons redirect 307 karena autentikasi.
- Scheduler berjalan di proses Next.js setiap hari sekitar 06:00 WIB. Restart/redeploy akan
  menjadwalkan ulang timer; periksa log setelah deployment.
- Empat key produksi dan preview sudah terdaftar di Coolify: `DATABASE_URL`, `SESSION_SECRET`,
  `CRON_SECRET`, dan `TV_TOKEN`. `UPLOAD_DIR=/app/uploads` berasal dari Dockerfile tetapi boleh
  dipasang eksplisit di Coolify untuk memperjelas konfigurasi.
- Connection produksi yang diverifikasi mengarah ke database `aai_5s_safety` pada hostname
  `lkxg3fe49a2xuut11a48l3rp`. User aplikasi saat ini masih `postgres`. Jangan mengganti user atau
  merotasi password sebagai bagian update rutin; migrasi ke role least-privilege adalah pekerjaan
  terpisah yang harus direncanakan agar tidak menyebabkan downtime.
- `.env` dan `.secrets/pgpass` ada lokal serta di-ignore. Keduanya sensitif: jangan tampilkan,
  commit, salin ke dokumentasi, atau pakai sebagai sumber kebenaran tanpa membandingkan targetnya.
  Environment Coolify adalah sumber konfigurasi produksi.

## 3. Preflight sebelum update

Jalankan pemeriksaan read-only berikut:

```bash
cd /home/irfan/apps/aai-5s-safety
git status --short --branch
git remote -v
git log -5 --oneline --decorate

df -h / /var/lib/docker
sudo -n docker system df
sudo -n docker ps --format '{{.Names}}\t{{.Status}}' \
  | rg '^(coolify|coolify-db|coolify-proxy|local-registry|lkxg3fe49a2xuut11a48l3rp|z7bmnywrsgm68nbrhrc1822v)'

dig +short A safety5s.irfan-apps.online
curl -fsS --max-time 10 -o /dev/null \
  -w 'login=%{http_code} tls=%{ssl_verify_result}\n' \
  https://safety5s.irfan-apps.online/login
```

DNS yang diharapkan adalah `109.199.98.96`, TLS verify result `0`, dan `/login` status `200`.
Saat diverifikasi, filesystem host terpakai sekitar 79% dan log aplikasi pernah mencatat
PostgreSQL `No space left on device`. Bila ruang menipis:

1. hentikan update;
2. identifikasi penggunaan disk secara read-only;
3. laporkan kandidat cleanup beserta aplikasi yang terdampak;
4. jangan menjalankan prune/delete lintas-server tanpa izin eksplisit.

Pastikan juga source yang akan dirilis jelas. Working tree dapat berisi perubahan user. Jangan
menjalankan `git reset`, `git checkout --`, atau pull yang berpotensi membuat konflik. `git fetch`
read-only boleh dipakai untuk membandingkan local dengan remote.

## 4. Secret dan environment variable

Environment runtime wajib:

```dotenv
DATABASE_URL=postgresql://<USER>:<SECRET>@lkxg3fe49a2xuut11a48l3rp:5432/aai_5s_safety
SESSION_SECRET=<SECRET_RANDOM_YANG_SUDAH_ADA>
CRON_SECRET=<SECRET_RANDOM_YANG_SUDAH_ADA>
TV_TOKEN=<TOKEN_YANG_SUDAH_ADA>
UPLOAD_DIR=/app/uploads
```

Update rutin image tidak membutuhkan perubahan environment. Jangan mengganti nilai dengan contoh
dari `.env.example`. Untuk mengecek hanya keberadaan key tanpa membaca nilainya:

```bash
sudo -n docker exec coolify-db psql -U coolify -d coolify -t -A -F $'\t' \
  -c "select ev.key,ev.is_preview,case when ev.value is null or ev.value='' then 'EMPTY' else 'SET' end from environment_variables ev join applications a on a.id=ev.resourceable_id where ev.resourceable_type like '%Application%' and a.uuid='z7bmnywrsgm68nbrhrc1822v' order by ev.key,ev.is_preview;"
```

Bila user memang meminta perubahan secret, masukkan lewat UI Coolify atau teruskan variabel shell
ke `docker exec` **berdasarkan nama**, bukan nilainya. Jangan gunakan `set -x`. Gunakan model
`EnvironmentVariable::updateOrCreate` berdasarkan application + key + `is_preview=false`, lalu
hapus variabel shell. Periksa apakah preview juga perlu diselaraskan; jangan mengubah keduanya
secara tidak sengaja.

## 5. Backup sebelum migration atau perubahan data

Update kode tanpa migration destruktif tetap harus menjaga jalur rollback. Jika ada migration atau
perubahan data, buat backup database dan volume terlebih dahulu. Contoh backup lokal yang tidak
mencetak password:

```bash
AAI_BACKUP_DIR="$(mktemp -d /home/irfan/aai-5s-safety-backup-XXXXXX)"
sudo -n docker exec safety5s-greenfield-db \
  pg_dump -U safety5s_runtime -d safety5s_greenfield -Fc \
  > "$AAI_BACKUP_DIR/safety5s_greenfield.dump"
sudo -n tar -C /var/lib/docker/volumes/safety5s-greenfield-uploads/_data \
  -czf "$AAI_BACKUP_DIR/safety5s-greenfield-uploads.tar.gz" .
ls -lh "$AAI_BACKUP_DIR"
```

Catat lokasi backup dan jangan menghapusnya sampai deployment serta validasi data selesai. Backup
belum dianggap memadai untuk perubahan berisiko tinggi bila prosedur restore belum pernah diuji.
Jangan melakukan restore atau drop database tanpa permintaan dan persetujuan eksplisit.

## 6. Validasi kode dan build image

Sebelum build, baca dokumentasi Next.js versi terpasang di `node_modules/next/dist/docs/` untuk API
yang diubah. Repository tidak mempunyai script test umum; minimal jalankan:

```bash
cd /home/irfan/apps/aai-5s-safety
npm run lint
npm run build
```

Tambahkan smoke test yang sesuai perubahan. Script di `scripts/` dapat menyentuh data/akun; baca
isinya lebih dahulu dan jangan menjalankan cleanup/seed terhadap database produksi tanpa scope
eksplisit.

Sebelum menimpa `latest`, simpan image container aktif sebagai rollback tag:

```bash
AAI_CONTAINER="$(sudo -n docker ps --filter 'name=z7bmnywrsgm68nbrhrc1822v' --format '{{.Names}}' | head -1)"
test -n "$AAI_CONTAINER"
AAI_PREVIOUS_IMAGE="$(sudo -n docker inspect "$AAI_CONTAINER" --format '{{.Image}}')"
AAI_ROLLBACK_TAG="rollback-$(date +%Y%m%d-%H%M%S)"
sudo -n docker tag "$AAI_PREVIOUS_IMAGE" \
  "127.0.0.1:5000/aai-5s-safety:$AAI_ROLLBACK_TAG"
sudo -n docker push "127.0.0.1:5000/aai-5s-safety:$AAI_ROLLBACK_TAG"
```

Build dan publish release baru:

```bash
sudo -n docker build -t aai-5s-safety:latest \
  /home/irfan/apps/aai-5s-safety
sudo -n docker tag aai-5s-safety:latest \
  127.0.0.1:5000/aai-5s-safety:latest
sudo -n docker push 127.0.0.1:5000/aai-5s-safety:latest
```

Build context mencakup isi working tree, termasuk perubahan belum di-commit yang tidak di-ignore.
Pastikan itulah source yang disetujui. Jangan menjalankan image test dengan `DATABASE_URL` produksi:
startup otomatis akan menjalankan migration. Gunakan database uji/clone jika perlu boot test penuh.

## 7. Trigger dan pantau deployment Coolify

Application sudah ada; jangan buat ulang. Trigger deployment melalui Tinker:

```bash
sudo -n docker exec coolify php artisan tinker --execute='
$app = \App\Models\Application::where("uuid", "z7bmnywrsgm68nbrhrc1822v")->firstOrFail();
$deploymentUuid = (new \Visus\Cuid2\Cuid2)->toString();
queue_application_deployment(application: $app, deployment_uuid: $deploymentUuid);
echo $deploymentUuid;
'
```

Simpan UUID yang keluar, lalu poll dengan interval wajar:

```bash
sudo -n docker exec coolify-db psql -U coolify -d coolify -t -A \
  -c "select status from application_deployment_queues where deployment_uuid='<DEPLOYMENT_UUID>';"
```

Jika status gagal, baca `logs` record tersebut dan redaksi secret sebelum melaporkannya. Perbaiki
akar masalah lalu build/push/trigger ulang; jangan restart atau mengubah `coolify-proxy`.

Setelah queue selesai, temukan container baru dari prefix UUID dan cek:

```bash
AAI_CONTAINER="$(sudo -n docker ps --filter 'name=z7bmnywrsgm68nbrhrc1822v' --format '{{.Names}}' | head -1)"
sudo -n docker logs --tail 150 "$AAI_CONTAINER"
sudo -n docker inspect "$AAI_CONTAINER" --format '{{.State.Status}} {{.RestartCount}}'
```

Log startup yang sehat menunjukkan migration berhasil/tidak ada migration tertunda, Next.js ready,
dan scheduler aktif.

## 8. Verifikasi setelah update

```bash
curl -fsS --max-time 10 -o /dev/null \
  -w 'login=%{http_code} tls=%{ssl_verify_result}\n' \
  https://safety5s.irfan-apps.online/login
curl -sS --max-time 10 -o /dev/null \
  -w 'protected-api=%{http_code}\n' \
  https://safety5s.irfan-apps.online/api/tv-data
```

Hasil dasar yang diharapkan: `/login` = 200, TLS = 0, API tanpa token = 401. Lanjutkan dengan:

- login akun uji dan verifikasi session;
- buka dashboard, temuan, audit, dan TV sesuai scope perubahan;
- cek koneksi database serta jumlah migration yang berhasil;
- upload lalu baca foto;
- restart/redeploy terkontrol bila perlu untuk membuktikan foto tetap ada di volume;
- pastikan log scheduler aktif dan tidak muncul error database/disk baru;
- pantau restart count/container setidaknya sampai stabil.

Jangan menaruh token TV atau cron di URL/log publik. Trigger manual `/api/cron/run` menimbulkan
perubahan data/notifikasi; lakukan hanya bila diminta atau memang bagian verifikasi yang disetujui.

## 9. Domain baru atau perubahan domain

Wildcard DNS `*.irfan-apps.online` sudah mengarah ke `109.199.98.96`. Untuk subdomain baru:

1. verifikasi `dig +short A <subdomain>.irfan-apps.online`;
2. update `fqdn` Application yang sama di Coolify, jangan membuat Application duplikat;
3. deploy ulang agar konfigurasi Traefik diperbarui;
4. verifikasi DNS publik, HTTPS Let's Encrypt, login, cookie/session, link TV, dan upload;
5. pertahankan domain lama sementara jika user meminta transisi tanpa downtime.

Domain di luar `irfan-apps.online` memerlukan akses provider DNS untuk membuat record ke
`109.199.98.96`. Jangan mengklaim domain siap sebelum DNS publik dan TLS keduanya lolos.

## 10. Rollback

Gunakan rollback hanya setelah penyebab kegagalan dinilai. Jika schema migration tidak backward-
compatible, rollback image saja mungkin tidak aman; restore database adalah operasi terpisah dan
destruktif yang membutuhkan persetujuan eksplisit.

Untuk rollback image, ubah `docker_registry_image_tag` Application ke tag rollback yang dibuat
sebelum update, trigger deployment, lalu ulangi seluruh verifikasi. Setelah layanan pulih, laporkan
tag yang aktif, dampak migration, dan pekerjaan lanjutan. Jangan menghapus image/tag rollback atau
backup sebelum insiden ditutup.

