# Packet 0001: v2 Schema TypeScript Types + RouteState Contract

## Summary
Tests have been written (TDD-first) that define the complete v2 schema as TypeScript types. These tests specify:
1. All SPEC v2 entities with exact field names and types
2. Storage index structures (`byUniqueKey` pattern)
3. API DTO types for leaderboard endpoints
4. RouteState contract for all 6 application routes

**Status**: Tests written, failing (as expected). Ready for implementation.

---

## Test File
`src/__tests__/packet-0001.test.ts` — 32 tests covering:

### AC-1: All Type Exports (15 tests)
**Common types:**
- `ISODateTimeString` (type alias)
- `ISODateString` (type alias)
- `Difficulty` (union type: `'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'`)
- `EntityBase` (interface with `id`, `createdAtISO`, `updatedAtISO`)

**Entity types:**
- `QuizQuestion` (extends EntityBase; has `difficulty`, `term`, `prompt`, `choices: [4]`, `correctIndex: 0|1|2|3`, `explanation`, `tags`)
- `UserProgress` (extends EntityBase; has `clientId`, `nickname`, `iqTotal`, `streak`, `aiDisclosureAccepted`)
- `DailyQuizSession` (discriminated union: `IN_PROGRESS | COMPLETED`; base extends EntityBase + has `sessionId`, `clientId`, `dateISO`, `difficulty`, `questionIds: [3]`, `answers[]`, `startedAtISO`, `score`, `status`; variant: `COMPLETED` has `completedAtISO`)
- `WrongAnswerItem` (extends EntityBase; has `clientId`, `questionId`, `firstWrongAtISO`, `lastWrongAtISO`, `wrongCount`, `lastSelectedIndex: 0|1|2|3`, `difficulty`)
- `WeeklyLeaderboardEntry` (extends EntityBase; has `weekId`, `clientId`, `nickname`, `weeklyIqDelta`)

**Storage index types:**
- `DailySessionUniqueKey` (template literal: `${string}:${ISODateString}:${Difficulty}`)
- `DailyQuizSessionStoreV2` (type with `{ byUniqueKey: Record<DailySessionUniqueKey, DailyQuizSession> }`)
- `WrongAnswerUniqueKey` (template literal: `${string}:${string}`)
- `WrongAnswersStoreV2` (type with `{ byUniqueKey: Record<WrongAnswerUniqueKey, WrongAnswerItem> }`)
- `WeeklyLeaderboardCacheV2` (type: `Record<weekId, { fetchedAtISO, entries[] }>`)

**API DTO types:**
- `LeaderboardListResponse` (has `entries: WeeklyLeaderboardEntry[]`)
- `LeaderboardSubmitResponse` (has `weekId`, `entry: WeeklyLeaderboardEntry`, `rank: number`)
- `LeaderboardSubmitRequest` (has `weekId`, `clientId`, `nickname`, `weeklyIqDelta`)

### AC-2: RouteState Contract (7 tests)
**Routes and their state types:**
- `/` — Home: `RouteState["/"]` = `undefined | { recovered?: boolean }`
- `/quiz` — Quiz screen: `RouteState["/quiz"]` = `{ sessionId: string }`
- `/result` — Result: `RouteState["/result"]` = `{ sessionId: string }`
- `/review` — Review/wrong answers: `RouteState["/review"]` = `undefined | {}`
- `/leaderboard` — Leaderboard: `RouteState["/leaderboard"]` = `undefined`
- `/settings` — Settings: `RouteState["/settings"]` = `undefined`

**RouteState should be a discriminated union** where each key can be indexed:
```typescript
type RouteState = {
  "/": undefined | { recovered?: boolean };
  "/quiz": { sessionId: string };
  "/result": { sessionId: string };
  "/review": undefined | {};
  "/leaderboard": undefined;
  "/settings": undefined;
};
```

### AC-3: Code Quality (2 tests)
- File exports **only type declarations** — no `const`, `let`, `function`, or `export const`
- TypeScript compilation (`tsc --noEmit`) produces **0 errors**

---

## Implementation Checklist

### Required Exports (to pass tests)
```typescript
// Common types
export type ISODateTimeString = ...
export type ISODateString = ...
export type Difficulty = ...
export interface EntityBase { ... }

// Entities
export interface QuizQuestion extends EntityBase { ... }
export interface UserProgress extends EntityBase { ... }
export type DailyQuizSession = ... // discriminated union
export interface WrongAnswerItem extends EntityBase { ... }
export interface WeeklyLeaderboardEntry extends EntityBase { ... }

// Storage indices
export type DailySessionUniqueKey = ...
export type DailyQuizSessionStoreV2 = ...
export type WrongAnswerUniqueKey = ...
export type WrongAnswersStoreV2 = ...
export type WeeklyLeaderboardCacheV2 = ...

// API DTOs
export interface LeaderboardListResponse { ... }
export interface LeaderboardSubmitResponse { ... }
export interface LeaderboardSubmitRequest { ... }

// Route state contract
export type RouteState = ...
```

