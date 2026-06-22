import { useCallback, useEffect, useState } from "react";
import type { RunnerQuestFeedItem } from "../../runner.service";
import {
  RUNNER_QUEST_FEED_SUBVIEW_STORAGE_KEY_SEED,
  fetchRunnerQuestFeedLive,
  getRunnerQuestFeedSeed,
  takeRunnerQuestLive,
} from "./quest-feed.service";

export type RunnerQuestFeedSubView = null | { view: "Detail"; questId: string };

export const runnerQuestFeedSubViewStorageKey =
  RUNNER_QUEST_FEED_SUBVIEW_STORAGE_KEY_SEED;

export function useRunnerQuestFeedVM() {
  const [quests, setQuests] = useState<RunnerQuestFeedItem[]>(getRunnerQuestFeedSeed);
  const [isLoading, setIsLoading] = useState(false);
  const [actionQuestId, setActionQuestId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const items = await fetchRunnerQuestFeedLive();
      setQuests(items.length > 0 ? items : getRunnerQuestFeedSeed());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal mengambil quest feed.");
      setQuests(getRunnerQuestFeedSeed());
    } finally {
      setIsLoading(false);
    }
  }, []);

  const takeQuest = useCallback(async (questId: string) => {
    setActionQuestId(questId);
    setErrorMessage("");
    try {
      await takeRunnerQuestLive(questId);
      await refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal mengirim lamaran quest.");
      throw error;
    } finally {
      setActionQuestId("");
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    quests,
    isLoading,
    actionQuestId,
    errorMessage,
    refresh,
    takeQuest,
  };
}

export function resolveQuestFeedModeClass(mode: RunnerQuestFeedItem["mode"]) {
  return mode === "group"
    ? "bg-secondary/10 text-secondary"
    : "bg-info/10 text-info";
}

export function formatQuestFeedExpandCountdown(seconds?: number): string {
  const safeSeconds = Math.max(0, Number.isFinite(seconds ?? 0) ? seconds ?? 0 : 0);
  if (safeSeconds <= 0) {
    return "radius maksimal aktif";
  }

  const minutes = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  if (minutes <= 0) {
    return `${secs} detik lagi`;
  }
  return `${minutes} menit ${secs.toString().padStart(2, "0")} detik lagi`;
}

export function resolveQuestFeedMatchReason(quest: RunnerQuestFeedItem): string {
  if (quest.isAccessible === false) {
    return quest.accessibilityReason || "Quest terkunci untuk tier runner saat ini.";
  }

  const activeRadius = quest.activeRadiusKm ?? Math.max(1, quest.distanceKm);
  const nextRadius = quest.nextRadiusKm ?? activeRadius + 1;
  const distanceText = Number.isFinite(quest.distanceKm)
    ? `${quest.distanceKm} km dari lokasimu`
    : "jarak belum tersedia";

  if (quest.matchingScope === "coordinate_radius") {
    return `Masuk radius ${activeRadius} km, ${distanceText}. Radius berikutnya ${nextRadius} km dalam ${formatQuestFeedExpandCountdown(quest.nextExpandInSeconds)}.`;
  }

  if (quest.matchingScope?.startsWith("same_")) {
    return `Match area profil runner. Radius aktif ${activeRadius} km, expand berikutnya ${nextRadius} km dalam ${formatQuestFeedExpandCountdown(quest.nextExpandInSeconds)}.`;
  }

  return `Fallback broadcast aktif. Radius ${activeRadius} km, expand berikutnya ${nextRadius} km dalam ${formatQuestFeedExpandCountdown(quest.nextExpandInSeconds)}.`;
}

export function canTakeQuestFromFeed(quest: RunnerQuestFeedItem): boolean {
  return quest.withinMatchRadius !== false && quest.isAccessible !== false;
}

export function resolveQuestFeedActionLabel(
  quest: RunnerQuestFeedItem,
  isWorking: boolean,
): string {
  if (isWorking) {
    return "Mengirim lamaran...";
  }

  if (quest.isAccessible === false) {
    return "Tier terkunci";
  }

  if (!canTakeQuestFromFeed(quest)) {
    return "Di luar radius";
  }

  return quest.mode === "group" ? "Apply Group Quest" : "Apply Quest";
}

export function resolveInitialRunnerQuestFeedSubView(): RunnerQuestFeedSubView {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(runnerQuestFeedSubViewStorageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as RunnerQuestFeedSubView;
    if (!parsed) {
      return null;
    }

    return parsed.view === "Detail" && parsed.questId ? parsed : null;
  } catch {
    return null;
  }
}

export function syncRunnerQuestFeedSubViewStorage(
  subView: RunnerQuestFeedSubView,
): void {
  if (typeof window === "undefined") {
    return;
  }

  if (subView) {
    window.localStorage.setItem(
      runnerQuestFeedSubViewStorageKey,
      JSON.stringify(subView),
    );
  } else {
    window.localStorage.removeItem(runnerQuestFeedSubViewStorageKey);
  }
}
