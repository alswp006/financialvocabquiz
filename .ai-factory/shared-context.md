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
  hooks/
  lib/
    storage.ts
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
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void
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
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

## Already Implemented (do NOT duplicate or overwrite)
- 0001: v2 스키마 TypeScript 타입 + RouteState 계약 고정 (files: src/lib/types.ts)