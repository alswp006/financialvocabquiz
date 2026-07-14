import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Packet 0003: localStorage v2 저장소
 * safeStorage + CRUD(DailySessions, WrongAnswers, LeaderboardCache)
 *
 * AC-1: safeGetJSON/safeSetJSON/safeRemove distinguish errors (CORRUPTED vs QUOTA_EXCEEDED)
 * AC-2: DailySessions enforce UNIQUE(clientId, dateISO, difficulty)
 * AC-3: WrongAnswers enforce UNIQUE(clientId, questionId) + 200-item eviction
 */

// ============================================================================
// Types (from spec)
// ============================================================================

type ISODateTimeString = string;
type ISODateString = string;
type Difficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

interface DailyQuizSession {
  id: string;
  sessionId: string;
  clientId: string;
  dateISO: ISODateString;
  difficulty: Difficulty;
  questionIds: [string, string, string];
  answers: Array<{ questionId: string; selectedIndex: number; isCorrect: boolean }>;
  startedAtISO: ISODateTimeString;
  status: "IN_PROGRESS" | "COMPLETED";
  completedAtISO?: ISODateTimeString;
  score: { correctCount: number; iqDelta: number };
  createdAtISO: ISODateTimeString;
  updatedAtISO: ISODateTimeString;
}

interface WrongAnswerItem {
  id: string;
  clientId: string;
  questionId: string;
  firstWrongAtISO: ISODateTimeString;
  lastWrongAtISO: ISODateTimeString;
  wrongCount: number;
  lastSelectedIndex: number;
  difficulty: Difficulty;
  createdAtISO: ISODateTimeString;
  updatedAtISO: ISODateTimeString;
}

interface UserProgress {
  id: string;
  clientId: string;
  nickname: string;
  iqTotal: number;
  streak: {
    current: number;
    best: number;
    lastCompletedDateISO?: string;
  };
  aiDisclosureAccepted: boolean;
  createdAtISO: ISODateTimeString;
  updatedAtISO: ISODateTimeString;
}

type DailySessionUniqueKey = `${string}:${ISODateString}:${Difficulty}`;
type WrongAnswerUniqueKey = `${string}:${string}`;

// ============================================================================
// AC-1: safeStorage — Error Handling (CORRUPTED vs QUOTA_EXCEEDED)
// ============================================================================

describe("AC-1: safeStorage error handling", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("safeGetJSON returns {ok:false,error:'CORRUPTED'} when JSON is malformed", () => {
    // Not yet implemented, but this is what the test expects
    const { safeGetJSON } = require("@/lib/storage/safeStorage");

    localStorage.setItem("test-key", "{invalid json");
    const result = safeGetJSON("test-key");

    expect(result.ok).toBe(false);
    expect(result.error).toBe("CORRUPTED");
  });

  it("safeGetJSON returns {ok:true,data:parsed} when JSON is valid", () => {
    const { safeGetJSON } = require("@/lib/storage/safeStorage");

    const testData = { foo: "bar", num: 42 };
    localStorage.setItem("test-key", JSON.stringify(testData));

    const result = safeGetJSON("test-key");

    expect(result.ok).toBe(true);
    expect(result.data).toEqual(testData);
  });

  it("safeGetJSON returns {ok:true,data:null} when key does not exist", () => {
    const { safeGetJSON } = require("@/lib/storage/safeStorage");

    const result = safeGetJSON("nonexistent-key");

    expect(result.ok).toBe(true);
    expect(result.data).toBeNull();
  });

  it("safeSetJSON returns {ok:false,error:'QUOTA_EXCEEDED'} when storage quota is exceeded", () => {
    const { safeSetJSON } = require("@/lib/storage/safeStorage");

    // Mock localStorage.setItem to throw QuotaExceededError
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = vi.fn(() => {
      const err = new Error("QuotaExceededError");
      err.name = "QuotaExceededError";
      throw err;
    });

    const result = safeSetJSON("test-key", { data: "test" });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("QUOTA_EXCEEDED");

    localStorage.setItem = originalSetItem;
  });

  it("safeSetJSON returns {ok:true} on successful write", () => {
    const { safeSetJSON } = require("@/lib/storage/safeStorage");

    const testData = { id: "123", name: "Test" };
    const result = safeSetJSON("test-key", testData);

    expect(result.ok).toBe(true);
    expect(localStorage.getItem("test-key")).toBe(JSON.stringify(testData));
  });

  it("safeRemove does not throw and returns {ok:true} when key exists", () => {
    const { safeRemove } = require("@/lib/storage/safeStorage");

    localStorage.setItem("test-key", "some value");
    const result = safeRemove("test-key");

    expect(result.ok).toBe(true);
    expect(localStorage.getItem("test-key")).toBeNull();
  });

  it("safeRemove does not throw and returns {ok:true} when key does not exist", () => {
    const { safeRemove } = require("@/lib/storage/safeStorage");

    const result = safeRemove("nonexistent-key");

    expect(result.ok).toBe(true);
  });
});

