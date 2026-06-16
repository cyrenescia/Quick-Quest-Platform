import { useCallback, useEffect, useState } from "react";
import {
  GIVER_SUBVIEW_STORAGE_KEY,
  createGiverQuestFromApi,
  deleteGiverQuestDraftFromApi,
  acceptGiverAssignmentFromApi,
  confirmGiverAssignmentCandidateFromApi,
  disputeGiverAssignmentFromApi,
  fetchGiverQuestsFromApi,
  fetchGiverQuestAssignmentsFromApi,
  giverBriefChecklistItems,
  giverBroadcastFiltersSeed,
  giverBroadcastQuests,
  giverBudgetCards,
  giverCandidateSortOptionsSeed,
  giverCandidates,
  giverEscrowEntries,
  giverKpiCards,
  giverPostQuestInsights,
  giverViewCopySeed,
  type GiverViewCopy,
  QQM_SKILL_TAGS,
  QQM_PLATFORM_FEE_PERCENT,
  lockGiverQuestEscrowFromApi,
  publishGiverQuestFromApi,
  rejectGiverAssignmentCandidateFromApi,
  requestGiverAssignmentRevisionFromApi,
  shareGiverAssignmentLocationFromApi,
  updateGiverQuestDraftFromApi,
  type ApiGiverAssignment,
  type EditorQuestType,
  type EditorStep,
} from "./giver.service";

export type GiverKpiCard = {
  label: string;
  value: string;
  hint: string;
  tone: string;
};

export type GiverBroadcastStatus = "LIVE" | "MATCH" | "WAITING_RUNNER" | "FROZEN";
export type GiverQuestMode = "Per-Individu" | "Ber-Kelompok";
export type BroadcastFilter = "ALL" | GiverBroadcastStatus;
export type CandidateSort = "MATCH" | "DISTANCE" | "ETA";

export type GiverBroadcastQuest = {
  id: string;
  title: string;
  description?: string;
  category?: string;
  status: GiverBroadcastStatus;
  lifecycleStatus?: string;
  isPrivateDraft?: boolean;
  mode: GiverQuestMode;
  modeValue?: "solo" | "group";
  skillTag: string;
  skillTags?: string[];
  wageBand: string;
  rewardAmount?: number;
  slotFilled: number;
  slotTotal: number;
  baseRadiusKm: number;
  maxRadiusKm: number;
  elapsedSeedSeconds: number;
  deadline: string;
  location: string;
  fullAddress?: string;
  estimatedCandidates: number;
  escrowState: "UNPAID" | "LOCKED" | "IN_PROGRESS" | "PENDING_CONFIRMATION" | "RELEASED" | "DISPUTED" | "REFUND";
  giverRated?: boolean;
  runnerRated?: boolean;
  viewerHasRated?: boolean;
  bothRated?: boolean;
};

export type GiverDraftQuest = GiverBroadcastQuest;

export type GiverCandidateStatus = "Applied" | "Accepted" | "Rejected" | "Ready" | "On Quest" | "Standby";

export type GiverCandidate = {
  id: string;
  assignmentId?: string;
  questId?: string;
  questTitle?: string;
  appliedAt?: string;
  name: string;
  distanceKm: number;
  etaMinutes: number;
  skill: string;
  matchScore: number;
  completionRate: string;
  disputeRatio: string;
  reliabilityBadge: string;
  status: GiverCandidateStatus;
};

export type GiverBudgetCard = {
  label: string;
  value: string;
  hint: string;
  tone: string;
};

export type GiverEscrowEntry = {
  id: string;
  questId: string;
  type: "LOCKED" | "PENDING_RELEASE" | "RELEASED" | "REFUND" | "DISPUTE";
  amount: string;
  note: string;
  time: string;
};

export type GiverBriefChecklistItem = {
  id: string;
  label: string;
  description: string;
  weight: number;
  required: boolean;
  defaultChecked: boolean;
};

export type GiverPostQuestInsight = {
  id: string;
  title: string;
  recommendation: string;
  impact: string;
  confidence: string;
  tone: string;
};

