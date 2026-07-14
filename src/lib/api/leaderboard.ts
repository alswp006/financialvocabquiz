import type { WeeklyLeaderboardEntry } from "@/lib/types";

export interface WeeklyLeaderboardListEntry extends WeeklyLeaderboardEntry {
  rank: number;
}

export interface FetchWeeklyLeaderboardParams {
  weekId: string;
  limit: number;
  cursor?: string;
}

export interface FetchWeeklyLeaderboardResponse {
  entries: WeeklyLeaderboardListEntry[];
  hasNext: boolean;
  nextCursor: string;
}

export interface SubmitWeeklyLeaderboardRequest {
  weekId: string;
  clientId: string;
  nickname: string;
  weeklyIqDelta: number;
}

export interface SubmitWeeklyLeaderboardResponse {
  entry: WeeklyLeaderboardEntry;
  rank: number;
}

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResult<T> {
  status: number;
  data?: T;
  error?: ApiError;
}

type SafeFetchResult =
  | { kind: "network-error" }
  | { kind: "parse-error"; status: number; headers: Headers }
  | { kind: "http-error"; status: number; headers: Headers; body: unknown }
  | { kind: "ok"; status: number; headers: Headers; body: unknown };

async function safeFetchJson(url: string, init: RequestInit): Promise<SafeFetchResult> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    return { kind: "network-error" };
  }

  let text: string;
  try {
    text = await response.text();
  } catch {
    return { kind: "parse-error", status: response.status, headers: response.headers };
  }

  let body: unknown = null;
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      return { kind: "parse-error", status: response.status, headers: response.headers };
    }
  }

  return response.ok
    ? { kind: "ok", status: response.status, headers: response.headers, body }
    : { kind: "http-error", status: response.status, headers: response.headers, body };
}

function getBaseUrl(): string | undefined {
  return import.meta.env.VITE_LEADERBOARD_BASE_URL;
}

function toErrorResult<T>(result: SafeFetchResult): ApiResult<T> {
  switch (result.kind) {
    case "network-error":
      return { status: 0, error: { code: "NETWORK_ERROR", message: "Network request failed" } };
    case "parse-error":
      return {
        status: result.status,
        error: { code: "PARSE_ERROR", message: "Failed to parse response body" },
      };
    case "http-error": {
      const body = result.body as { error?: ApiError } | null;
      return {
        status: result.status,
        error: body?.error ?? { code: "HTTP_ERROR", message: "Request failed" },
      };
    }
    default:
      return { status: 0, error: { code: "NETWORK_ERROR", message: "Network request failed" } };
  }
}

/**
 * GET /leaderboard/weekly?weekId&limit&cursor
 * 200: { entries, hasNext (X-Has-Next header), nextCursor (X-Next-Cursor header) }
 * Never throws; failures are returned as ApiResult with status/error.
 */
export async function fetchWeeklyLeaderboard(
  params: FetchWeeklyLeaderboardParams
): Promise<ApiResult<FetchWeeklyLeaderboardResponse>> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return { status: 0, error: { code: "CONFIG_ERROR", message: "VITE_LEADERBOARD_BASE_URL is not set" } };
  }

  const query = new URLSearchParams({ weekId: params.weekId, limit: String(params.limit) });
  if (params.cursor) {
    query.set("cursor", params.cursor);
  }

  const result = await safeFetchJson(`${baseUrl}/leaderboard/weekly?${query.toString()}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (result.kind !== "ok") {
    return toErrorResult(result);
  }

  const body = result.body as { entries?: WeeklyLeaderboardListEntry[] } | null;
  return {
    status: result.status,
    data: {
      entries: body?.entries ?? [],
      hasNext: result.headers.get("X-Has-Next") === "true",
      nextCursor: result.headers.get("X-Next-Cursor") ?? "",
    },
  };
}

/**
 * POST /leaderboard/weekly/submit
 * 200: { entry, rank }
 * Never throws; failures are returned as ApiResult with status/error.
 */
export async function submitWeeklyLeaderboard(
  request: SubmitWeeklyLeaderboardRequest
): Promise<ApiResult<SubmitWeeklyLeaderboardResponse>> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return { status: 0, error: { code: "CONFIG_ERROR", message: "VITE_LEADERBOARD_BASE_URL is not set" } };
  }

  const result = await safeFetchJson(`${baseUrl}/leaderboard/weekly/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (result.kind !== "ok") {
    return toErrorResult(result);
  }

  const body = result.body as { entry?: WeeklyLeaderboardEntry; rank?: number } | null;
  return {
    status: result.status,
    data: {
      entry: body?.entry as WeeklyLeaderboardEntry,
      rank: body?.rank as number,
    },
  };
}
