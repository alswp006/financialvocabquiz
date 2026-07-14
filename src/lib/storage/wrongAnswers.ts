import type { WrongAnswerItem, WrongAnswersStoreV2, WrongAnswerUniqueKey } from "@/lib/types";
import { safeGetJSON, safeSetJSON } from "@/lib/storage/safeStorage";

export const WRONG_ANSWERS_KEY = "fvq_wrong_answers_v2";
export const WRONG_ANSWERS_MAX = 200;

function readStore(): WrongAnswersStoreV2 {
  const result = safeGetJSON<WrongAnswersStoreV2>(WRONG_ANSWERS_KEY);
  if (result.ok && result.data) {
    return result.data;
  }
  return { byUniqueKey: {} };
}

function writeStore(store: WrongAnswersStoreV2): void {
  safeSetJSON(WRONG_ANSWERS_KEY, store);
}

export function toWrongAnswerUniqueKey(
  clientId: string,
  questionId: string
): WrongAnswerUniqueKey {
  return `${clientId}:${questionId}`;
}

function evictOldestIfNeeded(store: WrongAnswersStoreV2): void {
  const entries = Object.entries(store.byUniqueKey);
  if (entries.length <= WRONG_ANSWERS_MAX) return;

  entries.sort(
    (a, b) =>
      new Date(a[1].lastWrongAtISO).getTime() - new Date(b[1].lastWrongAtISO).getTime()
  );

  const excess = entries.length - WRONG_ANSWERS_MAX;
  for (let i = 0; i < excess; i++) {
    delete store.byUniqueKey[entries[i][0] as WrongAnswerUniqueKey];
  }
}

export function saveWrongAnswer(item: WrongAnswerItem): void {
  const store = readStore();
  const uniqueKey = toWrongAnswerUniqueKey(item.clientId, item.questionId);
  store.byUniqueKey[uniqueKey] = item;
  evictOldestIfNeeded(store);
  writeStore(store);
}

export function getWrongAnswer(uniqueKey: WrongAnswerUniqueKey): WrongAnswerItem | null {
  const store = readStore();
  return store.byUniqueKey[uniqueKey] ?? null;
}

export function getAllWrongAnswers(clientId: string): WrongAnswerItem[] {
  const store = readStore();
  return Object.values(store.byUniqueKey).filter((item) => item.clientId === clientId);
}

export function deleteAllWrongAnswers(): void {
  writeStore({ byUniqueKey: {} });
}
