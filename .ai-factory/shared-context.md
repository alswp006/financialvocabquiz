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
- id.ts: export function createId(prefix = "id"): string
- quiz/sessionFactory.ts: export function createDailyQuizSession( clientId: string, dateISO: string, difficulty: Difficulty ): DailyQuizSession
- quizBank/data.ts: export const QUIZ_BANK: QuizQuestion[] = [ // BEGINNER questions
- quizBank/index.ts: export interface QuizBankIndex; export function getQuizBankIndex(): QuizBankIndex
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void
- time.ts: export function nowISO(): string; export function getLocalDateISO(now?: Date): string; export function getISOWeekId(date: Date): string
- types.ts: export type ISODateTimeString = string; export type ISODateString = string; export type Difficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'; export interface EntityBase; export interface QuizQuestion extends EntityBase; export interface UserProgress extends EntityBase; export type DailyQuizSession = | (DailyQuizSessionBase &; export interface WrongAnswerItem extends EntityBase
- utils.ts: export function cn(...classes: (string | boolean | undefined | null)[]): string; export function formatNumber(n: number): string; export function formatCurrency(n: number, currency = 'KRW'): string

### Components (src/components/)
- AdSlot.tsx: AdSlot
- Amount.tsx: Amount
- BottomCTA.tsx: SubmitFooter, ButtonStack
- Card.tsx: Card
- CountUp.tsx: CountUp
- FloatingTabBar.tsx: FloatingTabBar
- MiniBar.tsx: MiniBar
- PageShell.tsx: PageShell
- ScreenScaffold.tsx: ScreenScaffold
- Sparkline.tsx: Sparkline
- StateView.tsx: EmptyState, LoadingState
- SummaryHero.tsx: SummaryHero
- TossPurchase.tsx: TossPurchase
- TossRewardAd.tsx: TossRewardAd
- VirtualList.tsx: VirtualList
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

## Already Implemented (do NOT duplicate or overwrite)
- 0001: v2 스키마 TypeScript 타입 + RouteState 계약 고정 (files: src/lib/types.ts)
- 0002: 시간/ID 유틸 + 퀴즈뱅크 런타임 인덱스 + 세션 생성(결정적 3문항) (files: src/lib/time.ts, src/lib/id.ts, src/lib/quizBank/index.ts, src/lib/quiz/sessionFactory.ts)
- 0003: localStorage v2 저장소 — TDD 진행 중 (files: src/__tests__/packet-0003.test.ts, TODO: src/lib/storage/safeStorage.ts, dailySessions.ts, wrongAnswers.ts, leaderboardCache.ts, userProgress.ts)
- 0005: API 공통 fetch 래퍼(http.ts): JSON/헤더 파싱 + non-throw 결과 모델 (files: src/lib/api/http.ts)
- 0007: VirtualList 공용 컴포넌트(react-window) + 50+ 목록 가상 스크롤 기반 (files: src/components/VirtualList.tsx)