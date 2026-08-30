import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = { title: "Panduan Penggunaan" };

type Tone = "brand" | "accent" | "ok" | "warn" | "danger" | "info" | "neutral";

const TOC: Array<{ id: string; label: string }> = [
  { id: "peran", label: "Ringkasan Peran & Hak Akses" },
  { id: "lapor", label: "Melapor Temuan" },
  { id: "tindak-lanjut", label: "Menindaklanjuti Temuan" },
  { id: "audit", label: "Audit 5S" },
  { id: "verifikasi", label: "Verifikasi" },
  { id: "dashboard", label: "Dashboard" },
  { id: "peringkat", label: "Papan Peringkat" },
  { id: "notifikasi", label: "Notifikasi" },
  { id: "profil", label: "Profil & Keamanan Akun" },
  { id: "live-wall", label: "Safety & 5S Live Wall" },
  { id: "admin", label: "Admin: Kelola Sistem" },
  { id: "penomoran", label: "Penomoran Temuan Otomatis" },
];

function Scope({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <Badge tone={tone} className="mb-1">
      {children}
    </Badge>
  );
}

function Section({
  id,
  no,
  title,
  scope,
  scopeTone = "brand",
  children,
}: {
  id: string;
  no: number;
  title: string;
  scope: string;
  scopeTone?: Tone;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-20">
      <CardHeader
        title={`${no}. ${title}`}
        action={<Scope tone={scopeTone}>{scope}</Scope>}
      />
      <CardBody className="space-y-3 text-sm leading-relaxed text-foreground">
        {children}
      </CardBody>
    </Card>
  );
}

function StepList({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="list-decimal space-y-1.5 pl-5">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ol>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl bg-brand-soft px-3 py-2 text-xs font-semibold text-brand-dark">
      {children}
    </p>
  );
}

