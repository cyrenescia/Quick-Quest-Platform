import GlobalEndpoint, { postJson, requestJson } from "../../../global.service";
import type {
  RunnerActiveQuest,
  RunnerAvailabilitySlot,
  RunnerCareerMetric,
  RunnerEarningPoint,
  RunnerMember,
  RunnerOpenParty,
  RunnerPartyLobbyChatMessage,
  RunnerPartyLobbyInfo,
  RunnerReliabilityBadge,
  RunnerSkillInventoryItem,
} from "./runner";

export const RUNNER_SUBVIEW_STORAGE_KEY_SEED = "nvrs-qqm-runner-subview-v1";
const AUTO_RELEASE_TIMEOUT_HOURS = 24;

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data: T;
};

type ApiQuest = {
  id: string;
  title: string;
  category?: string;
  mode?: "solo" | "group" | string;
  status?: string;
  skill_tags?: string[];
  reward_amount?: string;
  reward_display?: string;
  distance_km?: number | null;
  matching?: {
    active_radius_km?: number;
    next_radius_km?: number;
    next_expand_in_seconds?: number;
    matching_scope?: string;
    within_match_radius?: boolean;
  };
  giver?: {
    fullname?: string;
    username?: string;
  };
  location?: {
    label?: string;
    full_address?: string;
    sub_district?: string;
    district?: string;
    city?: string;
    lat?: number | null;
    lng?: number | null;
  };
  capacity?: {
    max_runner?: number | null;
    current_runner_count?: number | null;
  };
  description?: string;
  created_at?: string | null;
  published_at?: string | null;
};

type ApiRunnerAssignment = {
  assignment_id?: string;
  assignment_status?: string;
  started_at?: string | null;
  finished_at?: string | null;
  work_location?: ApiWorkLocation | null;
  location_shared_at?: string | null;
  rating_state?: ApiRatingState;
  escrow?: {
    escrow_state?: string;
  };
  quest?: ApiQuest;
};

type ApiWorkLocation = {
  label?: string;
  full_address?: string;
  province?: string;
  city?: string;
  district?: string;
  sub_district?: string;
  postal_code?: string;
  lat?: number | string | null;
  lng?: number | string | null;
  note?: string;
  shared_at?: string | null;
  shared_by?: string;
};

type ApiRatingState = {
  rating_count?: number;
  unique_rating_count?: number;
  giver_rated?: boolean;
  runner_rated?: boolean;
  viewer_has_rated?: boolean;
  both_rated?: boolean;
};