export type GiverSubView =
  | { view: "QuestEditor"; payload?: { draft?: GiverDraftQuest } }
  | { view: "CandidateReview"; payload: { id: string } }
  | { view: "History" };

export type GiverRadiusRuntime = {
  currentRadius: number;
  nextRadius: number;
  nextExpandIn: number;
  maxReached: boolean;
};

export type GiverViewText = GiverViewCopy;

export type GiverAssignmentAuditItem = {
  id: string;
  questId: string;
  questTitle: string;
  status: string;
  runnerName: string;
  finishedAt: string;
  locationSharedAt?: string;
  hasSharedLocation?: boolean;
  giverRated?: boolean;
  runnerRated?: boolean;
  viewerHasRated?: boolean;
  bothRated?: boolean;
};

export const giverBroadcastFilters = [...giverBroadcastFiltersSeed];
export const giverCandidateSortOptions = [...giverCandidateSortOptionsSeed];
export const giverViewText: GiverViewText = giverViewCopySeed;

export function resolveGiverBroadcastStatusClass(status: GiverBroadcastStatus): string {
  if (status === "LIVE") return "bg-[#DBEAFE] text-[#1D4ED8]";
  if (status === "MATCH") return "bg-[#E9D5FF] text-[#6D28D9]";
  if (status === "WAITING_RUNNER") return "bg-[#FEF3C7] text-[#92400E]";
  return "bg-[#FECACA] text-[#991B1B]";
}

export function resolveGiverEscrowStateClass(
  state: GiverBroadcastQuest["escrowState"],
): string {
  if (state === "UNPAID") return "bg-base-200 text-base-content/60";
  if (state === "IN_PROGRESS") return "bg-[#DCFCE7] text-[#166534]";
  if (state === "PENDING_CONFIRMATION") return "bg-[#E9D5FF] text-[#6D28D9]";
  if (state === "RELEASED") return "bg-[#DCFCE7] text-[#166534]";
  if (state === "DISPUTED") return "bg-[#FECACA] text-[#991B1B]";
  if (state === "REFUND") return "bg-[#FEF3C7] text-[#92400E]";
  return "bg-[#DBEAFE] text-[#1D4ED8]";
}

export function resolveGiverCandidateStatusClass(
  status: GiverCandidate["status"],
): string {
  if (status === "Applied") return "bg-[#FEF3C7] text-[#92400E]";
  if (status === "Accepted") return "bg-[#DCFCE7] text-[#166534]";
  if (status === "Rejected") return "bg-[#FECACA] text-[#991B1B]";
  if (status === "Ready") return "bg-[#DCFCE7] text-[#166534]";
  if (status === "On Quest") return "bg-[#DBEAFE] text-[#1D4ED8]";
  return "bg-[#FEF3C7] text-[#92400E]";
}

export function resolveGiverEscrowTypeClass(type: GiverEscrowEntry["type"]): string {
  if (type === "RELEASED") return "bg-[#DCFCE7] text-[#166534]";
  if (type === "PENDING_RELEASE") return "bg-[#FEF3C7] text-[#92400E]";
  if (type === "LOCKED") return "bg-[#DBEAFE] text-[#1D4ED8]";
  if (type === "REFUND") return "bg-[#E9D5FF] text-[#6D28D9]";
  return "bg-[#FECACA] text-[#991B1B]";
}

export function formatGiverCountdown(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minute = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const second = Math.floor(safe % 60)
    .toString()
    .padStart(2, "0");
  return `${minute}:${second}`;
}

export function resolveGiverRadiusRuntime(
  quest: GiverBroadcastQuest,
  tickSeconds: number,
): GiverRadiusRuntime {
  const elapsed = quest.elapsedSeedSeconds + tickSeconds;
  const expansionStep = Math.floor(elapsed / 300);
  const currentRadius = Math.min(quest.baseRadiusKm + expansionStep, quest.maxRadiusKm);
  const maxReached = currentRadius >= quest.maxRadiusKm;
  const modulo = elapsed % 300;
  const nextExpandIn = maxReached ? 0 : modulo === 0 ? 300 : 300 - modulo;
  const nextRadius = Math.min(currentRadius + 1, quest.maxRadiusKm);

  return {
    currentRadius,
    nextRadius,
    nextExpandIn,
    maxReached,
  };
}

