import { useCallback, useEffect, useState } from "react";
import {
  RUNNER_SUBVIEW_STORAGE_KEY_SEED,
  getRunnerDeviceLocationRaw,
  runnerActiveQuests,
  runnerAvailabilitySchedule,
  runnerCareerMetrics,
  runnerEarningTrajectory,
  runnerFocusInsight,
  runnerMembers,
  runnerOpenParties,
  runnerPartyLobbyChatMessages,
  runnerPartyLobbyInfoSeed,
  runnerQuestEscrowFlow,
  runnerQuestFeedSeed,
  runnerReliabilityBadges,
  runnerSkillInventory,
  runnerViewCopySeed,
  type RunnerQuestFeedItem,
  type RunnerRawCoords,
  type RunnerViewCopy,
} from "./runner.service";

export type RunnerMember = {
  name: string;
  primarySkill: string;
  currentStatus: "Ready" | "On Quest" | "Standby" | "Need Brief";
  location: string;
  reliabilityScore: string;
};

export type RunnerCareerMetric = {
  label: string;
  value: string;
  hint: string;
  tone: string;
};

export type RunnerSkillInventoryItem = {
  skill: string;
  level: "Q1" | "Q2" | "Q3";
  pp: string;
  completionRate: string;
  trend: string;
};

export type RunnerAvailabilitySlot = {
  day: string;
  morning: "Online" | "Limited" | "Offline";
  afternoon: "Online" | "Limited" | "Offline";
  night: "Online" | "Limited" | "Offline";
};

export type RunnerEarningPoint = {
  period: string;
  income: number;
  quests: number;
};

export type RunnerReliabilityBadge = {
  name: string;
  description: string;
  tone: string;
};

export type RunnerActiveQuestStatus =
  | "PENDING_GIVER_CONFIRMATION"
  | "HEADING_TO_LOCATION"
  | "ON_SITE"
  | "IN_PROGRESS"
  | "PENDING_CONFIRMATION"
  | "COMPLETED";

export type RunnerActiveQuest = {
  id: string;
  assignmentId: string;
  questTitle: string;
  giverName: string;
  escrowState: "LOCKED" | "IN_PROGRESS" | "PENDING_CONFIRMATION" | "RELEASED";
  status: RunnerActiveQuestStatus;
  reward: string;
  locationAddress: string;
  workLocationLabel: string;
  workLocationNote: string;
  locationSharedAt: string | null;
  workStartedAt: string | null;
  workFinishedAt: string | null;
  autoReleaseAt: string | null;
  autoReleaseSecondsLeft: number;
  autoReleaseHoursLeft: number;
  ppGain: string;
  giverRated: boolean;
  runnerRated: boolean;
  viewerHasRated: boolean;
  bothRated: boolean;
};

export type RunnerOpenParty = {
  id: string;
  title: string;
  giver: string;
  slotFilled: number;
  slotTotal: number;
  reward: string;
  match: number;
};

export type RunnerPartyLobbySlotState = "self" | "filled" | "waiting";

export type RunnerPartyLobbySlot = {
  id: string;
  label: string;
  icon: string;
  state: RunnerPartyLobbySlotState;
};

export type RunnerPartyLobbyInfo = {
  id: string;
  title: string;
  giver: string;
  reward: string;
  slotTotal: number;
  teamSlots: RunnerPartyLobbySlot[];
};

export type RunnerPartyLobbyChatMessage = {
  id: string;
  sender: string;
  role: "giver" | "runner";
  content: string;
};

export type RunnerSubView =
  | { view: "Home" }
  | { view: "QuestFeed" }
  | { view: "ActiveQuest" }
  | { view: "PartyLobbyRoom"; payload: { partyId: string } }
  | { view: "MapsLive" }
  | { view: "Insights" }
  | { view: "History" };

export type RunnerWorkStatus = "idle" | "started" | "finished";
export type RunnerWorkStateMap = Record<string, RunnerWorkStatus>;
export type RunnerCountdownMap = Record<string, number>;
export type RunnerViewText = RunnerViewCopy;

