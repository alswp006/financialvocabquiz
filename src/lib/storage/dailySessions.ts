import type {
  DailyQuizSession,
  DailyQuizSessionStoreV2,
  DailySessionUniqueKey,
} from "@/lib/types";
import { safeGetJSON, safeSetJSON } from "@/lib/storage/safeStorage";

export const DAILY_SESSIONS_KEY = "fvq_daily_sessions_v2";

function readStore(): DailyQuizSessionStoreV2 {
  const result = safeGetJSON<DailyQuizSessionStoreV2>(DAILY_SESSIONS_KEY);
  if (result.ok && result.data) {
    return result.data;
  }
  return { byUniqueKey: {} };
}

function writeStore(store: DailyQuizSessionStoreV2): void {
  safeSetJSON(DAILY_SESSIONS_KEY, store);
}

export function toDailySessionUniqueKey(
  clientId: string,
  dateISO: string,
  difficulty: DailyQuizSession["difficulty"]
): DailySessionUniqueKey {
  return `${clientId}:${dateISO}:${difficulty}`;
}

export function saveDailySession(session: DailyQuizSession): void {
  const store = readStore();
  const uniqueKey = toDailySessionUniqueKey(
    session.clientId,
    session.dateISO,
    session.difficulty
  );
  store.byUniqueKey[uniqueKey] = session;
  writeStore(store);
}

export function getDailySessionByKey(
  uniqueKey: DailySessionUniqueKey
): DailyQuizSession | null {
  const store = readStore();
  return store.byUniqueKey[uniqueKey] ?? null;
}

export function findSessionBySessionId(sessionId: string): DailyQuizSession | null {
  const store = readStore();
  for (const session of Object.values(store.byUniqueKey)) {
    if (session.sessionId === sessionId) {
      return session;
    }
  }
  return null;
}

export function deleteAllSessions(): void {
  writeStore({ byUniqueKey: {} });
}
