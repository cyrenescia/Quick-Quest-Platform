import GlobalEndpoint, { postJson, requestJson } from "../../../global.service";
import type {
  BroadcastFilter,
  CandidateSort,
  GiverBriefChecklistItem,
  GiverBroadcastQuest,
  GiverBudgetCard,
  GiverCandidate,
  GiverEscrowEntry,
  GiverKpiCard,
  GiverPostQuestInsight,
} from "./giver";

export const GIVER_SUBVIEW_STORAGE_KEY = "nvrs-qqm-giver-subview-v1";

export const giverBroadcastFiltersSeed: BroadcastFilter[] = [
  "ALL",
  "LIVE",
  "MATCH",
  "WAITING_RUNNER",
  "FROZEN",
];

export const giverCandidateSortOptionsSeed: CandidateSort[] = [
  "MATCH",
  "DISTANCE",
  "ETA",
];

export type GiverViewCopy = {
  hero: {
    eyebrow: string;
    badge: string;
    title: string;
    createQuestButton: string;
  };
  broadcast: {
    eyebrow: string;
    title: string;
    labels: {
      wageBand: string;
      deadline: string;
      slotFilled: string;
      estimatedCandidates: string;
      radiusActive: string;
      nextRadius: string;
      autoExpand: string;
      maxRadius: string;
    };
    partyLobby: {
      title: string;
      readySuffix: string;
      startButton: string;
      waitingTemplate: string;
      forceStartButton: string;
    };
  };
  candidate: {
    eyebrow: string;
    title: string;
    completionPrefix: string;
    disputePrefix: string;
    reviewButton: string;
    distanceSuffix: string;
    etaSuffix: string;
    matchSuffix: string;
  };
  budget: {
    eyebrow: string;
    title: string;
  };
  brief: {
    eyebrow: string;
    title: string;
    scoreTitle: string;
    readyHint: string;
    notReadyHint: string;
    requiredBadge: string;
    weightPrefix: string;
    requiredMissingTitle: string;
  };
  insight: {
    eyebrow: string;
    title: string;
    confidencePrefix: string;
  };
};

export const giverViewCopySeed: GiverViewCopy = {
  hero: {
    eyebrow: "Giver Command Center",
    badge: "QQM Mode • Dummy Data",
    title: "Buat Quest, Broadcast Cerdas, dan Kelola Escrow",
    createQuestButton: "+ Buat Quest Baru",
  },
  broadcast: {
    eyebrow: "Broadcast Monitor",
    title: "Status Quest Live, Slot, Countdown, Auto-Expand Radius Tiap 5 Menit",
    labels: {
      wageBand: "Wage Band",
      deadline: "Deadline",
      slotFilled: "Slot Terisi",
      estimatedCandidates: "Estimasi kandidat aktif:",
      radiusActive: "Radius Aktif",
      nextRadius: "Next Radius",
      autoExpand: "Auto Expand",
      maxRadius: "Max Radius",
    },
    partyLobby: {
      title: "Party Lobby",
      readySuffix: "Ready",
      startButton: "🚀 Start Group Quest",
      waitingTemplate: "Tunggu slot penuh. Estimasi {candidates} kandidat aktif di area.",
      forceStartButton: "Force Start",
    },
  },
  candidate: {
    eyebrow: "Candidate Pool",
    title: "Top Runner Terdekat + Skill Match + Reliability Badge",
    completionPrefix: "Completion",
    disputePrefix: "Dispute",
    reviewButton: "Review Data",
    distanceSuffix: "km",
    etaSuffix: "m ETA",
    matchSuffix: "% match",
  },
  budget: {
    eyebrow: "Budget & Escrow",
    title: "Alokasi Budget, Fee, Pending Release, Refund/Dispute",
  },
  brief: {
    eyebrow: "Brief Quality Score",
    title: "Checklist Brief Siap Publish",
    scoreTitle: "Skor Kualitas Brief",
    readyHint: "Brief siap dibroadcast ke runner.",
    notReadyHint: "Masih ada item penting yang perlu dilengkapi sebelum publish.",
    requiredBadge: "Required",
    weightPrefix: "Weight",
    requiredMissingTitle: "Required Missing",
  },
  insight: {
    eyebrow: "Post-Quest Insight",
    title: "Rekomendasi Upah/Radius dari Histori Conversion",
    confidencePrefix: "Confidence",
  },
};

