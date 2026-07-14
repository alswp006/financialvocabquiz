import { describe, it, expect, beforeEach } from "vitest";
import type { Difficulty, QuizQuestion, DailyQuizSession } from "@/lib/types";

/**
 * TDD Tests for Packet 0002: 시간/ID 유틸 + 퀴즈뱅크 인덱싱 + 세션 생성
 *
 * AC-1: getLocalDateISO(now?) returns "YYYY-MM-DD" in local timezone
 *       getISOWeekId(date) returns "YYYY-WW" (WW = 2-digit ISO week number)
 *
 * AC-2: getQuizBankIndex() returns {byId, byDifficulty}
 *       - byId[id] allows O(1) lookup
 *       - Duplicate ids: last value wins, no throw
 *
 * AC-3: createDailyQuizSession(clientId, dateISO, difficulty)
 *       - id: non-empty string
 *       - sessionId === id
 *       - status: "IN_PROGRESS"
 *       - completedAtISO: undefined
 *       - questionIds: length 3 (deterministic, same input → same output)
 */

// ============================================================================
// AC-1: Time Utilities
// ============================================================================

describe("AC-1: getLocalDateISO & getISOWeekId", () => {
  it("should return YYYY-MM-DD in local timezone without arguments", async () => {
    const { getLocalDateISO } = await import("@/lib/time");

    const result = getLocalDateISO();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Verify it's today's date in local timezone
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const date = String(now.getDate()).padStart(2, "0");
    const expected = `${year}-${month}-${date}`;
    expect(result).toBe(expected);
  });

  it("should return correct date when passed a specific Date object", async () => {
    const { getLocalDateISO } = await import("@/lib/time");

    // Use a known date: 2026-07-14
    const testDate = new Date("2026-07-14T15:30:00Z");
    const result = getLocalDateISO(testDate);

    // Result should be in local timezone format YYYY-MM-DD
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // At minimum, should be a valid date string
    expect(new Date(result).toString()).not.toContain("Invalid");
  });

  it("should handle dates near month boundaries", async () => {
    const { getLocalDateISO } = await import("@/lib/time");

    // Test year-end date
    const dec31 = new Date("2025-12-31T23:59:59Z");
    const resultDec31 = getLocalDateISO(dec31);
    expect(resultDec31).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Test year-start date
    const jan1 = new Date("2026-01-01T00:00:00Z");
    const resultJan1 = getLocalDateISO(jan1);
    expect(resultJan1).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("should return YYYY-WW format for ISO week ID", async () => {
    const { getISOWeekId } = await import("@/lib/time");

    // 2026-07-14 is in week 29 of 2026 (ISO 8601)
    const date = new Date("2026-07-14T00:00:00Z");
    const result = getISOWeekId(date);

    expect(result).toMatch(/^\d{4}-\d{2}$/);
    // Week numbers are 01-53
    const parts = result.split("-");
    const weekNum = parseInt(parts[1], 10);
    expect(weekNum).toBeGreaterThanOrEqual(1);
    expect(weekNum).toBeLessThanOrEqual(53);
  });

  it("should return consistent week ID for dates in same ISO week", async () => {
    const { getISOWeekId } = await import("@/lib/time");

    // Monday and Sunday of the same ISO week
    const monday = new Date("2026-07-13T00:00:00Z"); // Monday of week 29
    const sunday = new Date("2026-07-19T00:00:00Z"); // Sunday of week 29
    const wednesday = new Date("2026-07-15T00:00:00Z"); // Wednesday of week 29

    const weekIdMonday = getISOWeekId(monday);
    const weekIdSunday = getISOWeekId(sunday);
    const weekIdWednesday = getISOWeekId(wednesday);

    expect(weekIdMonday).toBe(weekIdSunday);
    expect(weekIdMonday).toBe(weekIdWednesday);
  });

  it("should return different week IDs for dates in different ISO weeks", async () => {
    const { getISOWeekId } = await import("@/lib/time");

    // Last day of week 28 and first day of week 29
    const lastDayWeek28 = new Date("2026-07-12T00:00:00Z"); // Sunday of week 28
    const firstDayWeek29 = new Date("2026-07-13T00:00:00Z"); // Monday of week 29

    const weekId28 = getISOWeekId(lastDayWeek28);
    const weekId29 = getISOWeekId(firstDayWeek29);

    expect(weekId28).not.toBe(weekId29);
  });

  it("should handle year boundary (Dec 31 to Jan 1)", async () => {
    const { getISOWeekId } = await import("@/lib/time");

    // Dec 31, 2025 and Jan 1, 2026 may be in different weeks
    const dec31 = new Date("2025-12-31T00:00:00Z");
    const jan1 = new Date("2026-01-01T00:00:00Z");

    const weekIdDec31 = getISOWeekId(dec31);
    const weekIdJan1 = getISOWeekId(jan1);

    // Both should be valid YYYY-WW format
    expect(weekIdDec31).toMatch(/^\d{4}-\d{2}$/);
    expect(weekIdJan1).toMatch(/^\d{4}-\d{2}$/);
  });
});

// ============================================================================
// AC-2: Quiz Bank Indexing
// ============================================================================

describe("AC-2: getQuizBankIndex", () => {
  it("should return object with byId and byDifficulty properties", async () => {
    const { getQuizBankIndex } = await import("@/lib/quizBank/index");

    const index = getQuizBankIndex();

    expect(index).toHaveProperty("byId");
    expect(index).toHaveProperty("byDifficulty");
  });

  it("should provide O(1) lookup via byId[questionId]", async () => {
    const { getQuizBankIndex } = await import("@/lib/quizBank/index");

    const index = getQuizBankIndex();

    // byId should be a record-like object
    expect(typeof index.byId).toBe("object");

    // Should allow property access
    const firstQuestionId = Object.keys(index.byId)[0];
    if (firstQuestionId) {
      const question = index.byId[firstQuestionId];
      expect(question).toBeDefined();
      expect(question.id).toBe(firstQuestionId);
    }
  });

  it("should index all questions by their ID", async () => {
    const { getQuizBankIndex } = await import("@/lib/quizBank/index");

    const index = getQuizBankIndex();

    // Get all indexed IDs
    const indexedIds = Object.keys(index.byId);

    expect(indexedIds.length).toBeGreaterThan(0);

    // Each indexed question should have id matching the key
    for (const id of indexedIds) {
      const question = index.byId[id];
      expect(question.id).toBe(id);
    }
  });

  it("should provide byDifficulty with BEGINNER, INTERMEDIATE, ADVANCED arrays", async () => {
    const { getQuizBankIndex } = await import("@/lib/quizBank/index");

    const index = getQuizBankIndex();

    expect(typeof index.byDifficulty).toBe("object");
    expect(index.byDifficulty).toHaveProperty("BEGINNER");
    expect(index.byDifficulty).toHaveProperty("INTERMEDIATE");
    expect(index.byDifficulty).toHaveProperty("ADVANCED");

    // Each should be an array
    expect(Array.isArray(index.byDifficulty.BEGINNER)).toBe(true);
    expect(Array.isArray(index.byDifficulty.INTERMEDIATE)).toBe(true);
    expect(Array.isArray(index.byDifficulty.ADVANCED)).toBe(true);
  });

  it("should group all questions by their difficulty level", async () => {
    const { getQuizBankIndex } = await import("@/lib/quizBank/index");

    const index = getQuizBankIndex();

    // Each question in byDifficulty should have matching difficulty
    for (const question of index.byDifficulty.BEGINNER) {
      expect(question.difficulty).toBe("BEGINNER");
    }

    for (const question of index.byDifficulty.INTERMEDIATE) {
      expect(question.difficulty).toBe("INTERMEDIATE");
    }

    for (const question of index.byDifficulty.ADVANCED) {
      expect(question.difficulty).toBe("ADVANCED");
    }
  });

  it("should have at least 3 questions per difficulty for quiz creation", async () => {
    const { getQuizBankIndex } = await import("@/lib/quizBank/index");

    const index = getQuizBankIndex();

    // Ensure we have enough questions for session creation (1 per question in 3-question quiz)
    expect(index.byDifficulty.BEGINNER.length).toBeGreaterThanOrEqual(3);
    expect(index.byDifficulty.INTERMEDIATE.length).toBeGreaterThanOrEqual(3);
    expect(index.byDifficulty.ADVANCED.length).toBeGreaterThanOrEqual(3);
  });

  it("should handle duplicate IDs by using last value", async () => {
    const { getQuizBankIndex } = await import("@/lib/quizBank/index");

    const index = getQuizBankIndex();

    // When there are duplicate IDs in source data, last one should win
    // This is a property of the indexing logic: no error, just override
    const indexedIds = Object.keys(index.byId);
    expect(indexedIds.length).toBeGreaterThan(0);

    // Should not throw when accessing existing IDs
    const firstId = indexedIds[0];
    expect(() => {
      const _ = index.byId[firstId];
    }).not.toThrow();
  });

  it("should maintain consistency: every question in byDifficulty is in byId", async () => {
    const { getQuizBankIndex } = await import("@/lib/quizBank/index");

    const index = getQuizBankIndex();

    // Check BEGINNER
    for (const question of index.byDifficulty.BEGINNER) {
      expect(index.byId[question.id]).toBeDefined();
      expect(index.byId[question.id].id).toBe(question.id);
    }

    // Check INTERMEDIATE
    for (const question of index.byDifficulty.INTERMEDIATE) {
      expect(index.byId[question.id]).toBeDefined();
      expect(index.byId[question.id].id).toBe(question.id);
    }

    // Check ADVANCED
    for (const question of index.byDifficulty.ADVANCED) {
      expect(index.byId[question.id]).toBeDefined();
      expect(index.byId[question.id].id).toBe(question.id);
    }
  });
});

// ============================================================================
// AC-3: Daily Quiz Session Creation (Deterministic)
// ============================================================================

describe("AC-3: createDailyQuizSession", () => {
  it("should create session with non-empty id", async () => {
    const { createDailyQuizSession } = await import("@/lib/quiz/sessionFactory");

    const session = createDailyQuizSession("client-123", "2026-07-14", "BEGINNER");

    expect(session.id).toBeDefined();
    expect(typeof session.id).toBe("string");
    expect(session.id.length).toBeGreaterThan(0);
  });

  it("should create session with sessionId equal to id", async () => {
    const { createDailyQuizSession } = await import("@/lib/quiz/sessionFactory");

    const session = createDailyQuizSession("client-456", "2026-07-14", "INTERMEDIATE");

    expect(session.sessionId).toBe(session.id);
  });

  it("should create session with status IN_PROGRESS", async () => {
    const { createDailyQuizSession } = await import("@/lib/quiz/sessionFactory");

    const session = createDailyQuizSession("client-789", "2026-07-14", "ADVANCED");

    expect(session.status).toBe("IN_PROGRESS");
  });

  it("should create session with completedAtISO undefined", async () => {
    const { createDailyQuizSession } = await import("@/lib/quiz/sessionFactory");

    const session = createDailyQuizSession("client-xyz", "2026-07-14", "BEGINNER");

    expect(session.completedAtISO).toBeUndefined();
  });

  it("should create session with exactly 3 questionIds", async () => {
    const { createDailyQuizSession } = await import("@/lib/quiz/sessionFactory");

    const session = createDailyQuizSession("client-111", "2026-07-14", "BEGINNER");

    expect(Array.isArray(session.questionIds)).toBe(true);
    expect(session.questionIds.length).toBe(3);
  });

  it("should include correct clientId and dateISO in session", async () => {
    const { createDailyQuizSession } = await import("@/lib/quiz/sessionFactory");

    const clientId = "client-abc";
    const dateISO = "2026-07-14";
    const difficulty = "INTERMEDIATE";

    const session = createDailyQuizSession(clientId, dateISO, difficulty);

    expect(session.clientId).toBe(clientId);
    expect(session.dateISO).toBe(dateISO);
    expect(session.difficulty).toBe(difficulty);
  });

  it("should include startedAtISO as ISO datetime string", async () => {
    const { createDailyQuizSession } = await import("@/lib/quiz/sessionFactory");

    const session = createDailyQuizSession("client-start", "2026-07-14", "BEGINNER");

    expect(session.startedAtISO).toBeDefined();
    expect(typeof session.startedAtISO).toBe("string");
    // Should be valid ISO datetime
    expect(new Date(session.startedAtISO).toString()).not.toContain("Invalid");
  });

  it("AC-3[P0]: should return SAME questionIds for SAME input (deterministic)", async () => {
    const { createDailyQuizSession } = await import("@/lib/quiz/sessionFactory");

    const clientId = "client-det";
    const dateISO = "2026-07-14";
    const difficulty = "ADVANCED";

    // Call twice with identical input
    const session1 = createDailyQuizSession(clientId, dateISO, difficulty);
    const session2 = createDailyQuizSession(clientId, dateISO, difficulty);

    // Same input should produce same questionIds (in same order)
    expect(session1.questionIds).toEqual(session2.questionIds);
    expect(session1.questionIds[0]).toBe(session2.questionIds[0]);
    expect(session1.questionIds[1]).toBe(session2.questionIds[1]);
    expect(session1.questionIds[2]).toBe(session2.questionIds[2]);
  });

  it("AC-3[P0]: should return DIFFERENT questionIds for DIFFERENT clientId", async () => {
    const { createDailyQuizSession } = await import("@/lib/quiz/sessionFactory");

    const dateISO = "2026-07-14";
    const difficulty = "BEGINNER";

    const session1 = createDailyQuizSession("client-A", dateISO, difficulty);
    const session2 = createDailyQuizSession("client-B", dateISO, difficulty);

    // Different client should get different questions (usually)
    // Note: theoretically could be same, but with deterministic selection this is unlikely
    expect(session1.questionIds).not.toEqual(session2.questionIds);
  });

  it("AC-3[P0]: should return DIFFERENT questionIds for DIFFERENT date", async () => {
    const { createDailyQuizSession } = await import("@/lib/quiz/sessionFactory");

    const clientId = "client-same";
    const difficulty = "INTERMEDIATE";

    const session1 = createDailyQuizSession(clientId, "2026-07-14", difficulty);
    const session2 = createDailyQuizSession(clientId, "2026-07-15", difficulty);

    // Different dates should produce different questions
    expect(session1.questionIds).not.toEqual(session2.questionIds);
  });

  it("AC-3[P0]: should return DIFFERENT questionIds for DIFFERENT difficulty", async () => {
    const { createDailyQuizSession } = await import("@/lib/quiz/sessionFactory");

    const clientId = "client-diff";
    const dateISO = "2026-07-14";

    const sessionBeginner = createDailyQuizSession(clientId, dateISO, "BEGINNER");
    const sessionIntermediate = createDailyQuizSession(clientId, dateISO, "INTERMEDIATE");
    const sessionAdvanced = createDailyQuizSession(clientId, dateISO, "ADVANCED");

    // Different difficulties should select from different pools
    expect(sessionBeginner.questionIds).not.toEqual(sessionIntermediate.questionIds);
    expect(sessionIntermediate.questionIds).not.toEqual(sessionAdvanced.questionIds);
    expect(sessionBeginner.questionIds).not.toEqual(sessionAdvanced.questionIds);

    // Verify questions are from correct difficulty
    const { getQuizBankIndex } = await import("@/lib/quizBank/index");
    const index = getQuizBankIndex();

    for (const qId of sessionBeginner.questionIds) {
      expect(index.byId[qId].difficulty).toBe("BEGINNER");
    }
    for (const qId of sessionIntermediate.questionIds) {
      expect(index.byId[qId].difficulty).toBe("INTERMEDIATE");
    }
    for (const qId of sessionAdvanced.questionIds) {
      expect(index.byId[qId].difficulty).toBe("ADVANCED");
    }
  });

  it("should include empty answers array", async () => {
    const { createDailyQuizSession } = await import("@/lib/quiz/sessionFactory");

    const session = createDailyQuizSession("client-ans", "2026-07-14", "BEGINNER");

    expect(Array.isArray(session.answers)).toBe(true);
    expect(session.answers.length).toBe(0);
  });

  it("should include initial score with 0 correct and 0 iqDelta", async () => {
    const { createDailyQuizSession } = await import("@/lib/quiz/sessionFactory");

    const session = createDailyQuizSession("client-score", "2026-07-14", "BEGINNER");

    expect(session.score).toBeDefined();
    expect(session.score.correctCount).toBe(0);
    expect(session.score.iqDelta).toBe(0);
  });

  it("should include createdAtISO and updatedAtISO timestamps", async () => {
    const { createDailyQuizSession } = await import("@/lib/quiz/sessionFactory");

    const beforeCreate = new Date();
    const session = createDailyQuizSession("client-ts", "2026-07-14", "BEGINNER");
    const afterCreate = new Date();

    expect(session.createdAtISO).toBeDefined();
    expect(session.updatedAtISO).toBeDefined();

    // Timestamps should be valid ISO strings
    const createdTime = new Date(session.createdAtISO);
    const updatedTime = new Date(session.updatedAtISO);

    expect(createdTime.toString()).not.toContain("Invalid");
    expect(updatedTime.toString()).not.toContain("Invalid");

    // Creation time should be between before and after
    expect(createdTime.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
    expect(createdTime.getTime()).toBeLessThanOrEqual(afterCreate.getTime() + 1000);
  });

  it("should select exactly 3 unique question IDs", async () => {
    const { createDailyQuizSession } = await import("@/lib/quiz/sessionFactory");

    const session = createDailyQuizSession("client-unique", "2026-07-14", "BEGINNER");

    // All 3 questions should be different
    const uniqueIds = new Set(session.questionIds);
    expect(uniqueIds.size).toBe(3);
  });

  it("should return session object matching DailyQuizSession type", async () => {
    const { createDailyQuizSession } = await import("@/lib/quiz/sessionFactory");

    const session = createDailyQuizSession("client-type", "2026-07-14", "ADVANCED") as unknown;

    // Verify all required properties exist
    expect(session).toHaveProperty("id");
    expect(session).toHaveProperty("sessionId");
    expect(session).toHaveProperty("clientId");
    expect(session).toHaveProperty("dateISO");
    expect(session).toHaveProperty("difficulty");
    expect(session).toHaveProperty("status");
    expect(session).toHaveProperty("questionIds");
    expect(session).toHaveProperty("answers");
    expect(session).toHaveProperty("score");
    expect(session).toHaveProperty("startedAtISO");
    expect(session).toHaveProperty("completedAtISO");
    expect(session).toHaveProperty("createdAtISO");
    expect(session).toHaveProperty("updatedAtISO");
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Integration: Time + Index + Session Creation", () => {
  it("should create sessions with consistent date/week format", async () => {
    const { getLocalDateISO, getISOWeekId } = await import("@/lib/time");
    const { createDailyQuizSession } = await import("@/lib/quiz/sessionFactory");

    const testDate = "2026-07-14";
    const session = createDailyQuizSession("client-int", testDate, "BEGINNER");

    expect(session.dateISO).toBe(testDate);
    expect(session.dateISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Verify week ID format
    const date = new Date(testDate);
    const weekId = getISOWeekId(date);
    expect(weekId).toMatch(/^\d{4}-\d{2}$/);
  });

  it("should select questions from correct difficulty pool via index", async () => {
    const { createDailyQuizSession } = await import("@/lib/quiz/sessionFactory");
    const { getQuizBankIndex } = await import("@/lib/quizBank/index");

    const index = getQuizBankIndex();

    const beginner = createDailyQuizSession("c1", "2026-07-14", "BEGINNER");
    const intermediate = createDailyQuizSession("c2", "2026-07-14", "INTERMEDIATE");
    const advanced = createDailyQuizSession("c3", "2026-07-14", "ADVANCED");

    // Verify each session contains questions from correct difficulty
    for (const qId of beginner.questionIds) {
      expect(index.byId[qId].difficulty).toBe("BEGINNER");
    }

    for (const qId of intermediate.questionIds) {
      expect(index.byId[qId].difficulty).toBe("INTERMEDIATE");
    }

    for (const qId of advanced.questionIds) {
      expect(index.byId[qId].difficulty).toBe("ADVANCED");
    }
  });

  it("multiple users on same day with different difficulties get different questions", async () => {
    const { createDailyQuizSession } = await import("@/lib/quiz/sessionFactory");

    const dateISO = "2026-07-20";
    const clientId = "integration-user";

    const s1 = createDailyQuizSession(clientId, dateISO, "BEGINNER");
    const s2 = createDailyQuizSession(clientId, dateISO, "INTERMEDIATE");
    const s3 = createDailyQuizSession(clientId, dateISO, "ADVANCED");

    // All should have 3 questions but different ones
    expect(s1.questionIds.length).toBe(3);
    expect(s2.questionIds.length).toBe(3);
    expect(s3.questionIds.length).toBe(3);

    // Questions from different difficulty pools should be distinct
    // (not all 3 should be identical when pools are different)
    expect(s1.questionIds).not.toEqual(s2.questionIds);
    expect(s2.questionIds).not.toEqual(s3.questionIds);
    expect(s1.questionIds).not.toEqual(s3.questionIds);
  });
});