export function resolveInitialGiverSubView(): GiverSubView | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GIVER_SUBVIEW_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GiverSubView;
  } catch {
    return null;
  }
}

export function persistGiverSubView(subView: GiverSubView | null): void {
  if (typeof window === "undefined") return;
  if (subView) {
    window.localStorage.setItem(GIVER_SUBVIEW_STORAGE_KEY, JSON.stringify(subView));
    return;
  }
  window.localStorage.removeItem(GIVER_SUBVIEW_STORAGE_KEY);
}

export function filterGiverBroadcastQuests(
  items: GiverBroadcastQuest[],
  filter: BroadcastFilter,
): GiverBroadcastQuest[] {
  if (filter === "ALL") return items;
  return items.filter((item) => item.status === filter);
}

export function sortGiverCandidates(
  items: GiverCandidate[],
  sortBy: CandidateSort,
): GiverCandidate[] {
  const candidates = [...items];
  if (sortBy === "MATCH") {
    return candidates.sort((left, right) => right.matchScore - left.matchScore);
  }
  if (sortBy === "DISTANCE") {
    return candidates.sort((left, right) => left.distanceKm - right.distanceKm);
  }
  return candidates.sort((left, right) => left.etaMinutes - right.etaMinutes);
}

export function buildInitialGiverBriefState(
  items: GiverBriefChecklistItem[],
): Record<string, boolean> {
  return items.reduce(
    (accumulator, item) => ({
      ...accumulator,
      [item.id]: item.defaultChecked,
    }),
    {} as Record<string, boolean>,
  );
}

export function resolveGiverBriefScore(
  items: GiverBriefChecklistItem[],
  briefState: Record<string, boolean>,
): {
  totalWeight: number;
  achievedWeight: number;
  score: number;
  missingRequired: GiverBriefChecklistItem[];
  ready: boolean;
} {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  const achievedWeight = items.reduce(
    (sum, item) => (briefState[item.id] ? sum + item.weight : sum),
    0,
  );
  const score = Math.round((achievedWeight / totalWeight) * 100);
  const missingRequired = items.filter((item) => item.required && !briefState[item.id]);
  const ready = score >= 85 && missingRequired.length === 0;

  return {
    totalWeight,
    achievedWeight,
    score,
    missingRequired,
    ready,
  };
}

export function resolveGiverPartyLobbyWaitingText(candidates: number): string {
  return giverViewText.broadcast.partyLobby.waitingTemplate.replace(
    "{candidates}",
    `${candidates}`,
  );
}

export function resolveGiverSlotProgress(quest: GiverBroadcastQuest): number {
  return Math.round((quest.slotFilled / quest.slotTotal) * 100);
}

export {
  giverBriefChecklistItems,
  giverBroadcastQuests,
  giverBudgetCards,
  giverCandidates,
  giverEscrowEntries,
  giverKpiCards,
  giverPostQuestInsights,
};