export const giverKpiCards: GiverKpiCard[] = [
  { label: "Quest Open", value: "26", hint: "8 butuh slot tambahan", tone: "bg-[#DBEAFE]" },
  { label: "Fill Rate", value: "78.4%", hint: "+3.2% vs minggu lalu", tone: "bg-[#DCFCE7]" },
  { label: "Avg Match Time", value: "12m", hint: "target <= 15m", tone: "bg-[#E9D5FF]" },
  { label: "Escrow Locked", value: "Rp8.4jt", hint: "44 quest aktif", tone: "bg-[#FEF3C7]" },
  { label: "Release Rate", value: "86.9%", hint: "dispute 2.3%", tone: "bg-[#FCE7F3]" },
];

export const giverBroadcastQuests: GiverBroadcastQuest[] = [
  {
    id: "QST-2026-0412-901",
    title: "Restock Minimarket Harian",
    status: "LIVE",
    mode: "Per-Individu",
    skillTag: "Retail + Inventory",
    wageBand: "Rp150.000 - Rp250.000",
    slotFilled: 0,
    slotTotal: 1,
    baseRadiusKm: 1,
    maxRadiusKm: 5,
    elapsedSeedSeconds: 110,
    deadline: "12 Apr 2026, 13:30",
    location: "Pasar Minggu",
    estimatedCandidates: 21,
    escrowState: "LOCKED",
  },
  {
    id: "QST-2026-0412-857",
    title: "Pickup Stok Gudang",
    status: "WAITING_RUNNER",
    mode: "Ber-Kelompok",
    skillTag: "Delivery + Heavy Lift",
    wageBand: "Rp300.000 - Rp520.000",
    slotFilled: 2,
    slotTotal: 5,
    baseRadiusKm: 1,
    maxRadiusKm: 6,
    elapsedSeedSeconds: 402,
    deadline: "12 Apr 2026, 17:00",
    location: "Kuningan",
    estimatedCandidates: 34,
    escrowState: "LOCKED",
  },
  {
    id: "QST-2026-0412-882",
    title: "Survey Display Snack UMKM",
    status: "MATCH",
    mode: "Per-Individu",
    skillTag: "Retail + Visual Merch",
    wageBand: "Rp200.000 - Rp300.000",
    slotFilled: 1,
    slotTotal: 1,
    baseRadiusKm: 1,
    maxRadiusKm: 4,
    elapsedSeedSeconds: 755,
    deadline: "12 Apr 2026, 16:00",
    location: "Depok",
    estimatedCandidates: 14,
    escrowState: "PENDING_CONFIRMATION",
  },
  {
    id: "QST-2026-0412-811",
    title: "Bersihkan Booth Event",
    status: "FROZEN",
    mode: "Ber-Kelompok",
    skillTag: "Cleaning + Event Support",
    wageBand: "Rp250.000 - Rp380.000",
    slotFilled: 3,
    slotTotal: 4,
    baseRadiusKm: 1,
    maxRadiusKm: 5,
    elapsedSeedSeconds: 1205,
    deadline: "12 Apr 2026, 20:00",
    location: "Cilandak",
    estimatedCandidates: 29,
    escrowState: "IN_PROGRESS",
  },
];