let runnerQuestFeedCache: RunnerQuestFeedItem[] = [];

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function formatCurrency(value: unknown): string {
  const amount = toNumber(value);
  if (!amount) return "Rp0";
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function formatDate(value?: string | null): string {
  if (!value) return "Baru saja";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("id-ID") : "Baru saja";
}

function resolveAutoReleaseAt(finishedAt?: string | null, escrowStatus?: string): string | null {
  if (!finishedAt || (escrowStatus ?? "").toLowerCase() === "released") return null;
  const finishedDate = new Date(finishedAt);
  if (!Number.isFinite(finishedDate.getTime())) return null;
  return new Date(
    finishedDate.getTime() + AUTO_RELEASE_TIMEOUT_HOURS * 60 * 60 * 1000,
  ).toISOString();
}

function resolveSecondsUntil(value?: string | null): number {
  if (!value) return 0;
  const target = new Date(value).getTime();
  if (!Number.isFinite(target)) return 0;
  return Math.max(0, Math.ceil((target - Date.now()) / 1000));
}

function normalizeRunnerEscrow(
  status?: string,
  escrowStatus?: string,
): RunnerActiveQuest["escrowState"] {
  switch ((escrowStatus ?? "").toLowerCase()) {
    case "in_progress":
      return "IN_PROGRESS";
    case "pending":
      return "PENDING_CONFIRMATION";
    case "released":
      return "RELEASED";
    default:
      break;
  }

  switch ((status ?? "").toLowerCase()) {
    case "active":
    case "in_progress":
      return "IN_PROGRESS";
    case "finished":
    case "pending_review":
      return "PENDING_CONFIRMATION";
    case "completed":
      return "RELEASED";
    default:
      return "LOCKED";
  }
}

function normalizeRunnerStatus(
  status?: string,
  escrowStatus?: string,
): RunnerActiveQuest["status"] {
  if ((escrowStatus ?? "").toLowerCase() === "released") {
    return "COMPLETED";
  }

  switch ((status ?? "").toLowerCase()) {
    case "pending":
      return "PENDING_GIVER_CONFIRMATION";
    case "active":
    case "in_progress":
      return "IN_PROGRESS";
    case "finished":
    case "pending_review":
      return "PENDING_CONFIRMATION";
    case "completed":
      return "COMPLETED";
    default:
      return "HEADING_TO_LOCATION";
  }
}

export function mapRunnerQuestFeedFromApi(quest: ApiQuest): RunnerQuestFeedItem {
  const currentCount = toNumber(quest.capacity?.current_runner_count);
  const maxRunner = Math.max(1, toNumber(quest.capacity?.max_runner, 1));
  const mode = (quest.mode ?? "solo").toLowerCase() === "group" ? "group" : "solo";
  const distance = toNumber(quest.distance_km, toNumber(quest.matching?.active_radius_km, 1));
  const activeRadiusKm = toNumber(quest.matching?.active_radius_km, 1);
  const nextRadiusKm = toNumber(quest.matching?.next_radius_km, activeRadiusKm + 1);
  const nextExpandInSeconds = toNumber(quest.matching?.next_expand_in_seconds, 0);

  return {
    id: quest.id,
    title: quest.title || "Untitled Quest",
    giver: quest.giver?.fullname || quest.giver?.username || "Verified Giver",
    giverBadge: "Verified Giver",
    category: quest.category || (quest.skill_tags ?? []).join(" + ") || "General",
    reward: quest.reward_display || formatCurrency(quest.reward_amount),
    distanceKm: Number(distance.toFixed(1)),
    activeRadiusKm: Number(activeRadiusKm.toFixed(1)),
    nextRadiusKm: Number(nextRadiusKm.toFixed(1)),
    nextExpandInSeconds,
    matchingScope: quest.matching?.matching_scope || "global_fallback",
    withinMatchRadius: quest.matching?.within_match_radius !== false,
    coordinate: quest.location?.lat != null && quest.location?.lng != null
      ? { lat: quest.location.lat, lng: quest.location.lng }
      : null,
    locationLabel: quest.location?.label || quest.location?.sub_district || quest.location?.city || "Area terdekat",
    locationAddress: quest.location?.full_address || quest.location?.label || "Alamat quest belum tersedia",
    mode,
    matchScore: Math.max(50, Math.min(98, Math.round(100 - distance * 6))),
    slotFilled: currentCount,
    slotTotal: maxRunner,
    postedAt: formatDate(quest.published_at || quest.created_at),
    estimatedDuration: "1-2 jam",
    briefSummary: quest.description || "Quest live dari backend QuickQuest.",
    description: quest.description || "Detail pekerjaan akan mengikuti brief dari giver.",
    targetChecklist: [
      "Ikuti brief giver sampai selesai.",
      "Dokumentasikan hasil kerja jika diperlukan.",
      "Tekan Selesai Kerja setelah pekerjaan rampung.",
    ],
  };
}

function mapRunnerActiveQuestFromApi(item: ApiRunnerAssignment): RunnerActiveQuest {
  const quest = item.quest ?? { id: "unknown", title: "Quest aktif" };
  const lifecycleStatus = item.assignment_status || quest.status;
  const escrowStatus = item.escrow?.escrow_state;
  const autoReleaseAt = resolveAutoReleaseAt(item.finished_at, escrowStatus);
  const autoReleaseSecondsLeft = resolveSecondsUntil(autoReleaseAt);
  const workLocation = item.work_location;
  const sharedAddress =
    workLocation?.full_address ||
    workLocation?.label ||
    quest.location?.full_address ||
    quest.location?.label ||
    "Lokasi quest belum tersedia";
  return {
    id: quest.id,
    assignmentId: item.assignment_id || "",
    questTitle: quest.title || "Quest aktif",
    giverName: quest.giver?.fullname || quest.giver?.username || "Verified Giver",
    escrowState: normalizeRunnerEscrow(lifecycleStatus, escrowStatus),
    status: normalizeRunnerStatus(lifecycleStatus, escrowStatus),
    reward: quest.reward_display || formatCurrency(quest.reward_amount),
    locationAddress: sharedAddress,
    workLocationLabel: workLocation?.label || workLocation?.sub_district || workLocation?.district || "",
    workLocationNote: workLocation?.note || "",
    locationSharedAt: item.location_shared_at ? formatDate(item.location_shared_at) : null,
    workStartedAt: item.started_at ? formatDate(item.started_at) : null,
    workFinishedAt: item.finished_at ? formatDate(item.finished_at) : null,
    autoReleaseAt,
    autoReleaseSecondsLeft,
    autoReleaseHoursLeft: autoReleaseSecondsLeft / 3600,
    ppGain: "+0 PP",
    giverRated: item.rating_state?.giver_rated === true,
    runnerRated: item.rating_state?.runner_rated === true,
    viewerHasRated: item.rating_state?.viewer_has_rated === true,
    bothRated: item.rating_state?.both_rated === true,
  };
}

export async function fetchRunnerBroadcastQuestsFromApi(coords?: RunnerRawCoords): Promise<RunnerQuestFeedItem[]> {
  const url = new URL(GlobalEndpoint().quest.list);
  if (coords) {
    url.searchParams.set("runner_lat", `${coords.lat}`);
    url.searchParams.set("runner_lng", `${coords.lng}`);
  }
  const response = await requestJson<ApiEnvelope<{ items?: ApiQuest[] }>>(url.toString());
  runnerQuestFeedCache = Array.isArray(response.data?.items)
    ? response.data.items.map(mapRunnerQuestFeedFromApi)
    : [];
  return runnerQuestFeedCache;
}

export function getCachedRunnerQuestFeed(): RunnerQuestFeedItem[] {
  return runnerQuestFeedCache.length > 0 ? runnerQuestFeedCache : runnerQuestFeedSeed;
}

export async function takeRunnerQuestFromApi(questId: string, coords?: RunnerRawCoords) {
  const url = new URL(GlobalEndpoint().runnerQuest.take(questId));
  if (coords) {
    url.searchParams.set("runner_lat", `${coords.lat}`);
    url.searchParams.set("runner_lng", `${coords.lng}`);
  }

  return postJson<Record<string, never>, ApiEnvelope<unknown>>(
    url.toString(),
    {},
  );
}

export async function fetchRunnerActiveQuestsFromApi(): Promise<RunnerActiveQuest[]> {
  const response = await requestJson<ApiEnvelope<{ items?: ApiRunnerAssignment[] }>>(
    GlobalEndpoint().runnerQuest.active,
  );
  return Array.isArray(response.data?.items)
    ? response.data.items.map(mapRunnerActiveQuestFromApi)
    : [];
}

export async function startRunnerQuestFromApi(questId: string) {
  return postJson<Record<string, never>, ApiEnvelope<unknown>>(
    GlobalEndpoint().runnerQuest.start(questId),
    {},
  );
}

export async function finishRunnerQuestFromApi(questId: string) {
  return postJson<Record<string, never>, ApiEnvelope<unknown>>(
    GlobalEndpoint().runnerQuest.finish(questId),
    {},
  );
}

export type RunnerViewCopy = {
  hero: {
    eyebrow: string;
    title: string;
    simulationBadge: string;
  };
  navigator: {
    home: string;
    questFeed: string;
    activeQuest: string;
    partyLobby: string;
    insights: string;
  };
  home: {
    eyebrow: string;
    title: string;
    description: string;
    primaryButton: string;
    secondaryButton: string;
    activeQuestLabel: string;
    openQuestLabel: string;
    partyLobbyLabel: string;
  };
  activeQuest: {
    eyebrow: string;
    title: string;
    runningSuffix: string;
    ppGainLabel: string;
    autoReleaseLabel: string;
    locationLabel: string;
    pendingAuditTitle: string;
    pendingAuditHint: string;
    startButtonLabel: string;
    startedButtonLabel: string;
    finishButtonLabel: string;
  };
  openParties: {
    eyebrow: string;
    title: string;
    matchPrefix: string;
    readySuffix: string;
    joinButtonLabel: string;
  };
  skillInventory: {
    eyebrow: string;
    title: string;
    completionPrefix: string;
    trendPrefix: string;
    focusWindowPrefix: string;
  };
  availability: {
    eyebrow: string;
    title: string;
    slotsLabel: string;
    morningPrefix: string;
    afternoonPrefix: string;
    nightPrefix: string;
  };
  earning: {
    eyebrow: string;
    title: string;
    incomeLegend: string;
    completedQuestLegend: string;
    incomeBarLegend: string;
  };
  reliability: {
    eyebrow: string;
    title: string;
    activeLabel: string;
  };
  roster: {
    eyebrow: string;
    title: string;
    areaPrefix: string;
    reliabilityPrefix: string;
  };
};

export const runnerViewCopySeed: RunnerViewCopy = {
  hero: {
    eyebrow: "Runner Career Center",
    title: "Identity Kerja, Shift, dan Performa Penghasilan",
    simulationBadge: "Dummy data simulation",
  },
  navigator: {
    home: "Overview",
    questFeed: "Quest Feed",
    activeQuest: "Quest Aktif",
    partyLobby: "Party Lobby",
    insights: "Insights",
  },
  home: {
    eyebrow: "Runner Mission Control",
    title: "Pusat Navigasi Runner untuk ambil, jalankan, dan pantau Quest",
    description:
      "Nested SPA ini memisahkan konteks runner jadi jelas: feed quest, quest aktif, lobby grup, live map, dan insight performa.",
    primaryButton: "Buka Quest Feed",
    secondaryButton: "Lihat Quest Aktif",
    activeQuestLabel: "Quest Aktif",
    openQuestLabel: "Quest Terbuka",
    partyLobbyLabel: "Lobby Grup",
  },
  activeQuest: {
    eyebrow: "Quest Aktif",
    title: "Quest Aktif Saya",
    runningSuffix: "berjalan",
    ppGainLabel: "PP Gain",
    autoReleaseLabel: "Auto-Release",
    locationLabel: "Lokasi",
    pendingAuditTitle: "Menunggu Audit Giver",
    pendingAuditHint:
      "Dana auto-release jika Giver tidak audit dalam batas waktu.",
    startButtonLabel: "Mulai Kerja",
    startedButtonLabel: "Sedang Kerja...",
    finishButtonLabel: "Selesai Kerja",
  },
  openParties: {
    eyebrow: "Party Lobbies",
    title: "Group Quests Terbuka di Sekitarmu",
    matchPrefix: "Match",
    readySuffix: "Ready",
    joinButtonLabel: "Join Lobby",
  },
  skillInventory: {
    eyebrow: "Skill Inventory",
    title: "Skill + Level Q1-Q3",
    completionPrefix: "Completion",
    trendPrefix: "Trend",
    focusWindowPrefix: "Demand Window:",
  },
  availability: {
    eyebrow: "Availability Schedule",
    title: "Shift Setup Mirip Ojol",
    slotsLabel: "Pagi / Siang / Malam",
    morningPrefix: "Pagi:",
    afternoonPrefix: "Siang:",
    nightPrefix: "Malam:",
  },
  earning: {
    eyebrow: "Earning Trajectory",
    title: "Pertumbuhan Income Runner",
    incomeLegend: "Income",
    completedQuestLegend: "Quest Selesai",
    incomeBarLegend: "Income Bar",
  },
  reliability: {
    eyebrow: "Reliability Badge",
    title: "Badge Konsistensi Kerja Runner",
    activeLabel: "Active",
  },
  roster: {
    eyebrow: "Runner Roster",
    title: "Pool Aktif untuk Distribusi Quest",
    areaPrefix: "Area:",
    reliabilityPrefix: "Reliability:",
  },
};

export const runnerCareerMetrics: RunnerCareerMetric[] = [
  { label: "Quest Selesai", value: "394", hint: "+18 minggu ini", tone: "bg-[#DCFCE7]" },
  { label: "Avg Response", value: "4m 20s", hint: "target <= 5m", tone: "bg-[#DBEAFE]" },
  { label: "Cancel Rate", value: "1.2%", hint: "-0.4% dari minggu lalu", tone: "bg-[#E9D5FF]" },
  { label: "On-Time Rate", value: "96.8%", hint: "stabil 4 minggu", tone: "bg-[#FEF3C7]" },
];

export const runnerSkillInventory: RunnerSkillInventoryItem[] = [
  { skill: "Cleaning", level: "Q2", pp: "2,140 PP", completionRate: "97.2%", trend: "+8.6%" },
  { skill: "Coding", level: "Q1", pp: "755 PP", completionRate: "91.4%", trend: "+5.2%" },
  { skill: "Delivery", level: "Q3", pp: "1,240 PP", completionRate: "95.1%", trend: "+4.9%" },
  { skill: "Retail", level: "Q2", pp: "1,860 PP", completionRate: "93.8%", trend: "+6.4%" },
];

export const runnerAvailabilitySchedule: RunnerAvailabilitySlot[] = [
  { day: "Sen", morning: "Online", afternoon: "Limited", night: "Online" },
  { day: "Sel", morning: "Online", afternoon: "Online", night: "Limited" },
  { day: "Rab", morning: "Limited", afternoon: "Online", night: "Online" },
  { day: "Kam", morning: "Online", afternoon: "Online", night: "Online" },
  { day: "Jum", morning: "Limited", afternoon: "Online", night: "Online" },
  { day: "Sab", morning: "Online", afternoon: "Limited", night: "Online" },
  { day: "Min", morning: "Offline", afternoon: "Limited", night: "Online" },
];

export const runnerEarningTrajectory: RunnerEarningPoint[] = [
  { period: "W1", income: 1350000, quests: 18 },
  { period: "W2", income: 1610000, quests: 22 },
  { period: "W3", income: 1490000, quests: 20 },
  { period: "W4", income: 1820000, quests: 25 },
  { period: "W5", income: 1980000, quests: 27 },
  { period: "W6", income: 2140000, quests: 29 },
];

export const runnerReliabilityBadges: RunnerReliabilityBadge[] = [
  { name: "Fast Responder", description: "Median first response di bawah 5 menit.", tone: "bg-[#DBEAFE] text-[#1D4ED8]" },
  { name: "High Completion", description: "Penyelesaian quest stabil di atas 95%.", tone: "bg-[#DCFCE7] text-[#166534]" },
  { name: "Low Dispute", description: "Rasio dispute rendah selama 30 hari terakhir.", tone: "bg-[#E9D5FF] text-[#6D28D9]" },
  { name: "Night Owl", description: "Performa tertinggi di slot malam 18.00 - 22.00.", tone: "bg-[#FEF3C7] text-[#92400E]" },
  { name: "Weekend Grinder", description: "Aktif konsisten saat permintaan weekend meningkat.", tone: "bg-[#FCE7F3] text-[#9D174D]" },
];

export const runnerMembers: RunnerMember[] = [
  { name: "Neira", primarySkill: "Cleaning + Retail", currentStatus: "Ready", location: "Cilandak", reliabilityScore: "A+" },
  { name: "Miska", primarySkill: "Retail + Display", currentStatus: "On Quest", location: "Depok", reliabilityScore: "A" },
  { name: "Farel", primarySkill: "Survey + Pickup", currentStatus: "Standby", location: "Bekasi", reliabilityScore: "B+" },
  { name: "Raka", primarySkill: "Merchandising", currentStatus: "Need Brief", location: "Pasar Minggu", reliabilityScore: "A-" },
];

export const runnerFocusInsight = {
  title: "Active Skill Focus",
  description: "Cleaning dan Retail menyumbang 64% quest match minggu ini. Prioritaskan slot malam untuk demand puncak.",
  demandWindow: "18.00 - 21.00",
};

export const runnerActiveQuests: RunnerActiveQuest[] = [
  {
    id: "QST-7821",
    assignmentId: "ASN-SEED-7821",
    questTitle: "Bersih-bersih & Rapikan Kantor Lantai 3",
    giverName: "PT. Sentra Solusi",
    escrowState: "IN_PROGRESS",
    status: "IN_PROGRESS",
    reward: "Rp 120.000",
    locationAddress: "Gedung Sentra Solusi, Jl. Sudirman Kav. 22, Jakarta Selatan",
    workLocationLabel: "Gedung Sentra Solusi",
    workLocationNote: "Masuk lewat lobby utama dan temui security.",
    locationSharedAt: "14 Apr 2026, 08:35",
    workStartedAt: "14 Apr 2026, 08:45",
    workFinishedAt: null,
    autoReleaseAt: null,
    autoReleaseSecondsLeft: 0,
    autoReleaseHoursLeft: 22,
    ppGain: "+180 PP",
    giverRated: false,
    runnerRated: false,
    viewerHasRated: false,
    bothRated: false,
  },
  {
    id: "QST-7744",
    assignmentId: "ASN-SEED-7744",
    questTitle: "Install & Konfigurasi WiFi Kantor",
    giverName: "CV. Nusantara Digital",
    escrowState: "PENDING_CONFIRMATION",
    status: "PENDING_CONFIRMATION",
    reward: "Rp 350.000",
    locationAddress: "Ruko Nusantara, Jl. Gatot Subroto No. 7, Tangerang",
    workLocationLabel: "Ruko Nusantara",
    workLocationNote: "",
    locationSharedAt: "13 Apr 2026, 12:45",
    workStartedAt: "13 Apr 2026, 13:00",
    workFinishedAt: "13 Apr 2026, 16:30",
    autoReleaseAt: "2026-04-14T09:30:00.000Z",
    autoReleaseSecondsLeft: 0,
    autoReleaseHoursLeft: 6,
    ppGain: "+420 PP",
    giverRated: false,
    runnerRated: false,
    viewerHasRated: false,
    bothRated: false,
  },
];

export const runnerQuestEscrowFlow: RunnerActiveQuest["escrowState"][] = [
  "LOCKED",
  "IN_PROGRESS",
  "PENDING_CONFIRMATION",
  "RELEASED",
];

export const runnerOpenParties: RunnerOpenParty[] = [
  {
    id: "P-101",
    title: "Event Organizer Staff",
    giver: "Neo Comm",
    slotFilled: 3,
    slotTotal: 5,
    reward: "Rp 350.000",
    match: 92,
  },
  {
    id: "P-102",
    title: "Bongkar Muat Gudang",
    giver: "Sinar Jaya",
    slotFilled: 1,
    slotTotal: 4,
    reward: "Rp 210.000",
    match: 78,
  },
];

export type RunnerQuestFeedItem = {
  id: string;
  title: string;
  giver: string;
  giverBadge: string;
  category: string;
  reward: string;
  distanceKm: number;
  activeRadiusKm?: number;
  nextRadiusKm?: number;
  nextExpandInSeconds?: number;
  matchingScope?: string;
  withinMatchRadius?: boolean;
  coordinate?: RunnerRawCoords | null;
  locationLabel: string;
  locationAddress: string;
  mode: "solo" | "group";
  matchScore: number;
  slotFilled: number;
  slotTotal: number;
  postedAt: string;
  estimatedDuration: string;
  briefSummary: string;
  description: string;
  targetChecklist: string[];
};

export const runnerQuestFeedSeed: RunnerQuestFeedItem[] = [
  {
    id: "QF-201",
    title: "Rapikan Etalase Minimarket Shift Pagi",
    giver: "Mitra Ritel Harmoni",
    giverBadge: "Verified Giver",
    category: "Retail Display",
    reward: "Rp 140.000",
    distanceKm: 0.7,
    locationLabel: "Cilandak Barat",
    locationAddress: "Jl. Intan Ruko Blok B2, Cilandak Barat, Jakarta Selatan",
    mode: "solo",
    matchScore: 94,
    slotFilled: 1,
    slotTotal: 1,
    postedAt: "24 Apr 2026, 07:15",
    estimatedDuration: "2 - 3 jam",
    briefSummary: "Butuh runner teliti untuk rapikan rak promo dan stok pending.",
    description:
      "Giver membutuhkan runner untuk merapikan area etalase minimarket sebelum jam ramai pagi. Fokus utama ada di rak promosi depan, pengecekan harga display, dan penyelarasan stok ringan yang tertinggal semalam.",
    targetChecklist: [
      "Rak promo depan kembali rapi dan facing produk seragam",
      "Label harga utama sudah terpasang dan terbaca",
      "Foto bukti sebelum dan sesudah pengerjaan dikirim",
    ],
  },
  {
    id: "QF-202",
    title: "Tim Bongkar Muat Gudang Area Selatan",
    giver: "Logistik Nusantara",
    giverBadge: "Business Giver",
    category: "Warehouse",
    reward: "Rp 280.000",
    distanceKm: 1.9,
    locationLabel: "Pasar Minggu",
    locationAddress: "Gudang Selatan 8, Jl. Raya Tanjung Barat No. 18, Jakarta Selatan",
    mode: "group",
    matchScore: 88,
    slotFilled: 2,
    slotTotal: 4,
    postedAt: "24 Apr 2026, 06:40",
    estimatedDuration: "4 jam",
    briefSummary: "Quest kelompok untuk loading sore. Safety vest wajib.",
    description:
      "Quest kelompok untuk proses bongkar muat barang masuk ke gudang area selatan. Tim runner akan dibagi per zona pallet dan harus mengikuti instruksi supervisor lapangan dari giver.",
    targetChecklist: [
      "Minimal 4 runner hadir sebelum briefing dimulai",
      "Setiap pallet berhasil dipindah ke zona yang ditentukan",
      "Dokumentasi akhir jumlah pallet terinput di chat grup",
    ],
  },
  {
    id: "QF-203",
    title: "Cleaning Cepat Kios Setelah Tutup",
    giver: "Kios Sembada",
    giverBadge: "Trusted Giver",
    category: "Cleaning",
    reward: "Rp 110.000",
    distanceKm: 1.2,
    locationLabel: "Kemang",
    locationAddress: "Jl. Kemang Timur No. 21, kios depan area parkir",
    mode: "solo",
    matchScore: 91,
    slotFilled: 1,
    slotTotal: 1,
    postedAt: "24 Apr 2026, 08:00",
    estimatedDuration: "1.5 jam",
    briefSummary: "Pembersihan area depan dan rak pendinginan setelah operasional.",
    description:
      "Pekerjaan cleaning ringan sampai menengah untuk kios setelah tutup operasional pagi. Area fokus ada di lantai depan, rak pendingin, dan area kasir agar siap untuk shift berikutnya.",
    targetChecklist: [
      "Lantai depan bersih tanpa sampah sisa operasional",
      "Rak pendingin lap bersih dan bebas tetesan",
      "Area kasir dan meja packing kembali rapi",
    ],
  },
  {
    id: "QF-204",
    title: "Crew Event Pop-Up Weekend",
    giver: "Neo Comm",
    giverBadge: "Premium Giver",
    category: "Event Support",
    reward: "Rp 350.000",
    distanceKm: 2.4,
    locationLabel: "Blok M",
    locationAddress: "Area Plaza Blok M, Gate Selatan Event Hall",
    mode: "group",
    matchScore: 86,
    slotFilled: 3,
    slotTotal: 5,
    postedAt: "24 Apr 2026, 05:55",
    estimatedDuration: "6 jam",
    briefSummary: "Perlu koordinasi tim, briefing online, dan check-in tepat waktu.",
    description:
      "Quest grup untuk crew event pop-up weekend. Runner akan membantu set-up booth, alur pengunjung, distribusi materi promosi, dan jaga kebersihan area selama event berlangsung.",
    targetChecklist: [
      "Crew lengkap saat check-in awal",
      "Booth utama siap sebelum event dibuka",
      "Koordinasi tugas antar runner stabil sepanjang event",
    ],
  },
];

export const runnerPartyLobbyInfoSeed: RunnerPartyLobbyInfo[] = [
  {
    id: "P-101",
    title: "Event Organizer Staff",
    giver: "Neo Comm",
    reward: "Rp 350.000",
    slotTotal: 5,
    teamSlots: [
      { id: "slot-1", label: "You", icon: "⚡", state: "self" },
      { id: "slot-2", label: "Runner 2", icon: "😎", state: "filled" },
      { id: "slot-3", label: "Waiting...", icon: "+", state: "waiting" },
      { id: "slot-4", label: "Waiting...", icon: "+", state: "waiting" },
      { id: "slot-5", label: "Waiting...", icon: "+", state: "waiting" },
    ],
  },
  {
    id: "P-102",
    title: "Bongkar Muat Gudang",
    giver: "Sinar Jaya",
    reward: "Rp 210.000",
    slotTotal: 4,
    teamSlots: [
      { id: "slot-1", label: "You", icon: "⚡", state: "self" },
      { id: "slot-2", label: "Waiting...", icon: "+", state: "waiting" },
      { id: "slot-3", label: "Waiting...", icon: "+", state: "waiting" },
      { id: "slot-4", label: "Waiting...", icon: "+", state: "waiting" },
    ],
  },
];

export const runnerPartyLobbyChatMessages: RunnerPartyLobbyChatMessage[] = [
  {
    id: "chat-1",
    sender: "Sinar Jaya (Giver)",
    role: "giver",
    content: "Pastikan yang gabung bawa perlengkapan safety ya!",
  },
  {
    id: "chat-2",
    sender: "You",
    role: "runner",
    content: "Siaap pak, saya meluncur 5 menit lagi.",
  },
];

// Phase 3: Maps Live Service Logic
export interface RunnerRawCoords {
  lat: number;
  lng: number;
}

// Dummy location: Pontianak (Khatulistiwa)
export const RUNNER_MOCK_LOCATION: RunnerRawCoords = { lat: -0.0227, lng: 109.3340 };

export const getRunnerDeviceLocationRaw = (): Promise<RunnerRawCoords> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(RUNNER_MOCK_LOCATION);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        // Fallback to mock instead of reject
        resolve(RUNNER_MOCK_LOCATION);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  });
};
