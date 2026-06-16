import GlobalEndpoint, { requestJson } from "../../../global.service";
import type {
  ContractArchiveRow,
  PpLedgerRow,
  QuestHistoryRow,
  RecentSummaryMetric,
  TransactionHistoryRow,
} from "./recent";

export const RECENT_SUBVIEW_STORAGE_KEY_SEED = "nvrs-qqm-recent-subview-v1";

export type RecentEscrowPipelineStepSeed = {
  label: string;
  icon: string;
};

export const recentEscrowPipelineStepsSeed: RecentEscrowPipelineStepSeed[] = [
  { label: "Uang Ditahan", icon: "🔒" },
  { label: "Selesai", icon: "✅" },
  { label: "Potong Fee 5%", icon: "💸" },
  { label: "Dana Cair", icon: "🏦" },
];

export type RecentViewCopy = {
  hero: {
    eyebrow: string;
    title: string;
    simulationBadge: string;
  };
  contractArchive: {
    eyebrow: string;
    title: string;
    tableHeaders: string[];
  };
  questHistory: {
    eyebrow: string;
    title: string;
    progressPrefix: string;
  };
  escrowPipeline: {
    title: string;
    frozenLabel: string;
    detailCaseButton: string;
    disputeButton: string;
  };
  transactionHistory: {
    eyebrow: string;
    title: string;
    mobileStatusSuffix: string;
    tableHeaders: string[];
  };
  ppLedger: {
    eyebrow: string;
    title: string;
    tableHeaders: string[];
  };
  disputeCenter: {
    backButton: string;
    frozenBadge: string;
    pageTitle: string;
    reasonLabel: string;
    reasonOptions: string[];
    descriptionLabel: string;
    descriptionPlaceholder: string;
    uploadLabel: string;
    submitButton: string;
    policyTitle: string;
    policyRules: string[];
    historyTitle: string;
    historyEmptyStatus: string;
    historyEmptyDesc: string;
  };
};

export const recentViewCopySeed: RecentViewCopy = {
  hero: {
    eyebrow: "Riwayat Engine",
    title: "Contract Archive, Quest Lifecycle, Transaksi, dan PP Ledger",
    simulationBadge: "Full history simulation",
  },
  contractArchive: {
    eyebrow: "Contract Archive",
    title: "Arsip Kontrak Kerja (Open, In Progress, Completed, Disputed)",
    tableHeaders: [
      "Contract ID",
      "Quest",
      "Giver",
      "Runner",
      "Tipe",
      "Status",
      "Mulai",
      "Selesai",
      "Nilai",
    ],
  },
  questHistory: {
    eyebrow: "Quest History & Escrow",
    title: "Lacak Quest Aktif dan Keamanan Dana",
    progressPrefix: "Progress",
  },
  escrowPipeline: {
    title: "Escrow Tracker Pipeline",
    frozenLabel: "Dana Dibekukan (Dalam Investigasi Dispute)",
    detailCaseButton: "Detail Kasus",
    disputeButton: "Dispute / Lapor",
  },
  transactionHistory: {
    eyebrow: "Transaction History",
    title: "Riwayat Transaksi Escrow, Fee, dan Refund",
    mobileStatusSuffix: "Status",
    tableHeaders: ["Tx ID", "Quest", "Tipe", "Nominal", "Status", "Waktu"],
  },
  ppLedger: {
    eyebrow: "PP Ledger",
    title: "Change Log Performance Point (Credit/Penalty)",
    tableHeaders: [
      "Ledger ID",
      "Skill",
      "Perubahan",
      "Alasan",
      "Saldo Setelah",
      "Waktu",
    ],
  },
  disputeCenter: {
    backButton: "Kembali ke Riwayat Escrow",
    frozenBadge: "DANA DIBEKUKAN",
    pageTitle: "Ajukan Komplain Escrow",
    reasonLabel: "Pilih Alasan Laporan",
    reasonOptions: [
      "Honor tidak sesuai kesepakatan awal",
      "Scope kerja melebihi brief (Scope creep)",
      "Perlakuan tidak pantas dari Pemberi Kerja",
      "Pemberi Kerja tidak dapat dihubungi saat penyelesaian",
      "Nominal escrow dicairkan sepihak sebelum selesai",
    ],
    descriptionLabel: "Jelaskan Kronologi (Dengan Bukti)",
    descriptionPlaceholder: "Ceritakan kendala yang kamu hadapi di lapangan...",
    uploadLabel: "+ Unggah Bukti Percakapan / Foto Hasil",
    submitButton: "Kirim Laporan & Tahan Dana",
    policyTitle: "Escrow Dispute Policy (Runner)",
    policyRules: [
      "Admin Neiraverse akan menengahi kasus dalam kurun waktu maks 2x24 Jam.",
      "Dana tertahan di Escrow tidak dapat ditarik pihak manapun selama status 'Disputed'.",
      "Memberikan laporan palsu akan dikenakan sanksi pinalti Penurunan PP (Performance Points).",
    ],
    historyTitle: "Histori Percakapan Dispute",
    historyEmptyStatus: "Laporan Baru Dikirim",
    historyEmptyDesc: "Menunggu admin menunjuk mediator untuk kasus ini...",
  },
};