export const giverCandidates: GiverCandidate[] = [
  {
    id: "cand-neira",
    name: "Neira",
    distanceKm: 0.8,
    etaMinutes: 6,
    skill: "Cleaning + Retail",
    matchScore: 93,
    completionRate: "97.2%",
    disputeRatio: "0.8%",
    reliabilityBadge: "Fast Responder",
    status: "Ready",
  },
  {
    id: "cand-miska",
    name: "Miska",
    distanceKm: 1.6,
    etaMinutes: 11,
    skill: "Retail + Display",
    matchScore: 88,
    completionRate: "95.8%",
    disputeRatio: "1.1%",
    reliabilityBadge: "High Completion",
    status: "On Quest",
  },
  {
    id: "cand-raka",
    name: "Raka",
    distanceKm: 2.1,
    etaMinutes: 14,
    skill: "Delivery + Merchandising",
    matchScore: 82,
    completionRate: "94.9%",
    disputeRatio: "1.3%",
    reliabilityBadge: "Night Owl",
    status: "Standby",
  },
  {
    id: "cand-naufal",
    name: "Naufal",
    distanceKm: 2.4,
    etaMinutes: 16,
    skill: "Tech Assist + Retail",
    matchScore: 79,
    completionRate: "93.2%",
    disputeRatio: "1.8%",
    reliabilityBadge: "Quick Fix",
    status: "Ready",
  },
  {
    id: "cand-aghnia",
    name: "Aghnia",
    distanceKm: 3.1,
    etaMinutes: 20,
    skill: "Cleaning Pro",
    matchScore: 86,
    completionRate: "96.8%",
    disputeRatio: "0.9%",
    reliabilityBadge: "Trusted Pro",
    status: "Ready",
  },
  {
    id: "cand-farel",
    name: "Farel",
    distanceKm: 2.8,
    etaMinutes: 18,
    skill: "Survey + Pickup",
    matchScore: 77,
    completionRate: "93.7%",
    disputeRatio: "1.9%",
    reliabilityBadge: "SLA Keeper",
    status: "Standby",
  },
];

export const giverBudgetCards: GiverBudgetCard[] = [
  { label: "Budget Allocation", value: "Rp12.5jt", hint: "58% sudah dipakai", tone: "bg-[#DBEAFE]" },
  { label: "Platform Fee", value: "Rp775rb", hint: "6.2% fee blended", tone: "bg-[#DCFCE7]" },
  { label: "Pending Release", value: "Rp2.1jt", hint: "11 quest menunggu approve", tone: "bg-[#FEF3C7]" },
  { label: "Refund/Dispute Hold", value: "Rp430rb", hint: "3 kasus perlu review", tone: "bg-[#FECACA]" },
];

export const giverEscrowEntries: GiverEscrowEntry[] = [
  {
    id: "esc-001",
    questId: "QST-2026-0412-901",
    type: "LOCKED",
    amount: "Rp250.000",
    note: "Runner belum mulai tugas.",
    time: "09:01",
  },
  {
    id: "esc-002",
    questId: "QST-2026-0412-857",
    type: "PENDING_RELEASE",
    amount: "Rp520.000",
    note: "Slot runner 2/5, menunggu final group.",
    time: "11:44",
  },
  {
    id: "esc-003",
    questId: "QST-2026-0412-882",
    type: "RELEASED",
    amount: "Rp285.000",
    note: "Setelah potong fee platform.",
    time: "10:51",
  },
  {
    id: "esc-004",
    questId: "QST-2026-0411-774",
    type: "REFUND",
    amount: "Rp300.000",
    note: "Quest dibatalkan karena brief berubah.",
    time: "Kemarin 21:08",
  },
  {
    id: "esc-005",
    questId: "QST-2026-0411-741",
    type: "DISPUTE",
    amount: "Rp130.000",
    note: "Menunggu verifikasi bukti hasil.",
    time: "Kemarin 19:33",
  },
];

export const giverBriefChecklistItems: GiverBriefChecklistItem[] = [
  {
    id: "brief-skill-tag",
    label: "Skill tag jelas dan spesifik",
    description: "Gunakan tag bidang kerja agar matching runner lebih presisi.",
    weight: 20,
    required: true,
    defaultChecked: true,
  },
  {
    id: "brief-acceptance",
    label: "Acceptance criteria terukur",
    description: "Cantumkan output yang harus terpenuhi sebelum release escrow.",
    weight: 20,
    required: true,
    defaultChecked: true,
  },
  {
    id: "brief-proof",
    label: "Bukti hasil wajib (foto/file/checklist)",
    description: "Minimalkan dispute dengan format proof yang konsisten.",
    weight: 18,
    required: true,
    defaultChecked: false,
  },
  {
    id: "brief-slot",
    label: "Jumlah slot runner sesuai beban kerja",
    description: "Untuk mode kelompok, pastikan slot tidak under/over.",
    weight: 12,
    required: true,
    defaultChecked: true,
  },
  {
    id: "brief-radius",
    label: "Radius + aturan auto-expand",
    description: "Set radius awal dan ekspansi 5 menit agar fill-rate stabil.",
    weight: 15,
    required: false,
    defaultChecked: true,
  },
  {
    id: "brief-wage",
    label: "Rentang upah kompetitif",
    description: "Bandingkan dengan demand lokal untuk percepat conversion.",
    weight: 15,
    required: false,
    defaultChecked: false,
  },
];

