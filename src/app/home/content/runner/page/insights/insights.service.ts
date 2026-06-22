import {
  runnerAvailabilitySchedule,
  runnerEarningTrajectory,
  runnerFocusInsight,
  runnerMembers,
  runnerReliabilityBadges,
  runnerSkillInventory,
} from "../../runner";
import GlobalEndpoint, { requestJson } from "../../../../../global.service";
import type { ApiEnvelope } from "../../runner.service";
import type { ApiPerformanceSummary } from "../../runner.service";

export async function fetchRunnerInsightsSummary() {
  const response = await requestJson<ApiEnvelope<ApiPerformanceSummary>>(
    GlobalEndpoint().performance.summary,
  );
  return response.data ?? null;
}

export async function fetchRunnerInsightsSkills() {
  const response = await requestJson<ApiEnvelope<any>>(
    GlobalEndpoint().performance.skills,
  );
  return response.data ?? null;
}

export function getRunnerInsightsSeed() {
  return {
    availability: runnerAvailabilitySchedule,
    earnings: runnerEarningTrajectory,
    focus: runnerFocusInsight,
    members: runnerMembers,
    badges: runnerReliabilityBadges,
    skills: runnerSkillInventory,
  };
}