export const recentSummaryMetrics: RecentSummaryMetric[] = [
  { label: "Total Kontrak", value: "126", hint: "28 aktif saat ini", tone: "bg-[#DBEAFE]" },
  { label: "Quest Selesai", value: "394", hint: "86.9% completion", tone: "bg-[#DCFCE7]" },
  { label: "Transaksi Sukses", value: "Rp18.6jt", hint: "escrow release bersih", tone: "bg-[#FEF3C7]" },
  { label: "Perubahan PP", value: "+412", hint: "30 hari terakhir", tone: "bg-[#E9D5FF]" },
];

export const contractArchiveRows: ContractArchiveRow[] = [
  {
    contractId: "CTR-2026-0411-001",
    questTitle: "Bersihkan Toko Sembako",
    giver: "Toko Aulia",
    runner: "Neira",
    type: "Per-Individu",
    status: "Completed",
    startDate: "2026-04-10 08:20",
    endDate: "2026-04-10 11:12",
    value: "Rp250.000",
  },
  {
    contractId: "CTR-2026-0411-002",
    questTitle: "Membersihkan Kandang Ayam",
    giver: "Pak Rijal",
    runner: "Tim Kebersihan 3/5",
    type: "Ber-Kelompok",
    status: "In Progress",
    startDate: "2026-04-11 09:00",
    endDate: "-",
    value: "Rp350.000",
  },
  {
    contractId: "CTR-2026-0411-003",
    questTitle: "Pickup Dokumen Kantor",
    giver: "PT Nabiru",
    runner: "Farel",
    type: "Per-Individu",
    status: "Pending Confirmation",
    startDate: "2026-04-11 12:45",
    endDate: "-",
    value: "Rp180.000",
  },
  {
    contractId: "CTR-2026-0411-004",
    questTitle: "Rapikan Booth Event",
    giver: "Eventoria",
    runner: "Miska",
    type: "Per-Individu",
    status: "Disputed",
    startDate: "2026-04-09 16:10",
    endDate: "2026-04-09 20:30",
    value: "Rp300.000",
  },
  {
    contractId: "CTR-2026-0412-001",
    questTitle: "Restock Minimarket",
    giver: "MiniMart Sejahtera",
    runner: "Raka",
    type: "Per-Individu",
    status: "Open",
    startDate: "2026-04-12 07:30",
    endDate: "-",
    value: "Rp140.000",
  },
];

