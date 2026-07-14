import type { UserProgress } from "@/lib/types";
import { createId } from "@/lib/id";
import { nowISO } from "@/lib/time";
import { safeGetJSON, safeSetJSON, safeRemove } from "@/lib/storage/safeStorage";
import { deleteAllSessions } from "@/lib/storage/dailySessions";
import { deleteAllWrongAnswers } from "@/lib/storage/wrongAnswers";
import { deleteAllLeaderboardCache } from "@/lib/storage/leaderboardCache";

export const USER_PROGRESS_KEY = "fvq_user_progress_v2";

export function createDefaultUserProgress(nickname = "게스트"): UserProgress {
  const clientId = createId("user");
  const timestamp = nowISO();
  return {
    id: clientId,
    clientId,
    nickname,
    iqTotal: 0,
    streak: { current: 0, best: 0 },
    aiDisclosureAccepted: false,
    createdAtISO: timestamp,
    updatedAtISO: timestamp,
  };
}

export function getUserProgress(): UserProgress | null {
  const result = safeGetJSON<UserProgress>(USER_PROGRESS_KEY);
  if (!result.ok) return null;
  return result.data;
}

export function saveUserProgress(progress: UserProgress): void {
  safeSetJSON(USER_PROGRESS_KEY, progress);
}

export function resetUserProgress(): UserProgress {
  safeRemove(USER_PROGRESS_KEY);
  deleteAllSessions();
  deleteAllWrongAnswers();
  deleteAllLeaderboardCache();

  const fresh = createDefaultUserProgress();
  saveUserProgress(fresh);
  return fresh;
}
