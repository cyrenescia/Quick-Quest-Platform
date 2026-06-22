import GlobalEndpoint, { requestJson } from "../../../../../global.service";
import type { ApiEnvelope } from "../../runner.service";

export async function fetchRunnerHistoryRatings() {
  const url = new URL(GlobalEndpoint().performance.ratings);
  const response = await requestJson<ApiEnvelope<any>>(url.toString());
  return response.data ?? null;
}
