/* MCP server safety5s — tools untuk AI eksternal (query data temuan/audit
   + buat temuan). Didaftarkan ke instance McpServer oleh route /api/mcp. */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { getKpis, getAreaScores } from "@/lib/kpi";
import { getReporterLeaderboard } from "@/lib/leaderboard";
import { STATUS_META, RISK_META } from "@/lib/labels";
import { toDateStr, wibToday } from "@/lib/dates";
import { createFindingFromIntake } from "@/lib/intake";
import type { FindingStatus, RiskLevel } from "@/generated/prisma/enums";

const text = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

const statusLabel = (s: FindingStatus) => STATUS_META[s]?.label ?? s;
const riskLabel = (r: RiskLevel | null) => (r ? (RISK_META[r]?.label ?? r) : null);

const findingSelect = {
  number: true,
  status: true,
  riskLevel: true,
  safetyCategory: true,
  description: true,
  locationDetail: true,
  dueDate: true,
  createdAt: true,
  area: { select: { code: true, name: true, department: { select: { code: true } } } },
  line: { select: { name: true } },
  reporter: { select: { name: true } },
  pic: { select: { name: true } },
} as const;

type FindingRow = Prisma.FindingGetPayload<{ select: typeof findingSelect }>;

const detailSelect = {
  ...findingSelect,
  isValid: true,
  actionNote: true,
  rejectionNote: true,
  closedAt: true,
  photos: { select: { type: true, filePath: true } },
  statusHistory: {
    orderBy: { createdAt: "asc" as const },
    select: {
      fromStatus: true,
      toStatus: true,
      note: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  },
} as const;

type FindingDetail = Prisma.FindingGetPayload<{ select: typeof detailSelect }>;

function shapeFinding(f: FindingRow) {
  return {
    nomor: f.number,
    status: statusLabel(f.status),
    risiko: riskLabel(f.riskLevel),
    area: f.area.name,
    departemen: f.area.department.code,
    line: f.line?.name ?? null,
    lokasiDetail: f.locationDetail,
    pic: f.pic?.name ?? null,
    pelapor: f.reporter?.name ?? null,
    targetSelesai: f.dueDate ? toDateStr(f.dueDate) : null,
    dilaporkan: f.createdAt.toISOString(),
    deskripsi: f.description,
  };
}

const cariSchema = z.object({
  status: z
    .enum(["OPEN", "IN_PROGRESS", "PENDING_VERIFICATION", "CLOSED"])
    .optional()
    .describe("OPEN=Terbuka, IN_PROGRESS=Dikerjakan, PENDING_VERIFICATION=Menunggu Verifikasi, CLOSED=Selesai"),
  areaCode: z.string().optional().describe("Kode area (P3-HPD-2W) atau departemen (P2)"),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  belumDiassign: z.boolean().optional().describe("true = hanya temuan Terbuka tanpa PIC"),
  overdue: z.boolean().optional().describe("true = hanya yang lewat target & belum selesai"),
  keyword: z.string().optional().describe("Kata kunci di deskripsi/lokasi"),
  limit: z.number().int().min(1).max(50).default(20),
});

const perAreaSchema = z.object({
  deptCode: z.string().optional().describe("Kode departemen, mis. P1/P2/P3/P4. Kosong = semua."),
  status: z.enum(["OPEN", "IN_PROGRESS", "PENDING_VERIFICATION", "CLOSED"]).optional(),
});

const detailSchema = z.object({
  nomor: z.string().describe("Nomor temuan, contoh SF-2026-0042"),
});

const leaderboardSchema = z.object({
  periode: z.enum(["month", "all"]).default("month").describe("month = bulan berjalan, all = sepanjang waktu"),
});

const buatSchema = z.object({
  deskripsi: z.string().min(10).max(1000).describe("Uraian temuan, minimal 10 karakter"),
  lokasi: z.string().max(300).optional().describe("Teks lokasi bebas, mis. 'P3 HPD 15' atau 'dekat casting P2'"),
});

/** Registrasi semua tools MCP ke instance server (dipanggil per request). */
export function registerSafetyTools(server: McpServer) {
  server.registerTool(
    "ringkasan_status",
    {
      title: "Ringkasan Status Temuan",
      description:
        "Jumlah temuan per status (terbuka, dikerjakan, menunggu verifikasi, selesai bulan ini), jumlah overdue (lewat target), dan rata-rata hari penyelesaian.",
    },
    async () => {
      const k = await getKpis();
      return text({
        terbuka: k.open,
        dikerjakan: k.inProgress,
        menungguVerifikasi: k.pending,
        selesaiBulanIni: k.closedThisMonth,
        overdue: k.overdue,
        rataRataHariPenyelesaian: k.avgCloseDays ? Math.round(k.avgCloseDays * 10) / 10 : null,
      });
    },
  );

  server.registerTool(
    "cari_temuan",
    {
      title: "Cari Temuan",
      description:
        "Cari temuan dengan filter: status, kode area/departemen (mis. P2, P3-HPD-2W), tingkat risiko, hanya yang belum ada PIC (belumDiassign), hanya yang overdue, kata kunci deskripsi. Default mengurutkan dari terbaru.",
      inputSchema: cariSchema,
    },
    async (args: z.infer<typeof cariSchema>) => {
      const where: Prisma.FindingWhereInput = { isValid: true };
      if (args.status) where.status = args.status;
      if (args.riskLevel) where.riskLevel = args.riskLevel;
      if (args.areaCode)
        where.OR = [
          { area: { code: args.areaCode } },
          { area: { department: { code: args.areaCode.toUpperCase() } } },
        ];
      if (args.belumDiassign) {
        where.status = "OPEN";
        where.picId = null;
      }
      if (args.overdue) {
        where.status = { not: "CLOSED" };
        where.dueDate = { lt: wibToday() };
      }
      if (args.keyword) {
        where.AND = [
          {
            OR: [
              { description: { contains: args.keyword, mode: "insensitive" } },
              { locationDetail: { contains: args.keyword, mode: "insensitive" } },
            ],
          },
        ];
      }
      const rows = await prisma.finding.findMany({
        where,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: args.limit,
        select: findingSelect,
      });
      return text({ jumlah: rows.length, temuan: rows.map(shapeFinding) });
    },
  );

  server.registerTool(
    "detail_temuan",
    {
      title: "Detail Temuan",
      description: "Detail lengkap satu temuan berdasarkan nomornya (mis. SF-2026-0042), termasuk histori status dan jumlah foto.",
      inputSchema: detailSchema,
    },
    async ({ nomor }: z.infer<typeof detailSchema>) => {
      const f: FindingDetail | null = await prisma.finding.findUnique({
        where: { number: nomor },
        select: detailSelect,
      });
      if (!f) return text({ error: `Temuan ${nomor} tidak ditemukan` });
      return text({
        ...shapeFinding(f),
        masihValid: f.isValid,
        catatanTindakan: f.actionNote,
        catatanPenolakan: f.rejectionNote,
        selesaiPada: f.closedAt?.toISOString() ?? null,
        foto: f.photos.map((p) => ({ tipe: p.type, path: p.filePath })),
        histori: f.statusHistory.map((h) => ({
          dari: h.fromStatus ? statusLabel(h.fromStatus) : null,
          ke: statusLabel(h.toStatus),
          oleh: h.actor.name,
          catatan: h.note,
          pada: h.createdAt.toISOString(),
        })),
      });
    },
  );

  server.registerTool(
    "temuan_per_area",
    {
      title: "Rekap Temuan per Area",
      description: "Jumlah temuan (valid) dikelompokkan per area dalam satu departemen atau seluruh plant. Berguna untuk menjawab 'area mana paling banyak temuan'.",
      inputSchema: perAreaSchema,
    },
    async (args: z.infer<typeof perAreaSchema>) => {
      const grouped = await prisma.finding.groupBy({
        by: ["areaId"],
        where: {
          isValid: true,
          ...(args.status ? { status: args.status } : {}),
          ...(args.deptCode ? { area: { department: { code: args.deptCode.toUpperCase() } } } : {}),
        },
        _count: true,
      });
      const areas = await prisma.area.findMany({
        where: { id: { in: grouped.map((g) => g.areaId) } },
        select: { id: true, code: true, name: true, department: { select: { code: true } } },
      });
      const byId = new Map(areas.map((a) => [a.id, a]));
      const rows = grouped
        .map((g) => ({
          area: byId.get(g.areaId)?.name ?? "?",
          kodeArea: byId.get(g.areaId)?.code ?? "?",
          departemen: byId.get(g.areaId)?.department.code ?? "?",
          jumlah: g._count,
        }))
        .sort((a, b) => b.jumlah - a.jumlah);
      return text({ jumlahArea: rows.length, rekap: rows });
    },
  );

  server.registerTool(
    "skor_5s_area",
    {
      title: "Skor 5S per Area",
      description: "Skor 5S terbaru (0-100) per area dari audit yang sudah disubmit, beserta skor sebelumnya untuk melihat tren.",
    },
    async () => {
      const rows = await getAreaScores();
      return text(
        rows.map((r) => ({
          area: r.name,
          departemen: r.departmentCode,
          skor: r.score,
          skorSebelumnya: r.prevScore,
          auditTerakhir: r.lastAuditAt?.toISOString() ?? null,
        })),
      );
    },
  );

  server.registerTool(
    "leaderboard_pelapor",
    {
      title: "Leaderboard Pelapor",
      description: "Peringkat karyawan paling aktif melaporkan temuan (bulan ini atau sepanjang waktu).",
      inputSchema: leaderboardSchema,
    },
    async ({ periode }: z.infer<typeof leaderboardSchema>) => {
      const rows = await getReporterLeaderboard(periode);
      return text(
        rows.map((r) => ({
          peringkat: r.rank,
          nama: r.user.name,
          departemen: r.user.department?.code ?? null,
          jumlahLaporan: r.count,
        })),
      );
    },
  );

  server.registerTool(
    "buat_temuan",
    {
      title: "Buat Temuan Baru",
      description:
        "Buat temuan safety baru (status Terbuka) dari teks. Area ditebak otomatis dari teks lokasi/deskripsi (mis. 'di HPD 15 P3' → area HPD 2W). Kategori & risiko ditebak dari kata kunci; koreksi lewat aplikasi bila perlu.",
      inputSchema: buatSchema,
    },
    async ({ deskripsi, lokasi }: z.infer<typeof buatSchema>) => {
      const result = await createFindingFromIntake({
        description: deskripsi,
        areaText: lokasi,
        reporterNpk: "WA-BOT",
      });
      if (!result.ok) return text({ error: result.error });
      return text({
        sukses: true,
        nomor: result.number,
        area: result.areaName,
        pesan: `Temuan ${result.number} tercatat di area ${result.areaName} dengan status Terbuka.`,
      });
    },
  );
}
