
export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiErrorPayload = {
  success?: boolean;
  message?: string;
  error?: string;
  details?: unknown;
};

export class ApiRequestError extends Error {
  statusCode: number;
  payload?: ApiErrorPayload;

  constructor(message: string, statusCode = 500, payload?: ApiErrorPayload) {
    super(message);
    this.name = "ApiRequestError";
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

const DEFAULT_STREAM_API_URL = "http://localhost:4450";
const AUTH_ACCESS_TOKEN_STORAGE_KEY = "qqm-auth-access-token";

function sanitizeEnvUrl(value: string | undefined, fallback: string): string {
  const normalized = (value ?? "").trim();
  const raw = normalized || fallback;

  const withoutQuotes =
    (raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))
      ? raw.slice(1, -1).trim()
      : raw;

  return withoutQuotes.replace(/\/+$/, "");
}

function joinApiUrl(baseUrl: string, path: string): string {
  const normalizedBase = sanitizeEnvUrl(baseUrl, DEFAULT_STREAM_API_URL);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

const API_BASE_URLS = {
  stream: sanitizeEnvUrl(import.meta.env.VITE_STREAM_API_URL, DEFAULT_STREAM_API_URL),
} as const;

// Gunakan Localhost untuk Development & Gunakan URL Asli untuk Production
// Untuk Testing Gunakan URL Asli (Semi-Production)

const ENDPOINTS = {
  auth: {
    login: joinApiUrl(API_BASE_URLS.stream, "/api/login"),
    register: joinApiUrl(API_BASE_URLS.stream, "/api/register"),
    logout: joinApiUrl(API_BASE_URLS.stream, "/api/logout"),
  },
  profile: {
    detail: joinApiUrl(API_BASE_URLS.stream, "/api/profile"),
    verification: {
      detail: joinApiUrl(API_BASE_URLS.stream, "/api/profile/verification"),
      draft: joinApiUrl(API_BASE_URLS.stream, "/api/profile/verification/draft"),
      documents: joinApiUrl(API_BASE_URLS.stream, "/api/profile/verification/documents"),
      submit: joinApiUrl(API_BASE_URLS.stream, "/api/profile/verification/submit"),
      resubmit: joinApiUrl(API_BASE_URLS.stream, "/api/profile/verification/resubmit"),
      history: joinApiUrl(API_BASE_URLS.stream, "/api/profile/verification/history"),
    },
  },
  quest: {
    list: joinApiUrl(API_BASE_URLS.stream, "/api/quests"),
    detail: (questId: string) => joinApiUrl(API_BASE_URLS.stream, `/api/quests/${questId}`),
  },
  giverQuest: {
    list: joinApiUrl(API_BASE_URLS.stream, "/api/giver/quests"),
    history: joinApiUrl(API_BASE_URLS.stream, "/api/giver/quests/history"),
    create: joinApiUrl(API_BASE_URLS.stream, "/api/giver/quests"),
    update: (questId: string) =>
      joinApiUrl(API_BASE_URLS.stream, `/api/giver/quests/${questId}`),
    remove: (questId: string) =>
      joinApiUrl(API_BASE_URLS.stream, `/api/giver/quests/${questId}`),
    lockEscrow: (questId: string) =>
      joinApiUrl(API_BASE_URLS.stream, `/api/giver/quests/${questId}/escrow/lock`),
    publish: (questId: string) =>
      joinApiUrl(API_BASE_URLS.stream, `/api/giver/quests/${questId}/publish`),
    assignments: (questId: string) =>
      joinApiUrl(API_BASE_URLS.stream, `/api/giver/quests/${questId}/assignments`),
  },
  giverAssignment: {
    accept: (assignmentId: string) =>
      joinApiUrl(API_BASE_URLS.stream, `/api/giver/assignments/${assignmentId}/accept`),
    confirm: (assignmentId: string) =>
      joinApiUrl(API_BASE_URLS.stream, `/api/giver/assignments/${assignmentId}/confirm`),
    reject: (assignmentId: string) =>
      joinApiUrl(API_BASE_URLS.stream, `/api/giver/assignments/${assignmentId}/reject`),
    shareLocation: (assignmentId: string) =>
      joinApiUrl(API_BASE_URLS.stream, `/api/giver/assignments/${assignmentId}/share-location`),
    requestRevision: (assignmentId: string) =>
      joinApiUrl(API_BASE_URLS.stream, `/api/giver/assignments/${assignmentId}/request-revision`),
    dispute: (assignmentId: string) =>
      joinApiUrl(API_BASE_URLS.stream, `/api/giver/assignments/${assignmentId}/dispute`),
  },
  runnerQuest: {
    active: joinApiUrl(API_BASE_URLS.stream, "/api/runner/quests/active"),
    history: joinApiUrl(API_BASE_URLS.stream, "/api/runner/quests/history"),
    take: (questId: string) =>
      joinApiUrl(API_BASE_URLS.stream, `/api/runner/quests/${questId}/take`),
    start: (questId: string) =>
      joinApiUrl(API_BASE_URLS.stream, `/api/runner/quests/${questId}/start`),
    finish: (questId: string) =>
      joinApiUrl(API_BASE_URLS.stream, `/api/runner/quests/${questId}/finish`),
  },
  rating: {
    create: joinApiUrl(API_BASE_URLS.stream, "/api/ratings"),
  },
  dispute: {
    list: joinApiUrl(API_BASE_URLS.stream, "/api/disputes"),
    detail: (disputeId: string) => joinApiUrl(API_BASE_URLS.stream, `/api/disputes/${disputeId}`),
    create: joinApiUrl(API_BASE_URLS.stream, "/api/disputes"),
    evidence: (disputeId: string) =>
      joinApiUrl(API_BASE_URLS.stream, `/api/disputes/${disputeId}/evidence`),
    mediate: (disputeId: string) =>
      joinApiUrl(API_BASE_URLS.stream, `/api/disputes/${disputeId}/mediate`),
  },
  admin: {
    verifications: joinApiUrl(API_BASE_URLS.stream, "/api/admin/verifications"),
    verificationDetail: (verificationId: string) =>
      joinApiUrl(API_BASE_URLS.stream, `/api/admin/verifications/${verificationId}`),
    approveVerification: (verificationId: string) =>
      joinApiUrl(API_BASE_URLS.stream, `/api/admin/verifications/${verificationId}/approve`),
    rejectVerification: (verificationId: string) =>
      joinApiUrl(API_BASE_URLS.stream, `/api/admin/verifications/${verificationId}/reject`),
    requestVerificationResubmission: (verificationId: string) =>
      joinApiUrl(API_BASE_URLS.stream, `/api/admin/verifications/${verificationId}/resubmission`),
    disputes: joinApiUrl(API_BASE_URLS.stream, "/api/admin/disputes"),
    disputeDetail: (disputeId: string) =>
      joinApiUrl(API_BASE_URLS.stream, `/api/admin/disputes/${disputeId}`),
    mediateDispute: (disputeId: string) =>
      joinApiUrl(API_BASE_URLS.stream, `/api/admin/disputes/${disputeId}/mediate`),
    autoReleaseSweep: joinApiUrl(API_BASE_URLS.stream, "/api/admin/escrows/auto-release"),
  },
};

export const GOOGLE_MAPS_CONFIG = {
  apiKey: import.meta.env.VITE_MAPS_API_KEY ?? "",
  mapId: import.meta.env.VITE_MAPS_ID ?? "",
};

export type RequestJsonOptions = {
  method?: ApiMethod;
  body?: unknown;
  headers?: HeadersInit;
  credentials?: RequestCredentials;
};

export function readAccessToken(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.sessionStorage.getItem(AUTH_ACCESS_TOKEN_STORAGE_KEY)?.trim() ?? "";
}

export function persistAccessToken(token: string | undefined): void {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = token?.trim() ?? "";
  if (!normalized) {
    window.sessionStorage.removeItem(AUTH_ACCESS_TOKEN_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(AUTH_ACCESS_TOKEN_STORAGE_KEY, normalized);
}

export function clearAccessToken(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(AUTH_ACCESS_TOKEN_STORAGE_KEY);
}

function createRequestHeaders(headers?: HeadersInit): Headers {
  const resolved = new Headers(headers);

  if (!resolved.has("Accept")) {
    resolved.set("Accept", "application/json");
  }

  if (!resolved.has("Content-Type")) {
    resolved.set("Content-Type", "application/json");
  }

  const accessToken = readAccessToken();
  if (accessToken && !resolved.has("Authorization")) {
    resolved.set("Authorization", `Bearer ${accessToken}`);
  }

  return resolved;
}

function ensureRequestUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed || trimmed.includes("undefined") || trimmed.includes("null")) {
    throw new ApiRequestError(
      "Konfigurasi endpoint backend belum valid. Periksa VITE_STREAM_API_URL di React/.env.",
      500,
    );
  }

  return trimmed;
}

function parseResponsePayload(rawText: string): unknown {
  if (!rawText) {
    return undefined;
  }

  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    return rawText;
  }
}

function toApiErrorPayload(payload: unknown): ApiErrorPayload {
  if (payload && typeof payload === "object") {
    return payload as ApiErrorPayload;
  }

  if (typeof payload === "string" && payload.trim()) {
    return { message: payload.trim() };
  }

  return {};
}

export async function requestJson<TResponse>(url: string, options: RequestJsonOptions = {}): Promise<TResponse> {
  const { method = "GET", body, headers, credentials = "include" } = options;
  const resolvedUrl = ensureRequestUrl(url);
  const requestHeaders = createRequestHeaders(headers);

  let response: Response;
  try {
    response = await fetch(resolvedUrl, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials,
    });
  } catch (error) {
    throw new ApiRequestError(
      error instanceof Error
        ? error.message
        : "Gagal terhubung ke backend strict. Periksa host, port, dan CORS.",
      0,
    );
  }