export const questHistoryRows: QuestHistoryRow[] = [
  { questId: "QST-001", title: "Bersihkan Toko Sembako", category: "Cleaning", status: "Completed", progress: "100%", updatedAt: "2026-04-10 11:12" },
  { questId: "QST-002", title: "Membersihkan Kandang Ayam", category: "Cleaning", status: "In Progress", progress: "62%", updatedAt: "2026-04-11 14:21" },
  { questId: "QST-003", title: "Pickup Dokumen Kantor", category: "Delivery", status: "Pending Confirmation", progress: "88%", updatedAt: "2026-04-11 13:53" },
  { questId: "QST-004", title: "Rapikan Booth Event", category: "Retail", status: "Disputed", progress: "100%", updatedAt: "2026-04-09 20:40" },
  { questId: "QST-005", title: "Restock Minimarket", category: "Retail", status: "Open", progress: "0%", updatedAt: "2026-04-12 07:30" },
];

export const transactionHistoryRows: TransactionHistoryRow[] = [
  { transactionId: "TX-9011", questTitle: "Bersihkan Toko Sembako", type: "Escrow Lock", amount: "Rp250.000", status: "Success", createdAt: "2026-04-10 08:25" },
  { transactionId: "TX-9012", questTitle: "Bersihkan Toko Sembako", type: "Escrow Release", amount: "Rp235.000", status: "Success", createdAt: "2026-04-10 11:20" },
  { transactionId: "TX-9013", questTitle: "Bersihkan Toko Sembako", type: "Platform Fee", amount: "Rp15.000", status: "Success", createdAt: "2026-04-10 11:20" },
  { transactionId: "TX-9021", questTitle: "Membersihkan Kandang Ayam", type: "Escrow Lock", amount: "Rp350.000", status: "Success", createdAt: "2026-04-11 09:02" },
  { transactionId: "TX-9031", questTitle: "Rapikan Booth Event", type: "Refund", amount: "Rp300.000", status: "Pending", createdAt: "2026-04-09 21:05" },
];

export const ppLedgerRows: PpLedgerRow[] = [
  { ledgerId: "PP-6701", skill: "Cleaning", change: "+32", reason: "Quest selesai tepat waktu", balanceAfter: "6,120", createdAt: "2026-04-10 11:25" },
  { ledgerId: "PP-6702", skill: "Delivery", change: "+14", reason: "Dokumen diterima sesuai SLA", balanceAfter: "6,134", createdAt: "2026-04-11 13:59" },
  { ledgerId: "PP-6703", skill: "Retail", change: "-5", reason: "Cancel penalty (brief berubah)", balanceAfter: "6,129", createdAt: "2026-04-11 14:10" },
  { ledgerId: "PP-6704", skill: "Cleaning", change: "+24", reason: "Quality review > 4.8", balanceAfter: "6,153", createdAt: "2026-04-11 19:02" },
  { ledgerId: "PP-6705", skill: "Retail", change: "+18", reason: "Inventory task selesai tanpa issue", balanceAfter: "6,171", createdAt: "2026-04-12 08:04" },
];

// ─── GIVER MODE DATA ────────────────────────────────────────────────────────
// ESVMC Point 13: Semua teks/data tampilan disimpan di service.ts

