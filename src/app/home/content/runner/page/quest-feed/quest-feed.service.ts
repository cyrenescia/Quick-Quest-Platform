import {
  fetchRunnerBroadcastQuestsFromApi,
  getCachedRunnerQuestFeed,
  getRunnerDeviceLocationRaw,
  takeRunnerQuestFromApi,
  type RunnerQuestFeedItem,
  type RunnerRawCoords,
} from "../../runner.service";

export function getRunnerQuestFeedSeed(): RunnerQuestFeedItem[] {
  return getCachedRunnerQuestFeed();
}

export async function fetchRunnerQuestFeedLive(): Promise<RunnerQuestFeedItem[]> {
  try {
    const coords = await getRunnerDeviceLocationRaw();
    return fetchRunnerBroadcastQuestsFromApi(coords);
  } catch {
    return fetchRunnerBroadcastQuestsFromApi();
  }
}

export async function takeRunnerQuestLive(questId: string): Promise<void> {
  let coords: RunnerRawCoords | undefined;
  try {
    coords = await getRunnerDeviceLocationRaw();
  } catch {
    coords = undefined;
  }

  await takeRunnerQuestFromApi(questId, coords);
}

export const RUNNER_QUEST_FEED_SUBVIEW_STORAGE_KEY_SEED =
  "nvrs-qqm-runner-quest-feed-subview-v1";
