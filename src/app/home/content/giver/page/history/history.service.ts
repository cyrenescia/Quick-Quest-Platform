import GlobalEndpoint, { requestJson } from "../../../../../global.service";
import type { ApiEnvelope } from "../../giver.service";

export async function fetchGiverHistoryRatings() {
  const url = new URL(GlobalEndpoint().performance.ratings);
  const response = await requestJson<ApiEnvelope<any>>(url.toString());
  return response.data ?? null;
}