export const giverPostQuestInsights: GiverPostQuestInsight[] = [
  {
    id: "insight-1",
    title: "Naikkan upah band untuk quest kelompok",
    recommendation: "Untuk slot 3+ runner, tambah wage minimum +12% menaikkan fill-rate hingga 16%.",
    impact: "Potential Fill Rate +16%",
    confidence: "88%",
    tone: "bg-[#DBEAFE] text-[#1D4ED8]",
  },
  {
    id: "insight-2",
    title: "Auto-expand radius setelah menit ke-10",
    recommendation: "Quest dengan demand tinggi sebaiknya ekspansi dari 1km ke 2km pada menit 10-15.",
    impact: "Match Time -3.4m",
    confidence: "84%",
    tone: "bg-[#DCFCE7] text-[#166534]",
  },
  {
    id: "insight-3",
    title: "Prioritaskan runner badge Fast Responder",
    recommendation: "Segmen retail sore hari konversi lebih stabil dengan responder < 5 menit.",
    impact: "Completion +6.1%",
    confidence: "79%",
    tone: "bg-[#E9D5FF] text-[#6D28D9]",
  },
  {
    id: "insight-4",
    title: "Kurangi dispute lewat proof format wajib",
    recommendation: "Template proof before-after menurunkan dispute ratio sampai 1.1 poin.",
    impact: "Dispute -1.1pt",
    confidence: "91%",
    tone: "bg-[#FEF3C7] text-[#92400E]",
  },
];

// Data Statis untuk VM Quest Editor
export const QQM_SKILL_TAGS = [
  "Kebersihan & Rumah Tangga",
  "Event & Hiburan",
  "Logistik & Pengiriman",
  "Teknologi & IT",
  "Desain & Kreatif",
  "Pengetikan & Admin",
  "Pendidikan & Tutor",
  "Pertanian & Lingkungan",
  "Kuliner & Katering",
  "Keamanan & Pengawasan",
  "Kesehatan & Perawatan",
  "Keuangan & Akuntansi",
];

export const QQM_PLATFORM_FEE_PERCENT = 5;

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data: T;
};

type ApiQuestLocation = {
  label?: string;
  full_address?: string;
  sub_district?: string;
  district?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  lat?: number | null;
  lng?: number | null;
};

type ApiQuestCapacity = {
  max_runner?: number | null;
  current_runner_count?: number | null;
};

type ApiRatingState = {
  rating_count?: number;
  unique_rating_count?: number;
  giver_rated?: boolean;
  runner_rated?: boolean;
  viewer_has_rated?: boolean;
  both_rated?: boolean;
};

export type ApiGiverQuest = {
  id?: string;
  quest_id?: string;
  title: string;
  description?: string;
  category?: string;
  mode?: string;
  status?: string;
  skill_tags?: string[];
  reward_amount?: string;
  reward_currency?: string;
  reward_display?: string;
  current_runner_count?: number | string | null;
  max_runner?: number | string | null;
  province?: string;
  city?: string;
  district?: string;
  sub_district?: string;
  full_address?: string;
  postal_code?: string;
  lat?: number | string | null;
  lng?: number | string | null;
  location?: ApiQuestLocation;
  capacity?: ApiQuestCapacity;
  escrow?: {
    escrow_state?: string;
    reward_amount?: string;
    platform_fee_amount?: string;
    total_amount?: string;
    payment_method?: string;
    payment_reference?: string;
  };
  rating_state?: ApiRatingState;
  created_at?: string | null;
  published_at?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
};

export type ApiGiverAssignment = {
  id: string;
  quest_id?: string;
  runner_auth_user_id?: string;
  assignment_status?: string;
  joined_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  work_location?: ApiQuestLocation | null;
  location_shared_at?: string | null;
  runner?: {
    auth_user_id?: string;
    fullname?: string;
    username?: string;
    email?: string;
    phone?: string;
  };
  rating_state?: ApiRatingState;
};