export const recentGiverViewCopySeed: RecentViewCopy = {
  hero: {
    eyebrow: "Riwayat Giver",
    title: "Quest Archive, Escrow Pipeline, Transaksi, dan Reputasi Giver",
    simulationBadge: "Full history simulation (Giver Mode)",
  },
  contractArchive: {
    eyebrow: "Quest Archive",
    title: "Arsip Quest yang Kamu Berikan (Open, In Progress, Completed, Disputed)",
    tableHeaders: [
      "Contract ID",
      "Quest",
      "Giver",
      "Runner",
      "Tipe",
      "Status",
      "Mulai",
      "Selesai",
      "Nilai",
    ],
  },
  questHistory: {
    eyebrow: "Quest History & Escrow",
    title: "Pantau Quest yang Kamu Buat dan Keamanan Escrow-mu",
    progressPrefix: "Progress",
  },
  escrowPipeline: {
    title: "Escrow Tracker Pipeline",
    frozenLabel: "Dana Dibekukan (Dalam Investigasi Dispute)",
    detailCaseButton: "Detail Kasus",
    disputeButton: "Dispute / Laporkan Runner",
  },
  transactionHistory: {
    eyebrow: "Transaction History",
    title: "Riwayat Pengeluaran Escrow, Fee Platform, dan Refund",
    mobileStatusSuffix: "Status",
    tableHeaders: ["Tx ID", "Quest", "Tipe", "Nominal", "Status", "Waktu"],
  },
  ppLedger: {
    eyebrow: "Reputasi Giver",
    title: "Riwayat Perubahan Skor Reputasi Giver (Credit/Penalty)",
    tableHeaders: [
      "Ledger ID",
      "Kategori",
      "Perubahan",
      "Alasan",
      "Skor Setelah",
      "Waktu",
    ],
  },
  disputeCenter: {
    backButton: "Kembali ke Riwayat Escrow",
    frozenBadge: "DANA DIBEKUKAN",
    pageTitle: "Laporan Kejanggalan Quest",
    reasonLabel: "Pilih Alasan Laporan",
    reasonOptions: [
      "Runner tidak datang / No Show",
      "Hasil pekerjaan tidak sesuai dengan spesifikasi form",
      "Sikap / Attitude Runner buruk (Pelanggaran kode etik)",
      "Permasalahan Escrow (Nominal tidak sesuai)",
      "Runner merusak perlengkapan/aset di lokasi",
    ],
    descriptionLabel: "Jelaskan Kronologi (Dengan Bukti)",
    descriptionPlaceholder: "Ceritakan detail pelanggaran yang terjadi...",
    uploadLabel: "+ Unggah Bukti Tangkap Layar / Foto Lokasi",
    submitButton: "Kirim Laporan & Tahan Dana",
    policyTitle: "Escrow Dispute Policy (Giver)",
    policyRules: [
      "Admin Neiraverse akan menengahi kasus dalam kurun waktu maks 2x24 Jam.",
      "Dana tertahan di Escrow tidak dapat ditarik pihak manapun selama status 'Disputed'.",
      "Memberikan laporan palsu akan dikenakan sanksi pinalti Penurunan PP (Performance Points).",
    ],
    historyTitle: "Histori Percakapan Dispute",
    historyEmptyStatus: "Laporan Masuk",
    historyEmptyDesc: "Menunggu tanggapan dari kedua belah pihak...",
  },
};

export const recentGiverSummaryMetrics: RecentSummaryMetric[] = [
  { label: "Total Quest Dibuat", value: "48", hint: "12 aktif saat ini", tone: "bg-[#DBEAFE]" },
  { label: "Quest Selesai", value: "31", hint: "86.1% completion rate", tone: "bg-[#DCFCE7]" },
  { label: "Total Escrow Keluar", value: "Rp21.3jt", hint: "escrow release bersih", tone: "bg-[#FEF3C7]" },
  { label: "Skor Reputasi", value: "+186", hint: "30 hari terakhir", tone: "bg-[#E9D5FF]" },
];