export function useGiverDashboardVM() {
  const [quests, setQuests] = useState<GiverBroadcastQuest[]>(giverBroadcastQuests);
  const [assignmentsByQuest, setAssignmentsByQuest] = useState<Record<string, GiverAssignmentAuditItem[]>>({});
  const [candidates, setCandidates] = useState<GiverCandidate[]>(giverCandidates);
  const [auditActionId, setAuditActionId] = useState("");
  const [candidateActionId, setCandidateActionId] = useState("");
  const [locationActionId, setLocationActionId] = useState("");
  const [draftActionId, setDraftActionId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function mapAssignment(item: ApiGiverAssignment, quest: GiverBroadcastQuest): GiverAssignmentAuditItem {
    return {
      id: item.id,
      questId: quest.id,
      questTitle: quest.title,
      status: item.assignment_status ?? "unknown",
      runnerName: item.runner?.fullname || item.runner?.username || "Runner",
      finishedAt: item.finished_at ? new Date(item.finished_at).toLocaleString("id-ID") : "-",
      locationSharedAt: item.location_shared_at
        ? new Date(item.location_shared_at).toLocaleString("id-ID")
        : "",
      hasSharedLocation: Boolean(item.location_shared_at || item.work_location),
      giverRated: item.rating_state?.giver_rated === true,
      runnerRated: item.rating_state?.runner_rated === true,
      viewerHasRated: item.rating_state?.viewer_has_rated === true,
      bothRated: item.rating_state?.both_rated === true,
    };
  }

  function mapCandidate(item: ApiGiverAssignment, quest: GiverBroadcastQuest): GiverCandidate {
    const appliedAt = item.joined_at ? new Date(item.joined_at).toLocaleString("id-ID") : "";
    const seedNumber = Math.max(1, item.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0));
    return {
      id: item.id,
      assignmentId: item.id,
      questId: quest.id,
      questTitle: quest.title,
      appliedAt,
      name: item.runner?.fullname || item.runner?.username || "Runner",
      distanceKm: Number((0.6 + (seedNumber % 18) / 10).toFixed(1)),
      etaMinutes: 5 + (seedNumber % 18),
      skill: quest.skillTag,
      matchScore: Math.max(72, Math.min(96, 96 - (seedNumber % 20))),
      completionRate: "Belum live",
      disputeRatio: "Belum live",
      reliabilityBadge: "Candidate",
      status: "Applied",
    };
  }

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const nextQuests = await fetchGiverQuestsFromApi();
      const resolvedQuests = nextQuests.length > 0 ? nextQuests : giverBroadcastQuests;
      setQuests(resolvedQuests);

      const auditableQuests = resolvedQuests.filter(
        (quest) =>
          !quest.isPrivateDraft &&
          quest.bothRated !== true &&
          quest.escrowState !== "DISPUTED" &&
          quest.escrowState !== "REFUND",
      );
      const assignmentPairs = await Promise.all(
        auditableQuests.map(async (quest) => {
          try {
            const assignments = await fetchGiverQuestAssignmentsFromApi(quest.id);
            return [quest.id, assignments.map((assignment) => mapAssignment(assignment, quest)), assignments, quest] as const;
          } catch {
            return [quest.id, [] as GiverAssignmentAuditItem[], [] as ApiGiverAssignment[], quest] as const;
          }
        }),
      );
      setAssignmentsByQuest(Object.fromEntries(assignmentPairs.map(([questId, mapped]) => [questId, mapped])));
      const liveCandidates = assignmentPairs.flatMap(([, , rawAssignments, quest]) =>
        rawAssignments
          .filter((assignment) => (assignment.assignment_status ?? "").toLowerCase() === "pending")
          .map((assignment) => mapCandidate(assignment, quest)),
      );
      setCandidates(liveCandidates.length > 0 ? liveCandidates : giverCandidates);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal mengambil quest giver.");
      setQuests(giverBroadcastQuests);
      setCandidates(giverCandidates);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteDraft = useCallback(async (questId: string) => {
    setDraftActionId(questId);
    setErrorMessage("");
    try {
      await deleteGiverQuestDraftFromApi(questId);
      await refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal hapus draft quest.");
    } finally {
      setDraftActionId("");
    }
  }, [refresh]);

  const auditAssignment = useCallback(async (
    assignmentId: string,
    action: "accept" | "revision" | "dispute",
  ) => {
    setAuditActionId(assignmentId);
    setErrorMessage("");
    try {
      if (action === "accept") {
        await acceptGiverAssignmentFromApi(assignmentId);
      } else if (action === "revision") {
        await requestGiverAssignmentRevisionFromApi(assignmentId);
      } else {
        await disputeGiverAssignmentFromApi(assignmentId, "Giver membuka dispute dari panel audit.");
      }
      await refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal audit assignment.");
    } finally {
      setAuditActionId("");
    }
  }, [refresh]);

  const confirmCandidate = useCallback(async (assignmentId: string): Promise<boolean> => {
    if (!assignmentId) return false;
    setCandidateActionId(assignmentId);
    setErrorMessage("");
    try {
      await confirmGiverAssignmentCandidateFromApi(assignmentId);
      await refresh();
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal konfirmasi kandidat.");
      return false;
    } finally {
      setCandidateActionId("");
    }
  }, [refresh]);

  const rejectCandidate = useCallback(async (assignmentId: string): Promise<boolean> => {
    if (!assignmentId) return false;
    setCandidateActionId(assignmentId);
    setErrorMessage("");
    try {
      await rejectGiverAssignmentCandidateFromApi(assignmentId);
      await refresh();
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal menolak kandidat.");
      return false;
    } finally {
      setCandidateActionId("");
    }
  }, [refresh]);

  const shareAssignmentLocation = useCallback(async (assignmentId: string): Promise<boolean> => {
    if (!assignmentId) return false;
    setLocationActionId(assignmentId);
    setErrorMessage("");
    try {
      await shareGiverAssignmentLocationFromApi(assignmentId);
      await refresh();
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal share lokasi detail.");
      return false;
    } finally {
      setLocationActionId("");
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    quests,
    draftQuests: quests.filter((quest) => quest.isPrivateDraft),
    publishedQuests: quests.filter((quest) => !quest.isPrivateDraft && quest.bothRated !== true),
    assignmentsByQuest,
    candidates,
    auditActionId,
    candidateActionId,
    locationActionId,
    draftActionId,
    isLoading,
    errorMessage,
    refresh,
    deleteDraft,
    auditAssignment,
    confirmCandidate,
    rejectCandidate,
    shareAssignmentLocation,
  };
}

export function formatRupiah(val: string): string {
  const digits = val.replace(/\D/g, "");
  if (!digits) return "";
  return parseInt(digits, 10).toLocaleString("id-ID");
}

export function parseRupiah(val: string): number {
  return parseInt(val.replace(/\./g, "").replace(/,/g, ""), 10) || 0;
}

export function useQuestEditorVM(initialDraft?: GiverDraftQuest, onPublished?: () => void) {
  const initialReward = initialDraft?.rewardAmount
    ? formatRupiah(String(initialDraft.rewardAmount))
    : "";
  const [step, setStep] = useState<EditorStep>(1);
  const [title, setTitle] = useState(initialDraft?.title ?? "");
  const [description, setDescription] = useState(initialDraft?.description ?? "");
  const [category, setCategory] = useState(initialDraft?.category ?? "Event Organizer");
  const [locationAddress, setLocationAddress] = useState(
    initialDraft?.fullAddress || initialDraft?.location || "Jakarta Selatan (GPS Auto)",
  );
  const [questType, setQuestType] = useState<EditorQuestType>(
    initialDraft?.modeValue === "group" || initialDraft?.mode === "Ber-Kelompok" ? "KELOMPOK" : "SOLO",
  );
  const [slotCount, setSlotCount] = useState(Math.max(1, initialDraft?.slotTotal ?? 1));
  const [selectedSkills, setSelectedSkills] = useState<string[]>(
    initialDraft?.skillTags?.length
      ? initialDraft.skillTags
      : initialDraft?.skillTag
        ? initialDraft.skillTag.split(" + ").filter(Boolean)
        : [],
  );
  const [upahMin, setUpahMin] = useState(initialReward);
  const [upahMax, setUpahMax] = useState(initialReward);
  const [baseRadius, setBaseRadius] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("virtual_account");
  const [escrowLocked, setEscrowLocked] = useState(initialDraft?.escrowState === "LOCKED");
  const [createdQuestId, setCreatedQuestId] = useState(initialDraft?.id ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    initialDraft ? "Draft privat dimuat. Edit lalu update sebelum broadcast." : "",
  );
  const [errorMessage, setErrorMessage] = useState("");

  const upahMinNum = parseRupiah(upahMin);
  const upahMaxNum = parseRupiah(upahMax);
  const totalEscrowMin = upahMinNum * (questType === "KELOMPOK" ? slotCount : 1);
  const totalEscrowMax = upahMaxNum * (questType === "KELOMPOK" ? slotCount : 1);
  const platformFeeMin = Math.round(totalEscrowMin * (QQM_PLATFORM_FEE_PERCENT / 100));
  const platformFeeMax = Math.round(totalEscrowMax * (QQM_PLATFORM_FEE_PERCENT / 100));
  const totalDepositMax = totalEscrowMax + platformFeeMax;

  function toggleSkill(skill: string) {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill],
    );
  }

  const canProceedStep1 =
    title.trim() !== "" &&
    description.trim() !== "" &&
    selectedSkills.length > 0 &&
    upahMin !== "" &&
    upahMax !== "" &&
    upahMaxNum >= upahMinNum;
  const canProceedStep2 = true;
  const canBroadcast = escrowLocked;
  const isEditingDraft = Boolean(initialDraft?.id);

  function buildDraftPayload() {
    return {
      title: title.trim(),
      description: description.trim(),
      category,
      mode: questType === "KELOMPOK" ? "group" as const : "solo" as const,
      skill_tags: selectedSkills,
      reward_amount: upahMaxNum,
      reward_currency: "IDR" as const,
      max_runner: questType === "KELOMPOK" ? slotCount : 1,
      full_address: locationAddress.trim(),
      base_radius_km: baseRadius,
    };
  }

  async function createDraftQuest() {
    setIsSubmitting(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const payload = buildDraftPayload();
      const quest = createdQuestId
        ? await updateGiverQuestDraftFromApi(createdQuestId, payload)
        : await createGiverQuestFromApi(payload);
      setCreatedQuestId(quest.id ?? createdQuestId);
      setStatusMessage(
        createdQuestId
          ? "Draft quest berhasil diperbarui. Lanjut deposit atau broadcast kalau escrow sudah locked."
          : "Draft quest berhasil dibuat. Lanjut deposit escrow.",
      );
      setStep(3);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal membuat draft quest.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function lockEscrow() {
    if (!createdQuestId) {
      await createDraftQuest();
      return;
    }
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      await lockGiverQuestEscrowFromApi(createdQuestId, paymentMethod);
      setEscrowLocked(true);
      setStatusMessage("Escrow berhasil dikunci. Quest siap broadcast.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal mengunci escrow.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function publishQuest() {
    if (!createdQuestId || !escrowLocked) return;
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      await publishGiverQuestFromApi(createdQuestId);
      setStatusMessage("Quest berhasil dibroadcast ke feed runner.");
      onPublished?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal publish quest.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    step,
    setStep,
    title,
    setTitle,
    description,
    setDescription,
    category,
    setCategory,
    locationAddress,
    setLocationAddress,
    questType,
    setQuestType,
    slotCount,
    setSlotCount,
    selectedSkills,
    toggleSkill,
    upahMin,
    setUpahMin,
    upahMax,
    setUpahMax,
    baseRadius,
    setBaseRadius,
    paymentMethod,
    setPaymentMethod,
    escrowLocked,
    setEscrowLocked,
    createdQuestId,
    isSubmitting,
    statusMessage,
    errorMessage,
    upahMinNum,
    upahMaxNum,
    totalEscrowMin,
    totalEscrowMax,
    platformFeeMin,
    platformFeeMax,
    totalDepositMax,
    canProceedStep1,
    canProceedStep2,
    canBroadcast,
    isEditingDraft,
    skillTags: QQM_SKILL_TAGS,
    platformFeePercent: QQM_PLATFORM_FEE_PERCENT,
    createDraftQuest,
    lockEscrow,
    publishQuest,
  };
}