  const rawText = await response.text();
  const payload = parseResponsePayload(rawText);

  if (!response.ok) {
    const errorPayload = toApiErrorPayload(payload);
    const fallbackMessage =
      response.status === 502
        ? `Backend strict mengembalikan 502 untuk ${method} ${resolvedUrl}. Cek host atau gateway tujuan.`
        : `Request ke ${resolvedUrl} gagal.`;
    throw new ApiRequestError(
      errorPayload.message || errorPayload.error || fallbackMessage,
      response.status,
      errorPayload,
    );
  }

  return payload as TResponse;
}

export function postJson<TRequest, TResponse>(url: string, body: TRequest): Promise<TResponse> {
  return requestJson<TResponse>(url, {
    method: "POST",
    body,
  });
}

function GlobalEndpoint() {
  return ENDPOINTS;
}

export default GlobalEndpoint;

// ----- Testing ----- //
function Container() {
  const Container1 = [
    {
      id: 1,
      name: "Test 1",
      description: "This is a test description for Test 1.",
      date: "2024-06-01",
      status: "Active",
    }
  ]

  const Container2 = [
    {
      id: 2,
      name: "Test 2",
      description: "This is a test description for Test 2.",
      date: "2024-06-01",
      status: "Active",
    }
  ]

  return { Container1, Container2 };
}
export { Container };