export const giverContractArchiveRows: ContractArchiveRow[] = [
  {
    contractId: "CTR-2026-0411-G01",
    questTitle: "Bersihkan Toko Sembako",
    giver: "Toko Aulia (Kamu)",
    runner: "Neira",
    type: "Per-Individu",
    status: "Completed",
    startDate: "2026-04-10 08:20",
    endDate: "2026-04-10 11:12",
    value: "Rp250.000",
  },
  {
    contractId: "CTR-2026-0411-G02",
    questTitle: "Membersihkan Kandang Ayam",
    giver: "Toko Aulia (Kamu)",
    runner: "Tim Kebersihan 3/5",
    type: "Ber-Kelompok",
    status: "In Progress",
    startDate: "2026-04-11 09:00",
    endDate: "-",
    value: "Rp350.000",
  },
  {
    contractId: "CTR-2026-0411-G03",
    questTitle: "Antar Stok ke Cabang",
    giver: "Toko Aulia (Kamu)",
    runner: "Farel",
    type: "Per-Individu",
    status: "Pending Confirmation",
    startDate: "2026-04-11 14:00",
    endDate: "-",
    value: "Rp200.000",
  },
  {
    contractId: "CTR-2026-0411-G04",
    questTitle: "Rapikan Display Warung",
    giver: "Toko Aulia (Kamu)",
    runner: "Miska",
    type: "Per-Individu",
    status: "Disputed",
    startDate: "2026-04-09 16:10",
    endDate: "2026-04-09 20:30",
    value: "Rp300.000",
  },
  {
    contractId: "CTR-2026-0412-G01",
    questTitle: "Restock Area Minuman",
    giver: "Toko Aulia (Kamu)",
    runner: "Raka",
    type: "Per-Individu",
    status: "Open",
    startDate: "2026-04-12 07:30",
    endDate: "-",
    value: "Rp150.000",
  },
];

export const giverQuestHistoryRows: QuestHistoryRow[] = [
  { questId: "QST-G01", title: "Bersihkan Toko Sembako", category: "Cleaning", status: "Completed", progress: "100%", updatedAt: "2026-04-10 11:12" },
  { questId: "QST-G02", title: "Membersihkan Kandang Ayam", category: "Cleaning", status: "In Progress", progress: "62%", updatedAt: "2026-04-11 14:21" },
  { questId: "QST-G03", title: "Antar Stok ke Cabang", category: "Delivery", status: "Pending Confirmation", progress: "90%", updatedAt: "2026-04-11 14:55" },
  { questId: "QST-G04", title: "Rapikan Display Warung", category: "Retail", status: "Disputed", progress: "100%", updatedAt: "2026-04-09 20:40" },
  { questId: "QST-G05", title: "Restock Area Minuman", category: "Retail", status: "Open", progress: "0%", updatedAt: "2026-04-12 07:30" },
];

export const giverTransactionHistoryRows: TransactionHistoryRow[] = [
  { transactionId: "TX-G9011", questTitle: "Bersihkan Toko Sembako", type: "Escrow Lock", amount: "Rp250.000", status: "Success", createdAt: "2026-04-10 08:25" },
  { transactionId: "TX-G9012", questTitle: "Bersihkan Toko Sembako", type: "Escrow Release", amount: "Rp235.000", status: "Success", createdAt: "2026-04-10 11:20" },
  { transactionId: "TX-G9013", questTitle: "Bersihkan Toko Sembako", type: "Platform Fee", amount: "Rp15.000", status: "Success", createdAt: "2026-04-10 11:20" },
  { transactionId: "TX-G9021", questTitle: "Membersihkan Kandang Ayam", type: "Escrow Lock", amount: "Rp350.000", status: "Success", createdAt: "2026-04-11 09:02" },
  { transactionId: "TX-G9031", questTitle: "Rapikan Display Warung", type: "Refund", amount: "Rp300.000", status: "Pending", createdAt: "2026-04-09 21:05" },
];

export const giverPpLedgerRows: PpLedgerRow[] = [
  { ledgerId: "GR-3101", skill: "Reputasi", change: "+18", reason: "Quest selesai tepat waktu oleh runner", balanceAfter: "540", createdAt: "2026-04-10 11:30" },
  { ledgerId: "GR-3102", skill: "Reputasi", change: "+12", reason: "Runner beri rating 5 bintang ke Giver", balanceAfter: "552", createdAt: "2026-04-11 14:05" },
  { ledgerId: "GR-3103", skill: "Reputasi", change: "-8", reason: "Brief berubah setelah escrow lock", balanceAfter: "544", createdAt: "2026-04-11 14:12" },
  { ledgerId: "GR-3104", skill: "Reputasi", change: "+22", reason: "Quest group selesai tanpa dispute", balanceAfter: "566", createdAt: "2026-04-11 19:10" },
  { ledgerId: "GR-3105", skill: "Reputasi", change: "+14", reason: "Escrow release cepat < 5 menit", balanceAfter: "580", createdAt: "2026-04-12 08:10" },
];

