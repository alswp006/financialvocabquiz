// v2 Schema TypeScript Types + RouteState Contract
// DO NOT ADD RUNTIME CODE — type/interface declarations only

// ============================================================================
// Common Types
// ============================================================================

export type ISODateTimeString = string; // e.g., "2026-07-14T00:00:00.000Z"
export type ISODateString = string; // e.g., "2026-07-14"
export type Difficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export interface EntityBase {
  id: string;
  createdAtISO: ISODateTimeString;
  updatedAtISO: ISODateTimeString;
}

// ============================================================================
// Entity Types
// ============================================================================

export interface QuizQuestion extends EntityBase {
  difficulty: Difficulty;
  term: string;
  prompt: string;
  choices: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
  tags: string[];
}

export interface UserProgress extends EntityBase {
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

type DailyQuizSessionBase = EntityBase & {
  sessionId: string;
  clientId: string;
  dateISO: ISODateString;
  difficulty: Difficulty;
  questionIds: [string, string, string];
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

export type DailyQuizSession =
  | (DailyQuizSessionBase & {
      status: 'IN_PROGRESS';
      completedAtISO?: undefined;
    })
  | (DailyQuizSessionBase & {
      status: 'COMPLETED';
      completedAtISO: ISODateTimeString;
    });

export interface WrongAnswerItem extends EntityBase {
  clientId: string;
  questionId: string;
  firstWrongAtISO: ISODateTimeString;
  lastWrongAtISO: ISODateTimeString;
  wrongCount: number;
  lastSelectedIndex: 0 | 1 | 2 | 3;
  difficulty: Difficulty;
}

export interface WeeklyLeaderboardEntry extends EntityBase {
  weekId: string;
  clientId: string;
  nickname: string;
  weeklyIqDelta: number;
}

// ============================================================================
// Storage Index Types (UNIQUE + O(1) lookup patterns)
// ============================================================================

export type DailySessionUniqueKey = `${string}:${ISODateString}:${Difficulty}`;

export interface DailyQuizSessionStoreV2 {
  byUniqueKey: Record<DailySessionUniqueKey, DailyQuizSession>;
}

export type WrongAnswerUniqueKey = `${string}:${string}`;

export interface WrongAnswersStoreV2 {
  byUniqueKey: Record<WrongAnswerUniqueKey, WrongAnswerItem>;
}

export interface WeeklyLeaderboardCacheV2 {
  [weekId: string]: {
    fetchedAtISO: ISODateTimeString;
    entries: WeeklyLeaderboardEntry[];
  };
}

// ============================================================================
// API Response DTO Types
// ============================================================================

export interface LeaderboardListResponse {
  entries: WeeklyLeaderboardEntry[];
}

export interface LeaderboardSubmitResponse {
  weekId: string;
  entry: WeeklyLeaderboardEntry;
  rank: number;
}

export interface LeaderboardSubmitRequest {
  weekId: string;
  clientId: string;
  nickname: string;
  weeklyIqDelta: number;
}

// ============================================================================
// RouteState Contract (Type-Safe Navigation)
// ============================================================================

export type RouteState = {
  '/': undefined | { recovered?: boolean };
  '/quiz': { sessionId: string };
  '/result': { sessionId: string };
  '/review': undefined | {};
  '/leaderboard': undefined;
  '/settings': undefined;
};