export const runnerSubViewStorageKey = RUNNER_SUBVIEW_STORAGE_KEY_SEED;
export const runnerViewText: RunnerViewText = runnerViewCopySeed;

export function resolveRunnerSkillLevelClass(
  level: RunnerSkillInventoryItem["level"],
): string {
  if (level === "Q1") {
    return "bg-[#DBEAFE] text-[#1D4ED8]";
  }
  if (level === "Q2") {
    return "bg-[#FEF3C7] text-[#92400E]";
  }
  return "bg-[#DCFCE7] text-[#166534]";
}

export function resolveRunnerAvailabilityClass(
  status: RunnerAvailabilitySlot["morning"],
): string {
  if (status === "Online") {
    return "bg-[#DCFCE7] text-[#166534]";
  }
  if (status === "Limited") {
    return "bg-[#FEF3C7] text-[#92400E]";
  }
  return "bg-[#FECACA] text-[#991B1B]";
}

export function resolveRunnerMemberStatusClass(
  status: RunnerMember["currentStatus"],
): string {
  if (status === "Ready") {
    return "bg-[#DCFCE7] text-[#166534]";
  }
  if (status === "On Quest") {
    return "bg-[#DBEAFE] text-[#1D4ED8]";
  }
  if (status === "Standby") {
    return "bg-[#E9D5FF] text-[#6D28D9]";
  }
  return "bg-[#FECACA] text-[#991B1B]";
}

export function resolveRunnerActiveQuestEscrowClass(
  state: RunnerActiveQuest["escrowState"],
): string {
  if (state === "LOCKED") {
    return "bg-[#FEF3C7] text-[#92400E]";
  }
  if (state === "IN_PROGRESS") {
    return "bg-[#DBEAFE] text-[#1D4ED8]";
  }
  if (state === "PENDING_CONFIRMATION") {
    return "bg-[#E9D5FF] text-[#6D28D9]";
  }
  return "bg-[#DCFCE7] text-[#166534]";
}

export function createInitialRunnerWorkState(
  quests: RunnerActiveQuest[],
): RunnerWorkStateMap {
  return Object.fromEntries(
    quests.map((quest) => [
      quest.id,
      quest.status === "PENDING_GIVER_CONFIRMATION"
        ? "idle"
        : quest.workFinishedAt || quest.escrowState === "PENDING_CONFIRMATION" || quest.escrowState === "RELEASED"
        ? "finished"
        : quest.workStartedAt
          ? "started"
          : "idle",
    ]),
  ) as RunnerWorkStateMap;
}

export function createInitialRunnerCountdown(
  quests: RunnerActiveQuest[],
): RunnerCountdownMap {
  return Object.fromEntries(
    quests.map((quest) => [
      quest.id,
      quest.autoReleaseAt
        ? Math.max(0, Math.ceil((new Date(quest.autoReleaseAt).getTime() - Date.now()) / 1000))
        : quest.autoReleaseSecondsLeft,
    ]),
  ) as RunnerCountdownMap;
}

export function tickRunnerCountdown(
  previous: RunnerCountdownMap,
): RunnerCountdownMap {
  return Object.fromEntries(
    Object.entries(previous).map(([key, value]) => [key, Math.max(0, value - 1)]),
  );
}

export function formatRunnerCountdown(seconds: number): string {
  const safeSeconds = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
}

export function resolveRunnerAutoReleaseUrgency(seconds: number): boolean {
  return seconds < 7200;
}

export function resolveRunnerEscrowFlowIndex(
  flow: RunnerActiveQuest["escrowState"][],
  state: RunnerActiveQuest["escrowState"],
): number {
  return flow.indexOf(state);
}

export function createRunnerPartySlotFill(
  slotFilled: number,
  slotTotal: number,
): boolean[] {
  return Array.from({ length: slotTotal }, (_, index) => index < slotFilled);
}