// ============================================================================
// AC-2: DailySessions — UNIQUE(clientId, dateISO, difficulty) via byUniqueKey
// ============================================================================

describe("AC-2: DailySessions UNIQUE constraint and lookups", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should save and retrieve session by uniqueKey (clientId:dateISO:difficulty)", () => {
    const { saveDailySession, getDailySessionByKey } = require("@/lib/storage/dailySessions");

    const clientId = "user-uuid-1";
    const dateISO = "2026-07-14";
    const difficulty: Difficulty = "BEGINNER";

    const session: DailyQuizSession = {
      id: "session-001",
      sessionId: "session-001",
      clientId,
      dateISO,
      difficulty,
      questionIds: ["q1", "q2", "q3"],
      answers: [],
      startedAtISO: new Date().toISOString(),
      status: "IN_PROGRESS",
      score: { correctCount: 0, iqDelta: 0 },
      createdAtISO: new Date().toISOString(),
      updatedAtISO: new Date().toISOString(),
    };

    saveDailySession(session);

    const uniqueKey: DailySessionUniqueKey = `${clientId}:${dateISO}:${difficulty}`;
    const retrieved = getDailySessionByKey(uniqueKey);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe("session-001");
    expect(retrieved?.sessionId).toBe("session-001");
  });

  it("should enforce UNIQUE by replacing session with same key", () => {
    const { saveDailySession, getDailySessionByKey } = require("@/lib/storage/dailySessions");

    const clientId = "user-uuid-2";
    const dateISO = "2026-07-14";
    const difficulty: Difficulty = "INTERMEDIATE";
    const uniqueKey: DailySessionUniqueKey = `${clientId}:${dateISO}:${difficulty}`;

    // Save first session
    const session1: DailyQuizSession = {
      id: "session-first",
      sessionId: "session-first",
      clientId,
      dateISO,
      difficulty,
      questionIds: ["q1", "q2", "q3"],
      answers: [],
      startedAtISO: new Date().toISOString(),
      status: "IN_PROGRESS",
      score: { correctCount: 0, iqDelta: 0 },
      createdAtISO: new Date().toISOString(),
      updatedAtISO: new Date().toISOString(),
    };
    saveDailySession(session1);

    // Save second session with same key (should replace)
    const session2: DailyQuizSession = {
      id: "session-second",
      sessionId: "session-second",
      clientId,
      dateISO,
      difficulty,
      questionIds: ["qx", "qy", "qz"],
      answers: [],
      startedAtISO: new Date().toISOString(),
      status: "IN_PROGRESS",
      score: { correctCount: 0, iqDelta: 0 },
      createdAtISO: new Date().toISOString(),
      updatedAtISO: new Date().toISOString(),
    };
    saveDailySession(session2);

    const retrieved = getDailySessionByKey(uniqueKey);

    expect(retrieved?.id).toBe("session-second");
    expect(retrieved?.questionIds[0]).toBe("qx");
  });

  it("findSessionBySessionId should scan and return null if not found", () => {
    const { findSessionBySessionId } = require("@/lib/storage/dailySessions");

    const result = findSessionBySessionId("nonexistent-session-id");

    expect(result).toBeNull();
  });

  it("findSessionBySessionId should scan and return session if found", () => {
    const { saveDailySession, findSessionBySessionId } = require("@/lib/storage/dailySessions");

    const session: DailyQuizSession = {
      id: "target-session-123",
      sessionId: "target-session-123",
      clientId: "user-1",
      dateISO: "2026-07-14",
      difficulty: "ADVANCED",
      questionIds: ["q1", "q2", "q3"],
      answers: [],
      startedAtISO: new Date().toISOString(),
      status: "IN_PROGRESS",
      score: { correctCount: 0, iqDelta: 0 },
      createdAtISO: new Date().toISOString(),
      updatedAtISO: new Date().toISOString(),
    };

    saveDailySession(session);

    const retrieved = findSessionBySessionId("target-session-123");

    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe("target-session-123");
  });

  it("should support CASCADE delete of all sessions when user is reset", () => {
    const { saveDailySession, deleteAllSessions } = require("@/lib/storage/dailySessions");

    // Save multiple sessions
    const sessions: DailyQuizSession[] = [
      {
        id: "s1",
        sessionId: "s1",
        clientId: "user-1",
        dateISO: "2026-07-14",
        difficulty: "BEGINNER" as Difficulty,
        questionIds: ["q1", "q2", "q3"] as [string, string, string],
        answers: [],
        startedAtISO: new Date().toISOString(),
        status: "IN_PROGRESS" as const,
        score: { correctCount: 0, iqDelta: 0 },
        createdAtISO: new Date().toISOString(),
        updatedAtISO: new Date().toISOString(),
      },
      {
        id: "s2",
        sessionId: "s2",
        clientId: "user-2",
        dateISO: "2026-07-14",
        difficulty: "INTERMEDIATE" as Difficulty,
        questionIds: ["q4", "q5", "q6"] as [string, string, string],
        answers: [],
        startedAtISO: new Date().toISOString(),
        status: "IN_PROGRESS" as const,
        score: { correctCount: 0, iqDelta: 0 },
        createdAtISO: new Date().toISOString(),
        updatedAtISO: new Date().toISOString(),
      },
    ];

    sessions.forEach((s) => saveDailySession(s));

    deleteAllSessions();

    const store = JSON.parse(localStorage.getItem("fvq_daily_sessions_v2") || "{}");
    expect(Object.keys(store.byUniqueKey || {})).toHaveLength(0);
  });
});

