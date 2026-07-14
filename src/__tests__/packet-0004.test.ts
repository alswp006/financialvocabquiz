import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// NOTE: src/store/AppStore.tsx does not exist yet (TDD red phase).
// Use require() (not a static import) so `npx tsc --noEmit` doesn't fail on the
// missing module before the Coder implements it — see packet-0003.test.ts for
// the same convention with other not-yet-implemented modules.

import {
  createDefaultUserProgress,
  saveUserProgress,
  USER_PROGRESS_KEY,
} from "@/lib/storage/userProgress";
import {
  DAILY_SESSIONS_KEY,
  toDailySessionUniqueKey,
} from "@/lib/storage/dailySessions";
import {
  WRONG_ANSWERS_KEY,
  toWrongAnswerUniqueKey,
} from "@/lib/storage/wrongAnswers";
import { getQuizBankIndex } from "@/lib/quizBank/index";
import { getLocalDateISO } from "@/lib/time";

/**
 * Packet 0004: AppStore(Context) — 부트스트랩/복구 감지 + 오늘 세션 시작/답안 기록
 *
 * AC-1: AppStoreProvider/useAppStore export + bootstrap (userProgress 로드 or needsRecoveryDialog)
 * AC-2: startTodaySession — UNIQUE 재사용 / 신규 생성 / QUOTA_EXCEEDED 메모리 유지
 * AC-3: answerQuestion — 중복 탭 방지(answers dedup) + wrongAnswers UNIQUE 갱신
 */

function renderStore() {
  const { AppStoreProvider, useAppStore } = require("@/store/AppStore");
  return renderHook(() => useAppStore(), { wrapper: AppStoreProvider });
}

