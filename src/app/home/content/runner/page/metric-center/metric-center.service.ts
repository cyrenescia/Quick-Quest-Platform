import GlobalEndpoint, { requestJson } from "../../../../../global.service";
import type { ApiEnvelope } from "../../runner.service";
import type { ApiPerformanceSummary } from "../../runner.service";

export async function fetchMetricSummary() {
  const response = await requestJson<ApiEnvelope<ApiPerformanceSummary>>(
    GlobalEndpoint().performance.summary,
  );
  return response.data ?? null;
}

export async function fetchMetricLedger(page: number = 1, limit: number = 10) {
  const url = new URL(GlobalEndpoint().performance.ledger);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(limit));
  const response = await requestJson<ApiEnvelope<any>>(url.toString());
  return response.data ?? null;
}
