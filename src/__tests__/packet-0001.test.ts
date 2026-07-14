import { describe, it, expect, expectTypeOf } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  ISODateTimeString,
  ISODateString,
  Difficulty,
  EntityBase,
  QuizQuestion,
  UserProgress,
  DailyQuizSession,
  WrongAnswerItem,
  WeeklyLeaderboardEntry,
  DailySessionUniqueKey,
  DailyQuizSessionStoreV2,
  WrongAnswerUniqueKey,
  WrongAnswersStoreV2,
  WeeklyLeaderboardCacheV2,
  LeaderboardListResponse,
  LeaderboardSubmitResponse,
  LeaderboardSubmitRequest,
  RouteState,
} from "@/lib/types";

/**
 * TDD Tests for v2 Schema TypeScript Types + RouteState Contract
 *
 * AC-1: src/lib/types.ts exports all SPEC v2 types with exact names
 * AC-2: RouteState includes all 6 route keys with correct value types
 * AC-3: File has no runtime code (type/interface/export type only), tsc errors = 0
 *
 * NOTE: types.ts is type-only by design (AC-3), so its exports are erased at
 * compile time and never exist as runtime values. Shape checks below use
 * vitest's `expectTypeOf` (compile-time, verified by `tsc --noEmit`) instead
 * of runtime property access.
 */

