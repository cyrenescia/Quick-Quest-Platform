import {
  runnerActiveQuests,
  runnerCareerMetrics,
  runnerOpenParties,
  runnerQuestFeedSeed,
  runnerViewText,
  resolveRunnerFeaturedQuest,
  resolveRunnerPartyHeroParty,
} from "../../runner";
import GlobalEndpoint, { requestJson } from "../../../../../global.service";
import type { ApiEnvelope } from "../../runner.service";

export async function fetchRunnerTierStatus() {
  const response = await requestJson<ApiEnvelope<any>>(
    GlobalEndpoint().runnerQuest.tierStatus,
  );
  return response.data ?? null;
}

export function getRunnerHomeSeed() {
  return {
    text: runnerViewText.home,
    metrics: runnerCareerMetrics.slice(0, 4),
    activeQuestCount: runnerActiveQuests.length,
    openQuestCount: runnerQuestFeedSeed.length,
    partyLobbyCount: runnerOpenParties.length,
    featuredQuest: resolveRunnerFeaturedQuest(),
    featuredParty: resolveRunnerPartyHeroParty(),
  };
}