export function resolveInitialRunnerSubView(): RunnerSubView {
  if (typeof window === "undefined") {
    return { view: "Home" };
  }

  try {
    const raw = window.localStorage.getItem(runnerSubViewStorageKey);
    if (!raw) {
      return { view: "Home" };
    }

    const parsed = JSON.parse(raw) as RunnerSubView;
    return parsed?.view ? parsed : { view: "Home" };
  } catch {
    return { view: "Home" };
  }
}

export function syncRunnerSubViewStorage(subView: RunnerSubView): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(runnerSubViewStorageKey, JSON.stringify(subView));
}

export function getRunnerPartyLobbyInfo(partyId: string): RunnerPartyLobbyInfo {
  return (
    runnerPartyLobbyInfoSeed.find((party) => party.id === partyId) ??
    runnerPartyLobbyInfoSeed[0]
  );
}

export function resolveRunnerPartyHeroParty(): RunnerOpenParty | null {
  return runnerOpenParties[0] ?? null;
}

export function resolveRunnerFeaturedQuest(): RunnerQuestFeedItem | null {
  return runnerQuestFeedSeed[0] ?? null;
}

export {
  runnerAvailabilitySchedule,
  runnerActiveQuests,
  runnerCareerMetrics,
  runnerEarningTrajectory,
  runnerFocusInsight,
  runnerMembers,
  runnerOpenParties,
  runnerPartyLobbyChatMessages,
  runnerPartyLobbyInfoSeed,
  runnerQuestEscrowFlow,
  runnerQuestFeedSeed,
  runnerReliabilityBadges,
  runnerSkillInventory,
};

export type RunnerMapMarkerRole = "ME_RUNNER" | "QUEST_LIVE" | "HOT_ZONE";

export interface RunnerMapMarker {
  id: string;
  position: RunnerRawCoords;
  role: RunnerMapMarkerRole;
  title: string;
  opacity: number;
}

export function useRunnerMapsLiveVM() {
  const [markers, setMarkers] = useState<RunnerMapMarker[]>([]);
  const [center, setCenter] = useState<RunnerRawCoords | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<
    "pending" | "granted" | "denied"
  >("pending");
  const [isLoading, setIsLoading] = useState(false);

  const generateDynamicPoints = (origin: RunnerRawCoords): RunnerMapMarker[] => {
    return [
      {
        id: "q-live-1",
        position: { lat: origin.lat + 0.002, lng: origin.lng + 0.001 },
        role: "QUEST_LIVE",
        title: "Paket Reguler",
        opacity: 0.9,
      },
      {
        id: "q-live-2",
        position: { lat: origin.lat - 0.0015, lng: origin.lng - 0.0025 },
        role: "QUEST_LIVE",
        title: "Cleaning",
        opacity: 0.9,
      },
      {
        id: "hot-zone-1",
        position: { lat: origin.lat + 0.004, lng: origin.lng - 0.003 },
        role: "HOT_ZONE",
        title: "Area Sibuk",
        opacity: 0.6,
      },
    ];
  };

  const requestLocationAndInitMap = useCallback(async () => {
    setIsLoading(true);
    try {
      const myCoords = await getRunnerDeviceLocationRaw();
      setCenter(myCoords);
      setPermissionStatus("granted");
      if (typeof window !== "undefined") {
        window.localStorage.setItem("qqm_maps_active", "true");
      }

      const allMarkers: RunnerMapMarker[] = [
        {
          id: "me",
          position: myCoords,
          role: "ME_RUNNER",
          title: "Lokasi Anda",
          opacity: 1,
        },
        ...generateDynamicPoints(myCoords),
      ];
      setMarkers(allMarkers);
    } catch {
      setPermissionStatus("denied");
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("qqm_maps_active");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasMapActive =
        window.localStorage.getItem("qqm_maps_active") === "true";
      if (hasMapActive) {
        void requestLocationAndInitMap();
      }
    }
  }, [requestLocationAndInitMap]);

  return {
    markers,
    center,
    permissionStatus,
    isLoading,
    requestLocationAndInitMap,
  };
}