describe("v2 Schema TypeScript Types + RouteState Contract", () => {
  describe("AC-1: Common Types (ISODateTimeString, ISODateString, Difficulty, EntityBase)", () => {
    it("should export ISODateTimeString type alias as string", () => {
      expectTypeOf<ISODateTimeString>().toEqualTypeOf<string>();
    });

    it("should export ISODateString type alias as string", () => {
      expectTypeOf<ISODateString>().toEqualTypeOf<string>();
    });

    it("should export Difficulty type as union of BEGINNER | INTERMEDIATE | ADVANCED", () => {
      expectTypeOf<Difficulty>().toEqualTypeOf<"BEGINNER" | "INTERMEDIATE" | "ADVANCED">();
    });

    it("should export EntityBase interface with id, createdAtISO, updatedAtISO", () => {
      expectTypeOf<EntityBase>().toHaveProperty("id").toEqualTypeOf<string>();
      expectTypeOf<EntityBase>().toHaveProperty("createdAtISO").toEqualTypeOf<ISODateTimeString>();
      expectTypeOf<EntityBase>().toHaveProperty("updatedAtISO").toEqualTypeOf<ISODateTimeString>();
    });
  });

  describe("AC-1: QuizQuestion Entity (extends EntityBase)", () => {
    it("should export QuizQuestion interface with all required fields", () => {
      expectTypeOf<QuizQuestion>().toMatchTypeOf<EntityBase>();
      expectTypeOf<QuizQuestion>().toHaveProperty("difficulty").toEqualTypeOf<Difficulty>();
      expectTypeOf<QuizQuestion>().toHaveProperty("term").toEqualTypeOf<string>();
      expectTypeOf<QuizQuestion>().toHaveProperty("prompt").toEqualTypeOf<string>();
      expectTypeOf<QuizQuestion>()
        .toHaveProperty("choices")
        .toEqualTypeOf<[string, string, string, string]>();
      expectTypeOf<QuizQuestion>().toHaveProperty("correctIndex").toEqualTypeOf<0 | 1 | 2 | 3>();
      expectTypeOf<QuizQuestion>().toHaveProperty("explanation").toEqualTypeOf<string>();
      expectTypeOf<QuizQuestion>().toHaveProperty("tags").toEqualTypeOf<string[]>();
    });
  });

  describe("AC-1: UserProgress Entity (extends EntityBase)", () => {
    it("should export UserProgress interface with all required fields", () => {
      expectTypeOf<UserProgress>().toMatchTypeOf<EntityBase>();
      expectTypeOf<UserProgress>().toHaveProperty("clientId").toEqualTypeOf<string>();
      expectTypeOf<UserProgress>().toHaveProperty("nickname").toEqualTypeOf<string>();
      expectTypeOf<UserProgress>().toHaveProperty("iqTotal").toEqualTypeOf<number>();
      expectTypeOf<UserProgress>().toHaveProperty("aiDisclosureAccepted").toEqualTypeOf<boolean>();
      expectTypeOf<UserProgress>().toHaveProperty("streak").toHaveProperty("current").toEqualTypeOf<number>();
      expectTypeOf<UserProgress>().toHaveProperty("streak").toHaveProperty("best").toEqualTypeOf<number>();
      expectTypeOf<UserProgress>()
        .toHaveProperty("streak")
        .toHaveProperty("lastCompletedDateISO")
        .toEqualTypeOf<ISODateString | undefined>();
    });
  });

  describe("AC-1: DailyQuizSession Entity (discriminated union IN_PROGRESS | COMPLETED)", () => {
    it("should export DailyQuizSession type as discriminated union", () => {
      type InProgress = Extract<DailyQuizSession, { status: "IN_PROGRESS" }>;
      type Completed = Extract<DailyQuizSession, { status: "COMPLETED" }>;

      expectTypeOf<InProgress["completedAtISO"]>().toEqualTypeOf<undefined>();
      expectTypeOf<Completed["completedAtISO"]>().toEqualTypeOf<ISODateTimeString>();

      expectTypeOf<DailyQuizSession>().toMatchTypeOf<EntityBase>();
      expectTypeOf<DailyQuizSession>().toHaveProperty("sessionId").toEqualTypeOf<string>();
      expectTypeOf<DailyQuizSession>().toHaveProperty("clientId").toEqualTypeOf<string>();
      expectTypeOf<DailyQuizSession>().toHaveProperty("dateISO").toEqualTypeOf<ISODateString>();
      expectTypeOf<DailyQuizSession>().toHaveProperty("difficulty").toEqualTypeOf<Difficulty>();
      expectTypeOf<DailyQuizSession>()
        .toHaveProperty("questionIds")
        .toEqualTypeOf<[string, string, string]>();
      expectTypeOf<DailyQuizSession>().toHaveProperty("startedAtISO").toEqualTypeOf<ISODateTimeString>();
      expectTypeOf<DailyQuizSession["answers"][number]>().toEqualTypeOf<{
        questionId: string;
        selectedIndex: 0 | 1 | 2 | 3;
        isCorrect: boolean;
      }>();
      expectTypeOf<DailyQuizSession>()
        .toHaveProperty("score")
        .toHaveProperty("correctCount")
        .toEqualTypeOf<0 | 1 | 2 | 3>();
      expectTypeOf<DailyQuizSession>().toHaveProperty("score").toHaveProperty("iqDelta").toEqualTypeOf<number>();
    });

    it("should export DailySessionUniqueKey type as template literal", () => {
      expectTypeOf<"uuid-A:2026-07-14:BEGINNER">().toMatchTypeOf<DailySessionUniqueKey>();
    });

    it("should export DailyQuizSessionStoreV2 type with byUniqueKey structure", () => {
      expectTypeOf<DailyQuizSessionStoreV2>().toHaveProperty("byUniqueKey");
      expectTypeOf<
        DailyQuizSessionStoreV2["byUniqueKey"][DailySessionUniqueKey]
      >().toEqualTypeOf<DailyQuizSession>();
    });
  });

  describe("AC-1: WrongAnswerItem Entity (extends EntityBase, UNIQUE clientId+questionId)", () => {
    it("should export WrongAnswerItem interface with all required fields", () => {
      expectTypeOf<WrongAnswerItem>().toMatchTypeOf<EntityBase>();
      expectTypeOf<WrongAnswerItem>().toHaveProperty("clientId").toEqualTypeOf<string>();
      expectTypeOf<WrongAnswerItem>().toHaveProperty("questionId").toEqualTypeOf<string>();
      expectTypeOf<WrongAnswerItem>().toHaveProperty("firstWrongAtISO").toEqualTypeOf<ISODateTimeString>();
      expectTypeOf<WrongAnswerItem>().toHaveProperty("lastWrongAtISO").toEqualTypeOf<ISODateTimeString>();
      expectTypeOf<WrongAnswerItem>().toHaveProperty("wrongCount").toEqualTypeOf<number>();
      expectTypeOf<WrongAnswerItem>().toHaveProperty("lastSelectedIndex").toEqualTypeOf<0 | 1 | 2 | 3>();
      expectTypeOf<WrongAnswerItem>().toHaveProperty("difficulty").toEqualTypeOf<Difficulty>();
    });

    it("should export WrongAnswerUniqueKey type as template literal", () => {
      expectTypeOf<"uuid-A:q_0007">().toMatchTypeOf<WrongAnswerUniqueKey>();
    });

    it("should export WrongAnswersStoreV2 type with byUniqueKey structure", () => {
      expectTypeOf<WrongAnswersStoreV2>().toHaveProperty("byUniqueKey");
      expectTypeOf<
        WrongAnswersStoreV2["byUniqueKey"][WrongAnswerUniqueKey]
      >().toEqualTypeOf<WrongAnswerItem>();
    });
  });

  describe("AC-1: WeeklyLeaderboardEntry Entity (extends EntityBase)", () => {
    it("should export WeeklyLeaderboardEntry interface with all required fields", () => {
      expectTypeOf<WeeklyLeaderboardEntry>().toMatchTypeOf<EntityBase>();
      expectTypeOf<WeeklyLeaderboardEntry>().toHaveProperty("weekId").toEqualTypeOf<string>();
      expectTypeOf<WeeklyLeaderboardEntry>().toHaveProperty("clientId").toEqualTypeOf<string>();
      expectTypeOf<WeeklyLeaderboardEntry>().toHaveProperty("nickname").toEqualTypeOf<string>();
      expectTypeOf<WeeklyLeaderboardEntry>().toHaveProperty("weeklyIqDelta").toEqualTypeOf<number>();
    });

    it("should export WeeklyLeaderboardCacheV2 type with fetchedAtISO and entries", () => {
      expectTypeOf<WeeklyLeaderboardCacheV2[string]>()
        .toHaveProperty("fetchedAtISO")
        .toEqualTypeOf<ISODateTimeString>();
      expectTypeOf<WeeklyLeaderboardCacheV2[string]>()
        .toHaveProperty("entries")
        .toEqualTypeOf<WeeklyLeaderboardEntry[]>();
    });
  });

  describe("AC-1: API Response DTO Types", () => {
    it("should export LeaderboardListResponse type", () => {
      expectTypeOf<LeaderboardListResponse>().toHaveProperty("entries").toEqualTypeOf<WeeklyLeaderboardEntry[]>();
    });

    it("should export LeaderboardSubmitResponse type", () => {
      expectTypeOf<LeaderboardSubmitResponse>().toHaveProperty("weekId").toEqualTypeOf<string>();
      expectTypeOf<LeaderboardSubmitResponse>().toHaveProperty("entry").toEqualTypeOf<WeeklyLeaderboardEntry>();
      expectTypeOf<LeaderboardSubmitResponse>().toHaveProperty("rank").toEqualTypeOf<number>();
    });

    it("should export LeaderboardSubmitRequest type", () => {
      expectTypeOf<LeaderboardSubmitRequest>().toHaveProperty("weekId").toEqualTypeOf<string>();
      expectTypeOf<LeaderboardSubmitRequest>().toHaveProperty("clientId").toEqualTypeOf<string>();
      expectTypeOf<LeaderboardSubmitRequest>().toHaveProperty("nickname").toEqualTypeOf<string>();
      expectTypeOf<LeaderboardSubmitRequest>().toHaveProperty("weeklyIqDelta").toEqualTypeOf<number>();
    });
  });

  describe("AC-2: RouteState - Home route (/)", () => {
    it("home state can be undefined or have recovered flag", () => {
      expectTypeOf<RouteState["/"]>().toEqualTypeOf<undefined | { recovered?: boolean }>();
    });
  });

  describe("AC-2: RouteState - Quiz route (/quiz)", () => {
    it("should define RouteState[/quiz] with sessionId field", () => {
      expectTypeOf<RouteState["/quiz"]>().toEqualTypeOf<{ sessionId: string }>();
    });
  });

  describe("AC-2: RouteState - Result route (/result)", () => {
    it("should define RouteState[/result] with sessionId field", () => {
      expectTypeOf<RouteState["/result"]>().toEqualTypeOf<{ sessionId: string }>();
    });
  });

  describe("AC-2: RouteState - Review route (/review)", () => {
    it("should define RouteState[/review] allowing no required fields", () => {
      expectTypeOf<RouteState["/review"]>().toEqualTypeOf<undefined | {}>();
    });
  });

  describe("AC-2: RouteState - Leaderboard route (/leaderboard)", () => {
    it("should define RouteState[/leaderboard] allowing undefined state", () => {
      expectTypeOf<RouteState["/leaderboard"]>().toEqualTypeOf<undefined>();
    });
  });

  describe("AC-2: RouteState - Settings route (/settings)", () => {
    it("should define RouteState[/settings] allowing undefined state", () => {
      expectTypeOf<RouteState["/settings"]>().toEqualTypeOf<undefined>();
    });
  });

  describe("AC-3: TypeScript Compilation (tsc --noEmit = 0 errors)", () => {
    it("module has zero runtime exports (types are erased at compile time)", async () => {
      const types = await import("@/lib/types");
      expect(types).toBeDefined();
      expect(Object.keys(types).length).toBe(0);
    });

    it("should not export any runtime constants or functions", async () => {
      const types = await import("@/lib/types");
      for (const name of Object.keys(types)) {
        const exported = types[name as keyof typeof types];
        expect(typeof exported).not.toBe("function");
      }
    });
  });

  describe("AC-3: No runtime code - only type/interface declarations", () => {
    it("file should contain only type aliases and interface exports", () => {
      const source = readFileSync(join(process.cwd(), "src/lib/types.ts"), "utf-8");
      expect(source).not.toMatch(/^\s*export\s+(const|let|function)\b/m);
    });
  });

  describe("Integration: RouteState matches SPEC navigation patterns", () => {
    it("AC-1[P0]: home state can include recovered flag for error recovery", () => {
      const recovered: RouteState["/"] = { recovered: true };
      const cleared: RouteState["/"] = undefined;
      expect(recovered.recovered).toBe(true);
      expect(cleared).toBeUndefined();
    });

    it("AC-1[P0]: quiz state requires sessionId from session creation", () => {
      expectTypeOf<RouteState["/quiz"]>().toHaveProperty("sessionId").toEqualTypeOf<string>();
    });

    it("AC-1[P0]: result state requires sessionId for result lookup", () => {
      expectTypeOf<RouteState["/result"]>().toHaveProperty("sessionId").toEqualTypeOf<string>();
    });

    it("all 6 routes have corresponding RouteState keys", () => {
      expectTypeOf<keyof RouteState>().toEqualTypeOf<
        "/" | "/quiz" | "/result" | "/review" | "/leaderboard" | "/settings"
      >();
    });
  });
});