// ─── ROLE DATA SEED MAP ──────────────────────────────────────────────────────

export type RecentRoleDataSeed = {
  viewCopy: RecentViewCopy;
  summaryMetrics: RecentSummaryMetric[];
  contractArchiveRows: ContractArchiveRow[];
  questHistoryRows: QuestHistoryRow[];
  transactionHistoryRows: TransactionHistoryRow[];
  ppLedgerRows: PpLedgerRow[];
};

export const recentRoleDataSeed: Record<"runner" | "giver", RecentRoleDataSeed> = {
  runner: {
    viewCopy: recentViewCopySeed,
    summaryMetrics: recentSummaryMetrics,
    contractArchiveRows: contractArchiveRows,
    questHistoryRows: questHistoryRows,
    transactionHistoryRows: transactionHistoryRows,
    ppLedgerRows: ppLedgerRows,
  },
  giver: {
    viewCopy: recentGiverViewCopySeed,
    summaryMetrics: recentGiverSummaryMetrics,
    contractArchiveRows: giverContractArchiveRows,
    questHistoryRows: giverQuestHistoryRows,
    transactionHistoryRows: giverTransactionHistoryRows,
    ppLedgerRows: giverPpLedgerRows,
  },
};

type ApiEnvelope<T> = {
  data?: T;
};

type ApiHistoryQuest = {
  id?: string;
  quest_id?: string;
  title?: string;
  category?: string;
  mode?: string;
  status?: string;
  reward_amount?: string;
  reward_display?: string;
  updated_at?: string | null;
  giver?: {
    fullname?: string;
    username?: string;
  };
};

type ApiHistoryItem = {
  assignment_id?: string;
  assignment_status?: string;
  finished_at?: string | null;
  quest?: ApiHistoryQuest;
  escrow?: {
    escrow_state?: string;
  };
  rating_state?: {
    both_rated?: boolean;
  };
} & ApiHistoryQuest;

function normalizeHistoryStatus(item: ApiHistoryItem): QuestHistoryRow["status"] {
  const assignmentStatus = (item.assignment_status ?? "").toLowerCase();
  const questStatus = (item.quest?.status ?? item.status ?? "").toLowerCase();
  const escrowState = (item.escrow?.escrow_state ?? "").toLowerCase();
  if (assignmentStatus === "disputed" || questStatus === "disputed" || escrowState === "disputed") {
    return "Disputed";
  }
  if (item.rating_state?.both_rated || (questStatus === "completed" && escrowState === "released")) {
    return "Completed";
  }
  if (assignmentStatus === "finished" || questStatus === "pending_review" || escrowState === "pending") {
    return "Pending Confirmation";
  }
  if (assignmentStatus === "active" || questStatus === "in_progress" || escrowState === "in_progress") {
    return "In Progress";
  }
  return "Open";
}

function formatHistoryDate(value?: string | null): string {
  if (!value) return "Baru saja";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("id-ID") : "Baru saja";
}