export type CreateGiverQuestApiPayload = {
  title: string;
  description: string;
  category: string;
  mode: "solo" | "group";
  skill_tags: string[];
  reward_amount: number;
  reward_currency: "IDR";
  max_runner: number;
  full_address: string;
  base_radius_km: number;
};

type DeleteGiverQuestApiResponse = {
  quest_id: string;
  deleted: boolean;
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function formatCurrencyDisplay(value: unknown): string {
  const amount = toNumber(value);
  if (!amount) return "Rp0";
  return `Rp${amount.toLocaleString("id-ID")}`;
}

function normalizeGiverQuestId(quest: ApiGiverQuest): string {
  return (quest.id || quest.quest_id || "").trim();
}

function mapGiverStatus(status?: string): GiverBroadcastQuest["status"] {
  switch ((status ?? "").toLowerCase()) {
    case "open":
      return "LIVE";
    case "matched":
      return "MATCH";
    case "pending_review":
      return "WAITING_RUNNER";
    case "in_progress":
      return "WAITING_RUNNER";
    default:
      return "FROZEN";
  }
}

function mapGiverMode(mode?: string): GiverBroadcastQuest["mode"] {
  return (mode ?? "").toLowerCase() === "group" ? "Ber-Kelompok" : "Per-Individu";
}

function mapGiverEscrowState(state?: string): GiverBroadcastQuest["escrowState"] {
  switch ((state ?? "").toLowerCase()) {
    case "in_progress":
      return "IN_PROGRESS";
    case "pending":
      return "PENDING_CONFIRMATION";
    case "released":
      return "RELEASED";
    case "disputed":
      return "DISPUTED";
    case "refund":
      return "REFUND";
    case "unpaid":
      return "UNPAID";
    default:
      return "LOCKED";
  }
}

function resolveElapsedSeconds(createdAt?: string | null, publishedAt?: string | null): number {
  const source = publishedAt || createdAt;
  if (!source) return 0;
  const timestamp = new Date(source).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
}

export function mapGiverQuestFromApi(quest: ApiGiverQuest): GiverBroadcastQuest {
  const questId = normalizeGiverQuestId(quest);
  const currentRunnerCount = toNumber(
    quest.capacity?.current_runner_count ?? quest.current_runner_count,
  );
  const maxRunner = Math.max(1, toNumber(quest.capacity?.max_runner ?? quest.max_runner, 1));
  const fullAddress = quest.location?.full_address || quest.full_address || "";
  const location =
    quest.location?.label ||
    quest.location?.sub_district ||
    quest.sub_district ||
    quest.location?.district ||
    quest.district ||
    quest.location?.city ||
    quest.city ||
    quest.location?.full_address ||
    quest.full_address ||
    "Lokasi belum diisi";
  const rewardAmount = toNumber(quest.reward_amount);
  const lifecycleStatus = (quest.status ?? "").toLowerCase();
  const skillTags = asArray<string>(quest.skill_tags);

  return {
    id: questId,
    title: quest.title || "Untitled Quest",
    description: quest.description || "",
    category: quest.category || "General",
    status: mapGiverStatus(quest.status),
    lifecycleStatus,
    isPrivateDraft: lifecycleStatus === "draft",
    mode: mapGiverMode(quest.mode),
    modeValue: (quest.mode ?? "").toLowerCase() === "group" ? "group" : "solo",
    skillTags,
    skillTag: skillTags.join(" + ") || quest.category || "General",
    wageBand: quest.reward_display || formatCurrencyDisplay(quest.reward_amount),
    rewardAmount,
    slotFilled: currentRunnerCount,
    slotTotal: maxRunner,
    baseRadiusKm: 1,
    maxRadiusKm: 10,
    elapsedSeedSeconds: resolveElapsedSeconds(quest.created_at, quest.published_at),
    deadline: quest.ends_at ? new Date(quest.ends_at).toLocaleString("id-ID") : "Belum dijadwalkan",
    location,
    fullAddress,
    estimatedCandidates: Math.max(1, 24 - currentRunnerCount),
    escrowState: mapGiverEscrowState(quest.escrow?.escrow_state),
    giverRated: quest.rating_state?.giver_rated === true,
    runnerRated: quest.rating_state?.runner_rated === true,
    viewerHasRated: quest.rating_state?.viewer_has_rated === true,
    bothRated: quest.rating_state?.both_rated === true,
  };
}

export async function fetchGiverQuestsFromApi(): Promise<GiverBroadcastQuest[]> {
  const endpoint = GlobalEndpoint().giverQuest.list;
  const response = await requestJson<ApiEnvelope<{ items?: ApiGiverQuest[] }>>(endpoint);
  return asArray<ApiGiverQuest>(response.data?.items).map(mapGiverQuestFromApi);
}

export async function createGiverQuestFromApi(payload: CreateGiverQuestApiPayload): Promise<ApiGiverQuest> {
  const response = await postJson<CreateGiverQuestApiPayload, ApiEnvelope<ApiGiverQuest>>(
    GlobalEndpoint().giverQuest.create,
    payload,
  );
  return {
    ...response.data,
    id: normalizeGiverQuestId(response.data),
  };
}

export async function updateGiverQuestDraftFromApi(
  questId: string,
  payload: CreateGiverQuestApiPayload,
): Promise<ApiGiverQuest> {
  const response = await requestJson<ApiEnvelope<ApiGiverQuest>>(
    GlobalEndpoint().giverQuest.update(questId),
    {
      method: "PUT",
      body: payload,
    },
  );
  return {
    ...response.data,
    id: normalizeGiverQuestId(response.data),
  };
}

export async function deleteGiverQuestDraftFromApi(questId: string): Promise<DeleteGiverQuestApiResponse> {
  const response = await requestJson<ApiEnvelope<DeleteGiverQuestApiResponse>>(
    GlobalEndpoint().giverQuest.remove(questId),
    {
      method: "DELETE",
    },
  );
  return response.data;
}

export async function lockGiverQuestEscrowFromApi(questId: string, paymentMethod: string) {
  const response = await postJson<{ payment_method: string }, ApiEnvelope<{ quest?: ApiGiverQuest; escrow?: unknown }>>(
    GlobalEndpoint().giverQuest.lockEscrow(questId),
    { payment_method: paymentMethod },
  );
  return response.data;
}

export async function publishGiverQuestFromApi(questId: string) {
  const response = await postJson<Record<string, never>, ApiEnvelope<{ quest_id: string; quest_status: string }>>(
    GlobalEndpoint().giverQuest.publish(questId),
    {},
  );
  return response.data;
}

export async function fetchGiverQuestAssignmentsFromApi(questId: string): Promise<ApiGiverAssignment[]> {
  const response = await requestJson<ApiEnvelope<{ items?: ApiGiverAssignment[] }>>(
    GlobalEndpoint().giverQuest.assignments(questId),
  );
  return asArray<ApiGiverAssignment>(response.data?.items);
}

export async function acceptGiverAssignmentFromApi(assignmentId: string) {
  return postJson<Record<string, never>, ApiEnvelope<unknown>>(
    GlobalEndpoint().giverAssignment.accept(assignmentId),
    {},
  );
}

export async function confirmGiverAssignmentCandidateFromApi(assignmentId: string) {
  return postJson<Record<string, never>, ApiEnvelope<unknown>>(
    GlobalEndpoint().giverAssignment.confirm(assignmentId),
    {},
  );
}

export async function rejectGiverAssignmentCandidateFromApi(assignmentId: string) {
  return postJson<Record<string, never>, ApiEnvelope<unknown>>(
    GlobalEndpoint().giverAssignment.reject(assignmentId),
    {},
  );
}

export async function shareGiverAssignmentLocationFromApi(assignmentId: string) {
  return postJson<Record<string, never>, ApiEnvelope<unknown>>(
    GlobalEndpoint().giverAssignment.shareLocation(assignmentId),
    {},
  );
}

export async function requestGiverAssignmentRevisionFromApi(assignmentId: string) {
  return postJson<Record<string, never>, ApiEnvelope<unknown>>(
    GlobalEndpoint().giverAssignment.requestRevision(assignmentId),
    {},
  );
}

export async function disputeGiverAssignmentFromApi(assignmentId: string, reason: string) {
  return postJson<{ reason: string }, ApiEnvelope<unknown>>(
    GlobalEndpoint().giverAssignment.dispute(assignmentId),
    { reason },
  );
}

export type EditorQuestType = "SOLO" | "KELOMPOK";
export type EditorStep = 1 | 2 | 3;
