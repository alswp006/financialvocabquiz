# Shared Context (auto-generated — do NOT modify)


## Shared Types Contract (IMPORT these, do NOT redefine)
```typescript
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
    entries: WeeklyLeaderboa
// ...truncated
```

## Existing Codebase (import and use these — do NOT recreate)
### File Tree (src/)
  App.tsx
  components/
    AdSlot.tsx
    Amount.tsx
    BottomCTA.tsx
    Card.tsx
    CountUp.tsx
    FloatingTabBar.tsx
    MiniBar.tsx
    PageShell.tsx
    ScreenScaffold.tsx
    Sparkline.tsx
    StateView.tsx
    SummaryHero.tsx
    TossPurchase.tsx
    TossRewardAd.tsx
    VirtualList.tsx
  hooks/
  lib/
    api/
    id.ts
    quiz/
    quizBank/
    storage/
    storage.ts
    time.ts
    types.ts
    utils.ts
  main.tsx
  pages/
    Home.tsx
    __TdsGallery.tsx
  styles/
    globals.css
    reward-ad.css
  types/
  vite-env.d.ts

### Exports (src/lib/)
- api/http.ts: export type HttpErrorCode = "NETWORK_ERROR" | "PARSE_ERROR" | "HTTP_ERROR"; export interface HttpSuccess<T>; export interface HttpFailure; export type HttpResult<T> = HttpSuccess<T> | HttpFailure; export interface HttpRequestOptions; export function httpGetJSON<T = unknown>( url: string, options?: HttpRequestOptions ): Promise<HttpResult<T>>; export function httpPostJSON<T = unknown, B = unknown>( url: string, body: B, options?: HttpRequestOptions ): Promise<Ht
- api/leaderboard.ts: export interface WeeklyLeaderboardListEntry extends WeeklyLeaderboardEntry; export interface FetchWeeklyLeaderboardParams; export interface FetchWeeklyLeaderboardResponse; export interface SubmitWeeklyLeaderboardRequest; export interface SubmitWeeklyLeaderboardResponse; export interface ApiError; export interface ApiResult<T>; export async function fetchWeeklyLeaderboard( params: FetchWeeklyLeaderboardParams ): Promise<ApiResult<FetchWeeklyLeade
- id.ts: export function createId(prefix = "id"): string
- quiz/sessionFactory.ts: export function createDailyQuizSession( clientId: string, dateISO: string, difficulty: Difficulty ): DailyQuizSession
- quizBank/data.ts: export const QUIZ_BANK: QuizQuestion[] = [ // BEGINNER questions
- quizBank/index.ts: export interface QuizBankIndex; export function getQuizBankIndex(): QuizBankIndex
- storage/dailySessions.ts: export const DAILY_SESSIONS_KEY = "fvq_daily_sessions_v2"; export function toDailySessionUniqueKey( clientId: string, dateISO: string, difficulty: DailyQuizSession["difficulty"] ); export function saveDailySession(session: DailyQuizSession): void; export function getDailySessionByKey( uniqueKey: DailySessionUniqueKey ): DailyQuizSession | null; export function findSessionBySessionId(sessionId: string): DailyQuizSession | null; export function deleteAllSessions(): void
- storage/leaderboardCache.ts: export const LEADERBOARD_CACHE_KEY = "fvq_leaderboard_cache_v2"; export function getLeaderboardCache( weekId: string ):; export function setLeaderboardCache( weekId: string, entries: WeeklyLeaderboardEntry[] ): void; export function deleteAllLeaderboardCache(): void
- storage/safeStorage.ts: export type SafeStorageError = "CORRUPTED" | "QUOTA_EXCEEDED" | "UNKNOWN"; export type SafeStorageResult<T> = |; export type SafeVoidResult =; export function safeGetJSON<T = unknown>(key: string): SafeStorageResult<T | null>; export function safeSetJSON<T = unknown>(key: string, value: T): SafeVoidResult; export function safeRemove(key: string): SafeVoidResult
- storage/scratchDep.ts: export function scratchHello(): string
- storage/scratchUser.ts: export function scratchUse(): string
- storage/userProgress.ts: export const USER_PROGRESS_KEY = "fvq_user_progress_v2"; export function createDefaultUserProgress(nickname = "게스트"): UserProgress; export function getUserProgress(): UserProgress | null; export function saveUserProgress(progress: UserProgress): void; export function resetUserProgress(): UserProgress
- storage/wrongAnswers.ts: export const WRONG_ANSWERS_KEY = "fvq_wrong_answers_v2"; export const WRONG_ANSWERS_MAX = 200; export function toWrongAnswerUniqueKey( clientId: string, questionId: string ): WrongAnswerUniqueKey; export function saveWrongAnswer(item: WrongAnswerItem): void; export function getWrongAnswer(uniqueKey: WrongAnswerUniqueKey): WrongAnswerItem | null; export function getAllWrongAnswers(clientId: string): WrongAnswerItem[]; export function deleteAllWrongAnswers(): void
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void
- time.ts: export function nowISO(): string; export function getLocalDateISO(now?: Date): string; export function getISOWeekId(date: Date): string
- types.ts: export type ISODateTimeString = string; export type ISODateString = string; export type Difficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'; export interface EntityBase; export interface QuizQuestion extends EntityBase; export interface UserProgress extends EntityBase; export type DailyQuizSession = | (DailyQuizSessionBase &; export interface WrongAnswerItem extends EntityBase
- utils.ts: export function cn(...classes: (string | boolean | undefined | null)[]): string; export function formatNumber(n: number): string; export func...
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

## Already Implemented (do NOT duplicate or overwrite)
- 0001: v2 스키마 TypeScript 타입 + RouteState 계약 고정 (files: src/lib/types.ts)
- 0002: 시간/ID 유틸 + 퀴즈뱅크 런타임 인덱스 + 세션 생성(결정적 3문항) (files: src/lib/time.ts, src/lib/id.ts, src/lib/quizBank/index.ts, src/lib/quiz/sessionFactory.ts)
- 0005: API 공통 fetch 래퍼(http.ts): JSON/헤더 파싱 + non-throw 결과 모델 (files: src/lib/api/http.ts)
- 0007: VirtualList 공용 컴포넌트(react-window) + 50+ 목록 가상 스크롤 기반 (files: src/components/VirtualList.tsx)
- 0003: localStorage v2 저장소: safeStorage + UserProgress/DailySessions/WrongAnswers/LeaderboardCache CRUD (files: src/lib/storage/safeStorage.ts, src/lib/storage/userProgress.ts, src/lib/storage/dailySessions.ts, src/lib/storage/wrongAnswers.ts, src/lib/storage/leaderboardCache.ts)
- 0006: 리더보드 API 클라이언트(leaderboard.ts): GET 주간조회 + POST 제출 (files: src/lib/api/leaderboard.ts)