function formatHistoryValue(item: ApiHistoryItem): string {
  const quest = item.quest ?? item;
  if (quest.reward_display) return quest.reward_display;
  const amount = Number((quest.reward_amount ?? "").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return "Rp0";
  return `Rp${amount.toLocaleString("id-ID")}`;
}

function mapHistoryItem(item: ApiHistoryItem, roleContext: "runner" | "giver"): {
  quest: QuestHistoryRow;
  contract: ContractArchiveRow;
} {
  const quest = item.quest ?? item;
  const questId = quest.id || quest.quest_id || item.assignment_id || "QUEST-HISTORY";
  const title = quest.title || "Quest selesai";
  const status = normalizeHistoryStatus(item);
  const updatedAt = formatHistoryDate(item.finished_at || quest.updated_at);
  const giverName = roleContext === "runner"
    ? quest.giver?.fullname || quest.giver?.username || "Verified Giver"
    : "Kamu";

  return {
    quest: {
      questId,
      title,
      category: quest.category || "General",
      status,
      progress: status === "Completed" ? "Loop selesai: release + both-rated" : "Riwayat sengketa/fallback",
      updatedAt,
    },
    contract: {
      contractId: item.assignment_id || questId,
      questTitle: title,
      giver: giverName,
      runner: roleContext === "runner" ? "Kamu" : "Runner terkait",
      type: (quest.mode ?? "").toLowerCase() === "group" ? "Ber-Kelompok" : "Per-Individu",
      status,
      startDate: updatedAt,
      endDate: updatedAt,
      value: formatHistoryValue(item),
    },
  };
}

export async function fetchRecentHistoryFromApi(roleContext: "runner" | "giver"): Promise<{
  contractArchiveRows: ContractArchiveRow[];
  questHistoryRows: QuestHistoryRow[];
}> {
  const endpoint = roleContext === "giver"
    ? GlobalEndpoint().giverQuest.history
    : GlobalEndpoint().runnerQuest.history;
  const response = await requestJson<ApiEnvelope<{ items?: ApiHistoryItem[] }>>(endpoint);
  const rows = Array.isArray(response.data?.items) ? response.data.items : [];
  const mapped = rows.map((item) => mapHistoryItem(item, roleContext));
  return {
    contractArchiveRows: mapped.map((item) => item.contract),
    questHistoryRows: mapped.map((item) => item.quest),
  };
}

export type RecentDisputeEvidence = {
  id?: string;
  uploader?: "GIVER" | "RUNNER" | "MEDIATOR" | string;
  type?: string;
  label?: string;
  uploadedAt?: string;
  url?: string;
  file_name?: string;
  note_text?: string;
  metadata?: Record<string, unknown>;
};

export type RecentDisputeCase = {
  id: string;
  questId?: string;
  questTitle?: string;
  assignmentId?: string;
  amount?: string;
  raisedBy?: "GIVER" | "RUNNER" | string;
  raisedAt?: string;
  status?: string;
  evidenceDeadline?: string;
  reason?: string;
  mediatorNote?: string;
  giverEvidence?: RecentDisputeEvidence[];
  runnerEvidence?: RecentDisputeEvidence[];
  timeline?: Array<{
    status?: string;
    time?: string;
    description?: string;
  }>;
};

export type RecentDisputeEvidencePayload = {
  type: "photo" | "video" | "file" | "note";
  label: string;
  note_text?: string;
  file_name?: string;
  file_url?: string;
  metadata?: Record<string, unknown>;
};

export async function fetchRecentDisputesFromApi(): Promise<RecentDisputeCase[]> {
  const response = await requestJson<ApiEnvelope<{ items?: RecentDisputeCase[] }>>(
    GlobalEndpoint().dispute.list,
  );
  return Array.isArray(response.data?.items) ? response.data.items : [];
}

export async function fetchRecentDisputeDetailFromApi(disputeId: string): Promise<RecentDisputeCase> {
  const response = await requestJson<ApiEnvelope<RecentDisputeCase>>(
    GlobalEndpoint().dispute.detail(disputeId),
  );
  if (!response.data) {
    throw new Error("Detail dispute tidak ditemukan.");
  }
  return response.data;
}

export async function submitRecentDisputeEvidenceFromApi(
  disputeId: string,
  payload: RecentDisputeEvidencePayload,
): Promise<RecentDisputeCase> {
  const response = await requestJson<ApiEnvelope<RecentDisputeCase>>(
    GlobalEndpoint().dispute.evidence(disputeId),
    {
      method: "POST",
      body: payload,
    },
  );
  if (!response.data) {
    throw new Error("Evidence dispute gagal disimpan.");
  }
  return response.data;
}