describe("AppStore(Context): 부트스트랩/복구 감지 + 오늘 세션 시작/답안 기록/완료 처리", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // AC-1: 부트스트랩 상태 (userProgress 로드 or needsRecoveryDialog)
  // ==========================================================================

  describe("AC-1: bootstrap", () => {
    it("AC-1[P0]: creates and exposes a default UserProgress on first bootstrap when none exists", () => {
      const { result } = renderStore();

      expect(result.current.needsRecoveryDialog).toBe(false);
      expect(result.current.userProgress).not.toBeNull();
      expect(result.current.userProgress?.iqTotal).toBe(0);
      expect(result.current.userProgress?.clientId).toBe(result.current.userProgress?.id);
    });

    it("AC-1[P0]: sets needsRecoveryDialog=true and userProgress=null when stored UserProgress JSON is corrupted", () => {
      localStorage.setItem(USER_PROGRESS_KEY, "{not-valid-json");

      const { result } = renderStore();

      expect(result.current.needsRecoveryDialog).toBe(true);
      expect(result.current.userProgress).toBeNull();
    });

    it("AC-1: loads an existing valid UserProgress from localStorage without flagging recovery", () => {
      const seeded = createDefaultUserProgress("퀴즈왕");
      saveUserProgress(seeded);

      const { result } = renderStore();

      expect(result.current.userProgress?.id).toBe(seeded.id);
      expect(result.current.userProgress?.nickname).toBe("퀴즈왕");
      expect(result.current.needsRecoveryDialog).toBe(false);
    });
  });

  // ==========================================================================
  // AC-2: startTodaySession
  // ==========================================================================

  describe("AC-2: startTodaySession", () => {
    it("AC-2[P0]: creates and persists a new session when none exists for today's (clientId,date,difficulty)", () => {
      const { result } = renderStore();
      const clientId = result.current.userProgress!.id;

      act(() => {
        result.current.startTodaySession("BEGINNER");
      });

      expect(result.current.currentSession).not.toBeNull();
      expect(result.current.currentSession?.difficulty).toBe("BEGINNER");
      expect(result.current.currentSession?.questionIds).toHaveLength(3);
      expect(result.current.currentSession?.clientId).toBe(clientId);

      const dateISO = getLocalDateISO();
      const uniqueKey = toDailySessionUniqueKey(clientId, dateISO, "BEGINNER");
      const stored = JSON.parse(localStorage.getItem(DAILY_SESSIONS_KEY) || "{}");

      expect(stored.byUniqueKey[uniqueKey]?.id).toBe(result.current.currentSession?.id);
    });

    it("AC-2[P0]: reuses the existing UNIQUE session instead of creating a new one", () => {
      const seeded = createDefaultUserProgress();
      saveUserProgress(seeded);

      const dateISO = getLocalDateISO();
      const uniqueKey = toDailySessionUniqueKey(seeded.id, dateISO, "BEGINNER");
      const existingSession = {
        id: "existing-session-fixed-id",
        sessionId: "existing-session-fixed-id",
        clientId: seeded.id,
        dateISO,
        difficulty: "BEGINNER" as const,
        questionIds: ["q_fixed_1", "q_fixed_2", "q_fixed_3"] as [string, string, string],
        answers: [],
        status: "IN_PROGRESS" as const,
        score: { correctCount: 0, iqDelta: 0 },
        startedAtISO: new Date().toISOString(),
        createdAtISO: new Date().toISOString(),
        updatedAtISO: new Date().toISOString(),
      };
      localStorage.setItem(
        DAILY_SESSIONS_KEY,
        JSON.stringify({ byUniqueKey: { [uniqueKey]: existingSession } })
      );

      const { result } = renderStore();

      act(() => {
        result.current.startTodaySession("BEGINNER");
      });

      expect(result.current.currentSession?.id).toBe("existing-session-fixed-id");
      expect(result.current.currentSession?.questionIds).toEqual([
        "q_fixed_1",
        "q_fixed_2",
        "q_fixed_3",
      ]);
    });

    it("AC-2[P1]: sets quotaExceededForSession=true and keeps the session memory-only when storage write fails", () => {
      const { result } = renderStore();

      const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation((key: string) => {
        if (key === DAILY_SESSIONS_KEY) {
          const err = new Error("QuotaExceededError");
          err.name = "QuotaExceededError";
          throw err;
        }
      });

      act(() => {
        result.current.startTodaySession("INTERMEDIATE");
      });

      expect(result.current.quotaExceededForSession).toBe(true);
      expect(result.current.currentSession?.difficulty).toBe("INTERMEDIATE");
      expect(localStorage.getItem(DAILY_SESSIONS_KEY)).toBeNull();

      spy.mockRestore();
    });
  });

  // ==========================================================================
  // AC-3: answerQuestion — dedup + wrongAnswers UNIQUE
  // ==========================================================================

  describe("AC-3: answerQuestion", () => {
    it("AC-3[P0]: records only one answer for the same questionId even when called twice", () => {
      const { result } = renderStore();
      act(() => {
        result.current.startTodaySession("BEGINNER");
      });

      const questionId = result.current.currentSession!.questionIds[0];

      act(() => {
        result.current.answerQuestion(questionId, 0);
      });
      act(() => {
        result.current.answerQuestion(questionId, 0);
      });

      expect(result.current.currentSession?.answers).toHaveLength(1);
      expect(result.current.currentSession?.answers[0].questionId).toBe(questionId);
    });

    it("AC-3[P0]: records a wrong answer in fvq_wrong_answers_v2 keyed by clientId:questionId and stays UNIQUE across duplicate taps", () => {
      const { result } = renderStore();
      act(() => {
        result.current.startTodaySession("BEGINNER");
      });

      const clientId = result.current.userProgress!.id;
      const questionId = result.current.currentSession!.questionIds[0];
      const bank = getQuizBankIndex();
      const question = bank.byId[questionId];
      const wrongIndex = ((question.correctIndex + 1) % 4) as 0 | 1 | 2 | 3;

      act(() => {
        result.current.answerQuestion(questionId, wrongIndex);
      });
      act(() => {
        result.current.answerQuestion(questionId, wrongIndex);
      });

      const uniqueKey = toWrongAnswerUniqueKey(clientId, questionId);
      const store = JSON.parse(localStorage.getItem(WRONG_ANSWERS_KEY) || "{}");
      const item = store.byUniqueKey[uniqueKey];

      expect(item).toBeDefined();
      expect(item.clientId).toBe(clientId);
      expect(item.wrongCount).toBe(1);
      expect(Object.keys(store.byUniqueKey)).toHaveLength(1);
      expect(result.current.currentSession?.answers).toHaveLength(1);
    });
  });
});