// ============================================================================
// AC-3: WrongAnswers — UNIQUE(clientId, questionId) + 200-item eviction
// ============================================================================

describe("AC-3: WrongAnswers UNIQUE constraint and eviction", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should save wrong answer and enforce UNIQUE by replacing with same key", () => {
    const { saveWrongAnswer, getWrongAnswer } = require("@/lib/storage/wrongAnswers");

    const clientId = "user-uuid-1";
    const questionId = "q_0001";

    const wrongAnswer1: WrongAnswerItem = {
      id: "wa-first",
      clientId,
      questionId,
      firstWrongAtISO: "2026-07-14T10:00:00.000Z",
      lastWrongAtISO: "2026-07-14T10:00:00.000Z",
      wrongCount: 1,
      lastSelectedIndex: 0,
      difficulty: "BEGINNER",
      createdAtISO: "2026-07-14T10:00:00.000Z",
      updatedAtISO: "2026-07-14T10:00:00.000Z",
    };

    saveWrongAnswer(wrongAnswer1);

    const uniqueKey: WrongAnswerUniqueKey = `${clientId}:${questionId}`;
    let retrieved = getWrongAnswer(uniqueKey);

    expect(retrieved?.id).toBe("wa-first");
    expect(retrieved?.wrongCount).toBe(1);

    // Save again with same key (should replace)
    const wrongAnswer2: WrongAnswerItem = {
      ...wrongAnswer1,
      id: "wa-second",
      wrongCount: 2,
      lastWrongAtISO: "2026-07-14T11:00:00.000Z",
      updatedAtISO: "2026-07-14T11:00:00.000Z",
    };

    saveWrongAnswer(wrongAnswer2);

    retrieved = getWrongAnswer(uniqueKey);

    expect(retrieved?.id).toBe("wa-second");
    expect(retrieved?.wrongCount).toBe(2);
  });

  it("should return null for non-existent wrong answer", () => {
    const { getWrongAnswer } = require("@/lib/storage/wrongAnswers");

    const uniqueKey: WrongAnswerUniqueKey = "user-1:q_9999";
    const result = getWrongAnswer(uniqueKey);

    expect(result).toBeNull();
  });

  it("should evict oldest by lastWrongAtISO when exceeding 200 items", () => {
    const { saveWrongAnswer, getAllWrongAnswers } = require("@/lib/storage/wrongAnswers");

    const clientId = "user-bulk";
    const baseTime = new Date("2026-07-14T00:00:00.000Z").getTime();

    // Create 201 wrong answer items
    for (let i = 0; i < 201; i++) {
      const wrongAnswer: WrongAnswerItem = {
        id: `wa-${i}`,
        clientId,
        questionId: `q_${String(i).padStart(4, "0")}`,
        firstWrongAtISO: new Date(baseTime + i * 1000).toISOString(),
        lastWrongAtISO: new Date(baseTime + i * 1000).toISOString(),
        wrongCount: 1,
        lastSelectedIndex: 0,
        difficulty: "BEGINNER",
        createdAtISO: new Date(baseTime + i * 1000).toISOString(),
        updatedAtISO: new Date(baseTime + i * 1000).toISOString(),
      };

      saveWrongAnswer(wrongAnswer);
    }

    const all = getAllWrongAnswers(clientId);

    expect(all.length).toBeLessThanOrEqual(200);
    expect(all.length).toBe(200);

    // Verify oldest (q_0000) was evicted
    const oldestExists = all.some((wa: WrongAnswerItem) => wa.questionId === "q_0000");
    expect(oldestExists).toBe(false);

    // Verify newest (q_0200) was kept
    const newestExists = all.some((wa: WrongAnswerItem) => wa.questionId === "q_0200");
    expect(newestExists).toBe(true);
  });

  it("should support CASCADE delete of all wrong answers when user is reset", () => {
    const { saveWrongAnswer, deleteAllWrongAnswers } = require("@/lib/storage/wrongAnswers");

    const wrongAnswer: WrongAnswerItem = {
      id: "wa-1",
      clientId: "user-1",
      questionId: "q_0001",
      firstWrongAtISO: "2026-07-14T10:00:00.000Z",
      lastWrongAtISO: "2026-07-14T10:00:00.000Z",
      wrongCount: 1,
      lastSelectedIndex: 0,
      difficulty: "BEGINNER",
      createdAtISO: "2026-07-14T10:00:00.000Z",
      updatedAtISO: "2026-07-14T10:00:00.000Z",
    };

    saveWrongAnswer(wrongAnswer);

    deleteAllWrongAnswers();

    const store = JSON.parse(localStorage.getItem("fvq_wrong_answers_v2") || "{}");
    expect(Object.keys(store.byUniqueKey || {})).toHaveLength(0);
  });

  it("should retrieve all wrong answers for a specific clientId", () => {
    const { saveWrongAnswer, getAllWrongAnswers } = require("@/lib/storage/wrongAnswers");

    const clientId1 = "user-a";
    const clientId2 = "user-b";

    const wa1: WrongAnswerItem = {
      id: "wa-1",
      clientId: clientId1,
      questionId: "q_0001",
      firstWrongAtISO: "2026-07-14T10:00:00.000Z",
      lastWrongAtISO: "2026-07-14T10:00:00.000Z",
      wrongCount: 1,
      lastSelectedIndex: 0,
      difficulty: "BEGINNER",
      createdAtISO: "2026-07-14T10:00:00.000Z",
      updatedAtISO: "2026-07-14T10:00:00.000Z",
    };

    const wa2: WrongAnswerItem = {
      id: "wa-2",
      clientId: clientId1,
      questionId: "q_0002",
      firstWrongAtISO: "2026-07-14T11:00:00.000Z",
      lastWrongAtISO: "2026-07-14T11:00:00.000Z",
      wrongCount: 2,
      lastSelectedIndex: 1,
      difficulty: "INTERMEDIATE",
      createdAtISO: "2026-07-14T11:00:00.000Z",
      updatedAtISO: "2026-07-14T11:00:00.000Z",
    };

    const wa3: WrongAnswerItem = {
      id: "wa-3",
      clientId: clientId2,
      questionId: "q_0001",
      firstWrongAtISO: "2026-07-14T12:00:00.000Z",
      lastWrongAtISO: "2026-07-14T12:00:00.000Z",
      wrongCount: 1,
      lastSelectedIndex: 2,
      difficulty: "ADVANCED",
      createdAtISO: "2026-07-14T12:00:00.000Z",
      updatedAtISO: "2026-07-14T12:00:00.000Z",
    };

    saveWrongAnswer(wa1);
    saveWrongAnswer(wa2);
    saveWrongAnswer(wa3);

    const user1Items = getAllWrongAnswers(clientId1);
    const user2Items = getAllWrongAnswers(clientId2);

    expect(user1Items).toHaveLength(2);
    expect(user1Items[0].questionId).toMatch(/q_0001|q_0002/);
    expect(user2Items).toHaveLength(1);
    expect(user2Items[0].clientId).toBe(clientId2);
  });
});

