/**
 * Leaderboard API Client
 *
 * Provides functions to:
 * - Fetch weekly leaderboard entries with pagination
 * - Submit weekly scores
 *
 * Implementation stub for TDD red phase.
 */

export interface WeeklyLeaderboardEntry {
  id: string;
  weekId: string;
  clientId: string;
  nickname: string;
  weeklyIqDelta: number;
  rank: number;
  createdAtISO: string;
  updatedAtISO: string;
}

export interface FetchWeeklyLeaderboardParams {
  weekId: string;
  limit: number;
  cursor?: string;
}

export interface FetchWeeklyLeaderboardResponse {
  entries: WeeklyLeaderboardEntry[];
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
  entry: Omit<WeeklyLeaderboardEntry, "rank">;
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

/**
 * Fetch weekly leaderboard entries with pagination
 *
 * GET /leaderboard/weekly?weekId&limit&cursor
 *
 * Returns:
 * - 200: { entries, hasNext, nextCursor }
 * - 400+: { error: { code, message } }
 * - Network error: { status < 200, error: { code: NETWORK_ERROR } }
 */
export async function fetchWeeklyLeaderboard(
  params: FetchWeeklyLeaderboardParams
): Promise<ApiResult<FetchWeeklyLeaderboardResponse>> {
  // TDD red phase — implementation stub
  throw new Error("Not implemented");
}

/**
 * Submit a weekly leaderboard score
 *
 * POST /leaderboard/weekly/submit
 * Body: { weekId, clientId, nickname, weeklyIqDelta }
 *
 * Returns:
 * - 200: { entry: { id, createdAtISO, updatedAtISO, ... }, rank }
 * - 400+: { error: { code, message } }
 * - Network error: { status < 200, error: { code: NETWORK_ERROR } }
 */
export async function submitWeeklyLeaderboard(
  request: SubmitWeeklyLeaderboardRequest
): Promise<ApiResult<SubmitWeeklyLeaderboardResponse>> {
  // TDD red phase — implementation stub
  throw new Error("Not implemented");
}