### Field Specification (from SPEC)

#### QuizQuestion
```typescript
interface QuizQuestion extends EntityBase {
  difficulty: Difficulty;
  term: string;
  prompt: string;
  choices: [string, string, string, string]; // exactly 4
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
  tags: string[];
}
```

#### UserProgress
```typescript
interface UserProgress extends EntityBase {
  clientId: string;
  nickname: string;
  iqTotal: number;
  streak: {
    current: number;
    best: number;
    lastCompletedDateISO?: ISODateString;
  };
  aiDisclosureAccepted: boolean;
}
```

#### DailyQuizSession (discriminated union)
```typescript
type DailyQuizSessionBase = EntityBase & {
  sessionId: string; // must equal id
  clientId: string; // FK to UserProgress.id
  dateISO: ISODateString;
  difficulty: Difficulty;
  questionIds: [string, string, string]; // exactly 3
  answers: Array<{
    questionId: string;
    selectedIndex: 0 | 1 | 2 | 3;
    isCorrect: boolean;
  }>;
  startedAtISO: ISODateTimeString;
  score: {
    correctCount: 0 | 1 | 2 | 3;
    iqDelta: number;
  };
};

type DailyQuizSession =
  | (DailyQuizSessionBase & {
      status: 'IN_PROGRESS';
      completedAtISO?: undefined;
    })
  | (DailyQuizSessionBase & {
      status: 'COMPLETED';
      completedAtISO: ISODateTimeString;
    });
```

#### WrongAnswerItem
```typescript
interface WrongAnswerItem extends EntityBase {
  clientId: string; // FK to UserProgress.id
  questionId: string; // FK to QuizQuestion.id
  firstWrongAtISO: ISODateTimeString;
  lastWrongAtISO: ISODateTimeString;
  wrongCount: number; // >= 1
  lastSelectedIndex: 0 | 1 | 2 | 3;
  difficulty: Difficulty;
}
```

#### WeeklyLeaderboardEntry
```typescript
interface WeeklyLeaderboardEntry extends EntityBase {
  weekId: string; // "YYYY-WW" format
  clientId: string;
  nickname: string;
  weeklyIqDelta: number;
}
```

#### Storage Index Types
```typescript
type DailySessionUniqueKey = `${string}:${ISODateString}:${Difficulty}`;
type DailyQuizSessionStoreV2 = {
  byUniqueKey: Record<DailySessionUniqueKey, DailyQuizSession>;
};

type WrongAnswerUniqueKey = `${string}:${string}`;
type WrongAnswersStoreV2 = {
  byUniqueKey: Record<WrongAnswerUniqueKey, WrongAnswerItem>;
};

type WeeklyLeaderboardCacheV2 = Record<
  string,
  {
    fetchedAtISO: ISODateTimeString;
    entries: WeeklyLeaderboardEntry[];
  }
>;
```

#### API DTO Types
```typescript
interface LeaderboardListResponse {
  entries: WeeklyLeaderboardEntry[];
}

interface LeaderboardSubmitResponse {
  weekId: string;
  entry: WeeklyLeaderboardEntry;
  rank: number;
}

interface LeaderboardSubmitRequest {
  weekId: string;
  clientId: string;
  nickname: string;
  weeklyIqDelta: number;
}
```

#### RouteState (discriminated union for react-router-dom)
```typescript
type RouteState = {
  "/": undefined | { recovered?: boolean };
  "/quiz": { sessionId: string };
  "/result": { sessionId: string };
  "/review": undefined | {};
  "/leaderboard": undefined;
  "/settings": undefined;
};
```

---

## Test Run Output
**Currently: 6/32 tests passing** (placeholder tests + 26 failing)

After implementation, all 32 tests should pass:
```bash
npx vitest run src/__tests__/packet-0001.test.ts
# Expected: PASS (32 tests)
```

---

## Next Steps (Coder)
1. Implement `src/lib/types.ts` with all exports above
2. Run: `npx tsc --noEmit` (must have 0 errors)
3. Run: `npx vitest run src/__tests__/packet-0001.test.ts` (must have 32/32 passing)
4. Verify: `grep -E "^export (const|let|function)" src/lib/types.ts` returns empty (no runtime code)

---

## Notes for Reviewers
- This is **TDD phase only** — no runtime code should be implemented
- Types are the "contract" for all subsequent features
- RouteState ensures type-safe navigation across all routes
- Storage indices (`byUniqueKey`) enforce UNIQUE constraints at the application level (localStorage has no DBMS)
- All timestamps are ISO 8601 strings for JSON serialization compatibility
