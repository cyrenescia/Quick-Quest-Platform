import GlobalEndpoint, { requestJson } from "../../../../../global.service";
import type { ApiEnvelope } from "../../runner.service";

export async function fetchSkillInventory() {
  const response = await requestJson<ApiEnvelope<any>>(
    GlobalEndpoint().performance.skills,
  );
  return response.data ?? null;
}
