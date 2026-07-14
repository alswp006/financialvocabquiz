import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import type {
  Difficulty,
  DailyQuizSession,
  DailyQuizSessionStoreV2,
  UserProgress,
  WrongAnswerItem,
} from "@/lib/types";
import { createId } from "@/lib/id";
import { nowISO, getLocalDateISO } from "@/lib/time";
import { safeGetJSON, safeSetJSON } from "@/lib/storage/safeStorage";
import {
  USER_PROGRESS_KEY,
  createDefaultUserProgress,
  saveUserProgress,
} from "@/lib/storage/userProgress";
import {
  DAILY_SESSIONS_KEY,
  toDailySessionUniqueKey,
  getDailySessionByKey,
} from "@/lib/storage/dailySessions";
import {
  toWrongAnswerUniqueKey,
  getWrongAnswer,
  saveWrongAnswer,
} from "@/lib/storage/wrongAnswers";
import { createDailyQuizSession } from "@/lib/quiz/sessionFactory";
import { getQuizBankIndex } from "@/lib/quizBank/index";

interface AppStoreState {
  userProgress: UserProgress | null;
  needsRecoveryDialog: boolean;
  currentSession: DailyQuizSession | null;
  quotaExceededForSession: boolean;
}

interface AppStoreValue extends AppStoreState {
  startTodaySession: (difficulty: Difficulty) => void;
  answerQuestion: (questionId: string, selectedIndex: 0 | 1 | 2 | 3) => void;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

function bootstrap(): AppStoreState {
  const result = safeGetJSON<UserProgress>(USER_PROGRESS_KEY);

  if (!result.ok) {
    return {
      userProgress: null,
      needsRecoveryDialog: true,
      currentSession: null,
      quotaExceededForSession: false,
    };
  }

  if (result.data === null) {
    const fresh = createDefaultUserProgress();
    saveUserProgress(fresh);
    return {
      userProgress: fresh,
      needsRecoveryDialog: false,
      currentSession: null,
      quotaExceededForSession: false,
    };
  }

  return {
    userProgress: result.data,
    needsRecoveryDialog: false,
    currentSession: null,
    quotaExceededForSession: false,
  };
}

function persistDailySession(session: DailyQuizSession): boolean {
  const existing = safeGetJSON<DailyQuizSessionStoreV2>(DAILY_SESSIONS_KEY);
  const store: DailyQuizSessionStoreV2 =
    existing.ok && existing.data ? existing.data : { byUniqueKey: {} };
  const uniqueKey = toDailySessionUniqueKey(
    session.clientId,
    session.dateISO,
    session.difficulty
  );
  store.byUniqueKey[uniqueKey] = session;
  return safeSetJSON(DAILY_SESSIONS_KEY, store).ok;
}

function recordWrongAnswer(
  clientId: string,
  questionId: string,
  selectedIndex: 0 | 1 | 2 | 3,
  difficulty: Difficulty,
  now: string
): void {
  const uniqueKey = toWrongAnswerUniqueKey(clientId, questionId);
  const existing = getWrongAnswer(uniqueKey);

  const item: WrongAnswerItem = existing
    ? {
        ...existing,
        lastWrongAtISO: now,
        wrongCount: existing.wrongCount + 1,
        lastSelectedIndex: selectedIndex,
        updatedAtISO: now,
      }
    : {
        id: createId("wrong"),
        clientId,
        questionId,
        firstWrongAtISO: now,
        lastWrongAtISO: now,
        wrongCount: 1,
        lastSelectedIndex: selectedIndex,
        difficulty,
        createdAtISO: now,
        updatedAtISO: now,
      };

  saveWrongAnswer(item);
}

function isConsecutiveDay(prevDateISO: string, dateISO: string): boolean {
  const prev = new Date(`${prevDateISO}T00:00:00`);
  const curr = new Date(`${dateISO}T00:00:00`);
  const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86_400_000);
  return diffDays === 1;
}

function applyCompletion(
  progress: UserProgress,
  dateISO: string,
  iqDelta: number,
  now: string
): UserProgress {
  const { streak } = progress;
  let current: number;
  if (streak.lastCompletedDateISO === dateISO) {
    current = streak.current;
  } else if (streak.lastCompletedDateISO && isConsecutiveDay(streak.lastCompletedDateISO, dateISO)) {
    current = streak.current + 1;
  } else {
    current = 1;
  }

  return {
    ...progress,
    iqTotal: progress.iqTotal + iqDelta,
    streak: { current, best: Math.max(streak.best, current), lastCompletedDateISO: dateISO },
    updatedAtISO: now,
  };
}

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppStoreState>(bootstrap);

  const startTodaySession = useCallback((difficulty: Difficulty) => {
    setState((prev) => {
      if (!prev.userProgress) return prev;

      const clientId = prev.userProgress.id;
      const dateISO = getLocalDateISO();
      const uniqueKey = toDailySessionUniqueKey(clientId, dateISO, difficulty);
      const existing = getDailySessionByKey(uniqueKey);

      if (existing) {
        return { ...prev, currentSession: existing, quotaExceededForSession: false };
      }

      const session = createDailyQuizSession(clientId, dateISO, difficulty);
      const persisted = persistDailySession(session);

      return {
        ...prev,
        currentSession: session,
        quotaExceededForSession: !persisted,
      };
    });
  }, []);

  const answerQuestion = useCallback((questionId: string, selectedIndex: 0 | 1 | 2 | 3) => {
    setState((prev) => {
      const { currentSession, userProgress } = prev;
      if (!currentSession || !userProgress) return prev;
      if (currentSession.answers.some((a) => a.questionId === questionId)) {
        return prev;
      }

      const bank = getQuizBankIndex();
      const question = bank.byId[questionId];
      const isCorrect = question ? selectedIndex === question.correctIndex : false;
      const now = nowISO();

      const answers = [
        ...currentSession.answers,
        { questionId, selectedIndex, isCorrect },
      ];
      const correctCount = answers.filter((a) => a.isCorrect).length as 0 | 1 | 2 | 3;

      if (!isCorrect) {
        recordWrongAnswer(userProgress.id, questionId, selectedIndex, currentSession.difficulty, now);
      }

      let nextUserProgress = userProgress;
      let updatedSession: DailyQuizSession = {
        ...currentSession,
        answers,
        score: { correctCount, iqDelta: currentSession.score.iqDelta },
        updatedAtISO: now,
      };

      if (answers.length === 3) {
        const iqDelta = correctCount * 10 + 5;
        updatedSession = {
          ...updatedSession,
          status: "COMPLETED",
          completedAtISO: now,
          score: { correctCount, iqDelta },
        };
        nextUserProgress = applyCompletion(userProgress, currentSession.dateISO, iqDelta, now);
        saveUserProgress(nextUserProgress);
      }

      const persisted = persistDailySession(updatedSession);

      return {
        ...prev,
        currentSession: updatedSession,
        userProgress: nextUserProgress,
        quotaExceededForSession: prev.quotaExceededForSession || !persisted,
      };
    });
  }, []);

  const value = useMemo<AppStoreValue>(
    () => ({ ...state, startTodaySession, answerQuestion }),
    [state, startTodaySession, answerQuestion]
  );

  return React.createElement(AppStoreContext.Provider, { value }, children);
}

export function useAppStore(): AppStoreValue {
  const ctx = useContext(AppStoreContext);
  if (!ctx) {
    throw new Error("useAppStore must be used within an AppStoreProvider");
  }
  return ctx;
}
