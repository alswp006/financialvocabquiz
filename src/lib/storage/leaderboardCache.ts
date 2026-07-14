import type { WeeklyLeaderboardCacheV2, WeeklyLeaderboardEntry } from "@/lib/types";
import { nowISO } from "@/lib/time";
import { safeGetJSON, safeSetJSON } from "@/lib/storage/safeStorage";

export const LEADERBOARD_CACHE_KEY = "fvq_leaderboard_cache_v2";

function readStore(): WeeklyLeaderboardCacheV2 {
  const result = safeGetJSON<WeeklyLeaderboardCacheV2>(LEADERBOARD_CACHE_KEY);
  if (result.ok && result.data) {
    return result.data;
  }
  return {};
}

function writeStore(store: WeeklyLeaderboardCacheV2): void {
  safeSetJSON(LEADERBOARD_CACHE_KEY, store);
}

export function getLeaderboardCache(
  weekId: string
): { fetchedAtISO: string; entries: WeeklyLeaderboardEntry[] } | null {
  const store = readStore();
  return store[weekId] ?? null;
}

export function setLeaderboardCache(
  weekId: string,
  entries: WeeklyLeaderboardEntry[]
): void {
  const store = readStore();
  store[weekId] = { fetchedAtISO: nowISO(), entries };
  writeStore(store);
}

export function deleteAllLeaderboardCache(): void {
  writeStore({});
}