export default async function PanduanPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">Panduan Penggunaan</h1>
        <p className="text-sm text-muted">
          Cara pakai aplikasi AAI 5S &amp; Safety, dari lapor temuan sampai
          kelola sistem.
        </p>
      </div>

      {/* Daftar isi */}
      <Card>
        <CardBody>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
            Daftar Isi
          </p>
          <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
            {TOC.map((t, i) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                className="truncate text-sm font-semibold text-brand hover:underline"
              >
                {i + 1}. {t.label}
              </a>
            ))}
          </div>
        </CardBody>
      </Card>

      <Section id="peran" no={1} title="Ringkasan Peran & Hak Akses" scope="Semua Peran">
        <p>
          Aplikasi ini punya 4 tingkat peran. Setiap peran mewarisi semua hak
          peran di bawahnya, ditambah kewenangan tambahan:
        </p>
        <ul className="space-y-2">
          <li>
            <b>Karyawan</b> — melapor temuan.
          </li>
          <li>
            <b>PIC Area</b> — + mengambil &amp; menindaklanjuti temuan di area
            yang menjadi tanggung jawabnya, mengikuti audit 5S.
          </li>
          <li>
            <b>Supervisor</b> — + menugaskan PIC, memverifikasi temuan, melihat
            Dashboard. Dibatasi hanya untuk departemennya sendiri.
          </li>
          <li>
            <b>Admin</b> — akses penuh ke semua departemen, ditambah kelola
            pengguna, master data, checklist, dan jadwal audit.
          </li>
        </ul>
      </Section>

      <Section id="lapor" no={2} title="Melapor Temuan" scope="Semua Peran">
        <p>
          Buka menu <b>Lapor Temuan</b> (tombol merah di sidebar, atau tombol
          bulat di tengah bawah pada HP).
        </p>
        <StepList
          items={[
            <>Ambil <b>foto kondisi bahaya</b> (wajib).</>,
            <>Pilih <b>kategori temuan</b> dan <b>tingkat risiko</b>.</>,
            <>
              Pilih <b>area</b> (wajib) dan <b>line</b> kalau area tersebut
              punya line.
            </>,
            <>
              Isi <b>detail lokasi</b> (opsional) dan <b>deskripsi</b> temuan
              (wajib, 10–1000 karakter).
            </>,
            <>
              Tekan <b>Kirim Laporan</b>.
            </>,
          ]}
        />
        <Note>
          Setiap laporan otomatis dapat nomor unik, contoh SF-2026-0001 —
          lihat bagian 12.
        </Note>
      </Section>

      <Section
        id="tindak-lanjut"
        no={3}
        title="Menindaklanjuti Temuan"
        scope="PIC Area, Supervisor & Admin"
        scopeTone="info"
      >
        <p>
          Setiap temuan berjalan lewat 4 status:{" "}
          <b>Baru → Dikerjakan → Menunggu Verifikasi → Selesai</b>.
        </p>
        <div className="space-y-2">
          <p className="font-bold">Status Baru (OPEN)</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Supervisor/Admin menekan <b>Tugaskan PIC</b> — pilih PIC dan
              tanggal jatuh tempo (terisi otomatis sesuai tingkat risiko).
            </li>
            <li>
              Atau, PIC Area yang bertanggung jawab atas area tersebut bisa
              langsung menekan <b>Ambil Tugas Ini</b>.
            </li>
            <li>
              Kalau temuan tidak valid/duplikat, tekan{" "}
              <b>Tutup — Tidak Valid</b> dan isi alasan (minimal 5 karakter).
            </li>
          </ul>
        </div>
        <div className="space-y-2">
          <p className="font-bold">Status Dikerjakan (IN_PROGRESS)</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              PIC yang ditugaskan menekan <b>Selesai Perbaikan</b>, mengunggah{" "}
              <b>foto SESUDAH perbaikan</b> (wajib) dan mengisi{" "}
              <b>catatan tindakan</b> (wajib, 10–1000 karakter).
            </li>
            <li>
              Tekan <b>Kirim untuk Verifikasi</b>.
            </li>
          </ul>
        </div>
        <div className="space-y-2">
          <p className="font-bold">Status Menunggu Verifikasi (PENDING_VERIFICATION)</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Supervisor/Admin menekan <b>Terima &amp; Tutup</b> (catatan
              opsional) untuk menyelesaikan temuan.
            </li>
            <li>
              Atau <b>Tolak Verifikasi</b> (alasan wajib, minimal 5 karakter)
              — temuan kembali ke status Dikerjakan.
            </li>
          </ul>
        </div>
        <Note>
          Yang memverifikasi tidak boleh orang yang sama dengan yang
          mengerjakan perbaikan.
        </Note>
      </Section>

      <Section
        id="audit"
        no={4}
        title="Audit 5S"
        scope="PIC Area, Supervisor & Admin"
        scopeTone="info"
      >
        <StepList
          items={[
            <>
              Tekan <b>Mulai Audit Ad-hoc</b> lalu pilih area, atau lanjutkan
              audit terjadwal yang sudah ada (tombol <b>Mulai</b> /{" "}
              <b>Lanjutkan</b>).
            </>,
            <>
              Beri skor tiap kriteria checklist dengan skala <b>0–4</b> (0 =
              sangat buruk, 2 = perlu perbaikan, 4 = sesuai standar). Skor
              tersimpan otomatis begitu ditekan.
            </>,
            <>
              Kriteria dengan skor ≤2 bisa langsung dijadikan temuan lewat
              tombol <b>+ Jadikan Temuan</b>.
            </>,
            <>
              Skor total tampil real-time di bagian atas (persentase dengan
              warna hijau/kuning/merah).
            </>,
            <>
              Setelah semua kriteria dinilai, isi catatan (opsional) dan
              tekan <b>Selesai &amp; Kirim Audit</b>.
            </>,
          ]}
        />
      </Section>

      <Section
        id="verifikasi"
        no={5}
        title="Verifikasi"
        scope="Supervisor & Admin"
        scopeTone="warn"
      >
        <p>
          Halaman <b>Verifikasi</b> menampilkan semua temuan berstatus
          Menunggu Verifikasi. Supervisor hanya melihat temuan dari
          departemennya sendiri; Admin melihat semua departemen.
        </p>
        <p>
          Buka detail temuan untuk menerima atau menolak — caranya sama
          seperti bagian 3.
        </p>
      </Section>

      <Section
        id="dashboard"
        no={6}
        title="Dashboard"
        scope="Supervisor & Admin"
        scopeTone="warn"
      >
        <p>Ringkasan performa safety &amp; 5S, terdiri dari:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Metrik utama: Kritis Aktif, Kritis Overdue, SLA On-time, Median
            Close, Audit Selesai.
          </li>
          <li>Safety Pulse — ringkasan naratif otomatis berdasarkan data.</li>
          <li>Funnel status temuan dan Backlog Aging (usia temuan terbuka).</li>
          <li>Audit Discipline — kepatuhan jadwal audit per area.</li>
          <li>Matriks risiko × status dan risiko × kategori safety.</li>
          <li>Tren mingguan (8 minggu) dan skor 5S terbaru per area.</li>
          <li>Eskalasi temuan kritis yang sudah overdue.</li>
          <li>Peringkat departemen berdasarkan beberapa indikator sekaligus.</li>
        </ul>
      </Section>

      <Section id="peringkat" no={7} title="Papan Peringkat" scope="Semua Peran">
        <p>
          Menampilkan podium 3 pelapor teraktif dan daftar departemen terbaik
          (berdasarkan ketepatan waktu perbaikan + skor 5S). Bisa dilihat
          untuk periode <b>Bulan Ini</b> atau <b>Sepanjang Waktu</b>.
        </p>
      </Section>

      <Section id="notifikasi" no={8} title="Notifikasi" scope="Semua Peran">
        <p>Kamu akan menerima notifikasi otomatis saat:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Ditugaskan sebagai PIC suatu temuan.</li>
          <li>Temuan yang kamu tangani hampir jatuh tempo atau sudah overdue.</li>
          <li>Temuan dieskalasi karena tingkat risiko kritis.</li>
          <li>
            Hasil perbaikanmu diverifikasi (diterima/ditutup) atau ditolak.
          </li>
          <li>Temuan yang kamu laporkan dinyatakan tidak valid.</li>
          <li>Ada komentar baru, atau jadwal audit yang akan datang.</li>
        </ul>
        <p>
          Buka menu <b>Notifikasi</b> untuk melihat semuanya — klik satu
          notifikasi untuk langsung membuka temuan/audit terkait, atau tekan{" "}
          <b>Tandai semua dibaca</b>.
        </p>
      </Section>

      <Section
        id="profil"
        no={9}
        title="Profil & Keamanan Akun"
        scope="Semua Peran"
      >
        <p>
          Halaman <b>Profil</b> menampilkan statistik pribadi (jumlah temuan
          yang dilaporkan dan perbaikan yang diselesaikan sebagai PIC).
        </p>
        <p className="font-bold">Ganti password</p>
        <StepList
          items={[
            "Isi password lama.",
            "Isi password baru (minimal 12 karakter).",
            "Ulangi password baru untuk konfirmasi.",
            <>
              Tekan <b>Simpan Password</b>.
            </>,
          ]}
        />
        <Note>
          Akun baru dari admin dapat password sementara — sistem akan
          memaksa ganti password ini pada saat login pertama, sebelum bisa
          membuka halaman lain.
        </Note>
      </Section>

      <Section
        id="live-wall"
        no={10}
        title="Safety & 5S Live Wall"
        scope="Semua Peran"
      >
        <p>
          Tampilan layar besar (TV) untuk dipasang di area produksi —
          menampilkan foto sebelum/sesudah perbaikan dan papan peringkat
          secara bergantian.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Bisa dibuka lewat sesi login biasa seperti halaman lain.</li>
          <li>
            Atau lewat <b>link token khusus</b> dari admin sistem (format{" "}
            <code className="rounded bg-background px-1 py-0.5 text-xs">
              /galeri?token=...
            </code>{" "}
            atau{" "}
            <code className="rounded bg-background px-1 py-0.5 text-xs">
              /tv?token=...
            </code>
            ) — cocok untuk TV kios tanpa perlu login manual, berlaku selama
            12 jam per sesi.
          </li>
        </ul>
      </Section>

      <Section
        id="admin"
        no={11}
        title="Admin: Kelola Sistem"
        scope="Khusus Admin"
        scopeTone="danger"
      >
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <b>Kelola Pengguna</b> — buat akun baru (mendapat password
            sementara yang wajib diganti), nonaktifkan akun yang sudah tidak
            dipakai.
          </li>
          <li>
            <b>Departemen, Area &amp; Line</b> — atur struktur organisasi dan
            tetapkan PIC (penanggung jawab) tiap area.
          </li>
          <li>
            <b>Checklist 5S</b> — kelola daftar kriteria penilaian per pilar
            (Seiri, Seiton, Seiso, Seiketsu, Shitsuke).
          </li>
          <li>
            <b>Jadwal Audit</b> — atur audit rutin (mingguan/bulanan/sekali)
            per area beserta auditornya.
          </li>
          <li>
            <b>Laporan &amp; Export</b> — unduh data temuan atau audit dalam
            format CSV berdasarkan rentang tanggal.
          </li>
        </ul>
      </Section>

      <Section
        id="penomoran"
        no={12}
        title="Penomoran Temuan Otomatis"
        scope="Semua Peran"
      >
        <p>Setiap temuan mendapat nomor unik otomatis, formatnya:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>SF-2026-0001</b> — untuk laporan safety biasa (menu Lapor
            Temuan).
          </li>
          <li>
            <b>5S-2026-0001</b> — untuk temuan yang dibuat dari hasil audit
            5S.
          </li>
        </ul>
        <p>
          Nomor berurutan, otomatis reset tiap tahun, dan tidak bisa diubah
          manual.
        </p>
      </Section>

      <p className="pb-2 text-center text-xs text-muted">
        Ada pertanyaan lain? Hubungi Admin EHS di{" "}
        <Link href="/profil" className="font-bold text-brand">
          halaman Profil
        </Link>
        .
      </p>
    </div>
  );
}