// ============================================================================
// AC-BONUS: UserProgress reset cascades to dependent stores
// ============================================================================

describe("Cascade delete on UserProgress reset", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should cascade delete daily sessions and wrong answers when user is reset", () => {
    const { saveDailySession } = require("@/lib/storage/dailySessions");
    const { saveWrongAnswer } = require("@/lib/storage/wrongAnswers");
    const { resetUserProgress } = require("@/lib/storage/userProgress");

    const clientId = "user-to-reset";

    // Save related data
    const session: DailyQuizSession = {
      id: "s1",
      sessionId: "s1",
      clientId,
      dateISO: "2026-07-14",
      difficulty: "BEGINNER",
      questionIds: ["q1", "q2", "q3"],
      answers: [],
      startedAtISO: new Date().toISOString(),
      status: "IN_PROGRESS",
      score: { correctCount: 0, iqDelta: 0 },
      createdAtISO: new Date().toISOString(),
      updatedAtISO: new Date().toISOString(),
    };

    const wrongAnswer: WrongAnswerItem = {
      id: "wa1",
      clientId,
      questionId: "q_0001",
      firstWrongAtISO: new Date().toISOString(),
      lastWrongAtISO: new Date().toISOString(),
      wrongCount: 1,
      lastSelectedIndex: 0,
      difficulty: "BEGINNER",
      createdAtISO: new Date().toISOString(),
      updatedAtISO: new Date().toISOString(),
    };

    saveDailySession(session);
    saveWrongAnswer(wrongAnswer);

    // Reset user
    resetUserProgress();

    // Verify cascades
    const sessionsStore = JSON.parse(localStorage.getItem("fvq_daily_sessions_v2") || "{}");
    const wrongAnswersStore = JSON.parse(localStorage.getItem("fvq_wrong_answers_v2") || "{}");

    expect(Object.keys(sessionsStore.byUniqueKey || {})).toHaveLength(0);
    expect(Object.keys(wrongAnswersStore.byUniqueKey || {})).toHaveLength(0);
  });
});
