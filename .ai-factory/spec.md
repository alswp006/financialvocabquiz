# SPEC (Updated: 스키마 정규화/무결성 보강 v2)

> 변경 목적: **모든 엔터티에 `id / createdAtISO / updatedAtISO` 추가**, FK 관계 명시, **UNIQUE(중복 방지) 보장**, localStorage 환경에서 가능한 범위의 **“인덱스(=O(1) 키 조회)” 구조**로 재정의.  
> 주의: 이 미니앱은 DB가 아니라 **localStorage** 기반이므로 SQL의 `INDEX/FOREIGN KEY/ON DELETE`는 **저장 구조 + 애플리케이션 로직**으로 동일한 “pass/fail” 효과를 보장한다.

---

## Common Principles

- **플랫폼/기술**
  - Vite + React + TypeScript
  - UI: `@toss/tds-mobile` 컴포넌트만 사용(여백은 `Spacing`만 사용)
  - 라우팅: `react-router-dom`
  - 저장: `localStorage` (총 5MB 이하 유지)
  - 광고: 템플릿 제공 `<AdSlot />`, 보상형 광고 게이트 `<TossRewardAd />` 사용(겹침 배치 금지)

- **MVP 범위**
  - 서버 없는 기능은 모두 `localStorage`로 처리
  - **주간 랭킹**은 다중 유저 경쟁이므로 **외부 API 서버(Railway 등 별도 배포)** 사용(**이 Spec에 API 계약 포함**)

- **모바일 UX 규칙**
  - 모든 인터랙션 터치 타깃 **최소 44px**
  - 폼 입력은 모바일 키보드 고려: `TextField`에 `maxLength`, `enterKeyHint`, `onSubmit`(Enter) 시 blur 처리
  - 리스트는 스크롤 컨테이너 명시, **50개 초과 시 가상 스크롤(react-window)** 적용

- **Toss 검수/정책 준수**
  - [W] 외부 도메인 이탈 금지: `window.location.href`, `window.open`로 외부 이동 구현 금지
  - [W] 외부 로깅 금지: GA/Amplitude 등 외부 분석 SDK 사용 금지
  - [W] HEX 색상 하드코딩 금지: `#FFFFFF` 등 사용 금지(오직 TDS/`var(--tds-color-*)`)
  - [U] Android 7+, iOS 16+ 호환(최신 전용 API 사용 금지)
  - [U] 프로덕션에서 `console.error` 호출 0회(테스트에서 스파이로 검증 가능)

---

## Data Models (v2)

### 공통 타입

```ts
export type ISODateTimeString = string; // e.g., "2026-07-14T00:00:00.000Z"
export type ISODateString = string; // "YYYY-MM-DD"
export type Difficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export interface EntityBase {
  id: string; // PK (string/uuid 또는 안정적인 식별자)
  createdAtISO: ISODateTimeString;
  updatedAtISO: ISODateTimeString;
}
```

---

## 1) QuizQuestion (Static Bundle Entity)

> 번들(JSON)에서 로드되는 “정적 엔터티”지만, **검증/추적 일관성**을 위해 `createdAtISO/updatedAtISO`를 모두 갖는다.

```ts
export interface QuizQuestion extends EntityBase {
  // id: string; // e.g., "q_0001"
  difficulty: Difficulty;
  term: string; // e.g., "ETF"
  prompt: string; // 문제 문장
  choices: [string, string, string, string]; // 정확히 4개
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string; // 해설 텍스트
  tags: string[]; // e.g., ["주식", "지수"]
}
```

- **Constraints**
  - `choices.length === 4`
  - `correctIndex`는 0~3만 허용
- **Storage**
  - localStorage 저장 없음(번들 포함 정적 JSON)
- **Index(개념)**
  - 런타임에서 `Record<QuizQuestion["id"], QuizQuestion>` 맵을 생성하여 `id`로 O(1) 조회 가능해야 함

---

## 2) UserProgress (v2: 표준 PK/타임스탬프 추가)

> 기존 `clientId`를 **외부 랭킹 API 계약 식별자**로 계속 유지하되, 스키마 표준화를 위해 `id`를 추가한다.  
> **제약: `id === clientId`**

```ts
export interface UserProgress extends EntityBase {
  clientId: string; // uuid, 최초 1회 생성 후 고정 (FK target)
  nickname: string; // 2~10자
  // createdAtISO, updatedAtISO는 EntityBase로 승격

  iqTotal: number; // 누적 금융 IQ
  streak: {
    current: number; // 연속 완료 일수
    best: number;
    lastCompletedDateISO?: ISODateString; // "YYYY-MM-DD"
  };

  aiDisclosureAccepted: boolean; // 본 앱은 AI 기능 없음 → 기본 false 유지(미사용)
}
```

- **Constraints**
  - `id === clientId`
  - `nickname.trim().length` 2~10
  - `iqTotal >= 0`, `streak.current >= 0`, `streak.best >= 0`

- **localStorage**
  - 키: `fvq_user_progress_v2`
  - Shape: `UserProgress`

- **Index**
  - PK: `id`(=clientId) 단건 저장이므로 별도 인덱스 불필요

---

## 3) DailyQuizSession (v2: 표준 PK/UNIQUE/FK/타임스탬프)

```ts
type DailyQuizSessionBase = EntityBase & {
  sessionId: string; // legacy 호환용 (제약: sessionId === id)
  clientId: string; // FK -> UserProgress.clientId (제약: clientId === UserProgress.id)
  dateISO: ISODateString; // "YYYY-MM-DD" (로컬 기준)
  difficulty: Difficulty;

  questionIds: [string, string, string]; // 정확히 3개

  answers: Array<{
    questionId: string;
    selectedIndex: 0 | 1 | 2 | 3;
    isCorrect: boolean;
  }>; // 0~3개

  startedAtISO: ISODateTimeString;

  score: {
    correctCount: 0 | 1 | 2 | 3;
    iqDelta: number; // 예: correct*10 + completionBonus(5)
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
```

- **Constraints**
  - `id` 존재
  - `sessionId === id`
  - `clientId`는 반드시 존재하고, `fvq_user_progress_v2.id`와 동일해야 한다 (FK)
  - `questionIds.length === 3`
  - `answers.length <= 3`
  - `status === "COMPLETED"`이면 `completedAtISO` **반드시 존재**
  - `status === "IN_PROGRESS"`이면 `completedAtISO`는 **반드시 undefined**
  - **UNIQUE(중복 방지)**: `(clientId, dateISO, difficulty)` 조합은 1개만 존재해야 한다

- **localStorage**
  - 키: `fvq_daily_sessions_v2`
  - Shape(= 인덱스/UNIQUE 강제 구조):
    ```ts
    export type DailySessionUniqueKey = `${string}:${ISODateString}:${Difficulty}`; 
    // `${clientId}:${dateISO}:${difficulty}`

    export type DailyQuizSessionStoreV2 = {
      byUniqueKey: Record<DailySessionUniqueKey, DailyQuizSession>;
    };
    ```
  - 조회/저장은 항상 `uniqueKey = "${clientId}:${dateISO}:${difficulty}"`로 수행 (O(1) “인덱스”)

- **ON DELETE (localStorage 등가 규칙)**
  - 사용자가 데이터 초기화로 `fvq_user_progress_v2`가 삭제/재생성되면,
    - `fvq_daily_sessions_v2`는 **전체 삭제**되어야 한다(캐스케이드)

---

## 4) WrongAnswerItem (v2: PK/UNIQUE/FK/타임스탬프)

```ts
export interface WrongAnswerItem extends EntityBase {
  clientId: string; // FK -> UserProgress.clientId
  questionId: string; // FK(논리) -> QuizQuestion.id

  firstWrongAtISO: ISODateTimeString;
  lastWrongAtISO: ISODateTimeString;

  wrongCount: number; // 1 이상
  lastSelectedIndex: 0 | 1 | 2 | 3;
  difficulty: Difficulty;
}
```

- **Constraints**
  - `id` 존재
  - `clientId`는 반드시 존재하고 `fvq_user_progress_v2.id`와 동일해야 한다 (FK)
  - `wrongCount >= 1`
  - **UNIQUE(중복 방지)**: `(clientId, questionId)`는 1개만 존재해야 한다
  - 최대 200개까지만 저장(초과 시 `lastWrongAtISO` 가장 오래된 항목부터 제거)

- **localStorage**
  - 키: `fvq_wrong_answers_v2`
  - Shape(= UNIQUE/인덱스 강제 구조):
    ```ts
    export type WrongAnswerUniqueKey = `${string}:${string}`; // `${clientId}:${questionId}`

    export type WrongAnswersStoreV2 = {
      byUniqueKey: Record<WrongAnswerUniqueKey, WrongAnswerItem>;
    };
    ```
  - `byUniqueKey`의 object key가 곧 `(clientId, questionId)` 인덱스/UNIQUE 역할 (O(1))

- **ON DELETE (localStorage 등가 규칙)**
  - `fvq_user_progress_v2` 삭제/재생성 시 `fvq_wrong_answers_v2`는 **전체 삭제**되어야 한다(캐스케이드)

---

## 5) WeeklyLeaderboardEntry (Client Cache + Server DB 계약 정규화)

### Client Type (캐시용)

```ts
export interface WeeklyLeaderboardEntry extends EntityBase {
  weekId: string; // "YYYY-WW" (ISO week)
  clientId: string; // FK(논리) -> UserProgress.clientId
  nickname: string;
  weeklyIqDelta: number; // 해당 주에 획득한 IQ 합
}
```

- **localStorage (캐시)**
  - 키: `fvq_leaderboard_cache_v2`
  - Shape:
    ```ts
    export type WeeklyLeaderboardCacheV2 = {
      [weekId: string]: {
        fetchedAtISO: ISODateTimeString;
        entries: WeeklyLeaderboardEntry[];
      };
    };
    ```
  - 주당 엔트리 배열은 서버 정렬 그대로 보존

- **Index**
  - `cache[weekId]` 키 조회가 곧 weekId 인덱스 (O(1))

---

# External API Server (Railway 등 별도 배포) — DB 스키마(계약, v2)

> 목적: API 응답의 엔트리 필드가 DB 컬럼과 1:1 매핑되도록 명시(불일치 방지)  
> 미니앱에는 서버 코드 포함하지 않음

## Tables

### 1) `clients`
- `id` (PK, text/uuid)  ✅ (NEW)
- `client_id` (UNIQUE, text/uuid)  *(미니앱의 clientId; 마이그레이션/호환 목적)*
- `created_at_iso` (text, ISO) ✅
- `updated_at_iso` (text, ISO) ✅

**Indexes**
- UNIQUE INDEX: `client_id`

### 2) `weekly_leaderboard_entries`
- `id` (PK, text/uuid) ✅ (NEW)
- `week_id` (text) — `"YYYY-WW"`
- `client_id` (text, FK → `clients.client_id`)
- `nickname` (text)
- `weekly_iq_delta` (integer, >= 0)
- `rank` (integer, >= 1)
- `created_at_iso` (text, ISO) ✅ (NEW)
- `updated_at_iso` (text, ISO)

**Constraints**
- UNIQUE(`week_id`, `client_id`) ✅
- FK(`client_id`) REFERENCES `clients(client_id)` **ON DELETE CASCADE** ✅

**Indexes**
- INDEX: (`week_id`)
- INDEX: (`client_id`)
- INDEX: (`week_id`, `weekly_iq_delta` DESC, `updated_at_iso` ASC, `client_id` ASC) *(정렬 최적화 목적)*

---

# API (v2 계약)

## 공통
- Base Path: `/leaderboard`
- Content-Type: `application/json; charset=utf-8`
- 모든 시간은 ISO string 사용

## 에러 응답 바디(공통)
```json
{
  "error": {
    "code": "VALIDATION_ERROR | RATE_LIMITED | NOT_FOUND | INTERNAL_ERROR",
    "message": "string"
  }
}
```

---

## 1) 주간 랭킹 조회 (List + Pagination)
**GET** `/leaderboard/weekly`

### Query
- `weekId` (required): `"YYYY-WW"`
- `limit` (optional): number, `1~100`, default `100`
- `cursor` (optional): string (opaque)

### Success Response — 200 (UPDATED: id/createdAtISO/updatedAtISO 포함)
```json
{
  "entries": [
    {
      "id": "uuid",
      "weekId": "2026-29",
      "clientId": "uuid",
      "nickname": "투자초보",
      "weeklyIqDelta": 120,
      "createdAtISO": "2026-07-14T12:00:00.000Z",
      "updatedAtISO": "2026-07-14T12:34:56.000Z"
    }
  ]
}
```

### Pagination Contract (응답 헤더)
- `X-Next-Cursor`: string (다음 페이지가 있으면 포함, 없으면 헤더 없음)
- `X-Has-Next`: `"1"` | `"0"` (항상 포함)
- 정렬 기준(고정):
  1) `weeklyIqDelta` 내림차순
  2) `updatedAtISO` 오름차순
  3) `clientId` 오름차순

### Error Status Codes
- `400`: `weekId` 포맷 오류, `limit` 범위 오류 등
- `404`: `weekId`가 서버 정책상 유효하지 않거나 조회 불가일 때
- `429`: 과다 요청 (`code=RATE_LIMITED`)
- `500`: 서버 내부 오류

---

## 2) 주간 점수 제출(업서트) + rank 반환
**POST** `/leaderboard/weekly/submit`

### Request Body
```json
{
  "weekId": "2026-29",
  "clientId": "uuid",
  "nickname": "투자초보",
  "weeklyIqDelta": 25
}
```

### Validation
- `weekId`: `"YYYY-WW"` 형식
- `clientId`: 비어있지 않은 문자열
- `nickname`: 길이 `2~10`
- `weeklyIqDelta`: integer, `>= 0`

### Server-side Upsert Rule
- 동일 `(weekId, clientId)`가 이미 존재하면:
  - `weekly_iq_delta = weekly_iq_delta + request.weeklyIqDelta`
  - `nickname = request.nickname`
  - `updated_at_iso = now()`
  - `rank`는 해당 주 전체 데이터 기준으로 재계산하여 저장(스냅샷)

### Success Response — 200 (UPDATED: entry에 id/createdAtISO/updatedAtISO 포함)
```json
{
  "weekId": "2026-29",
  "entry": {
    "id": "uuid",
    "weekId": "2026-29",
    "clientId": "uuid",
    "nickname": "투자초보",
    "weeklyIqDelta": 125,
    "createdAtISO": "2026-07-14T12:00:00.000Z",
    "updatedAtISO": "2026-07-14T12:34:56.000Z"
  },
  "rank": 12
}
```

---

# Feature List (AC 업데이트: v2 키/필드 반영)

## F1. 문제은행 로드 + 오늘의 3문제 세션 생성

### Description
앱은 번들에 포함된 금융 용어 문제은행을 로드하고, 사용자가 선택한 난이도에 따라 “오늘의 3문제”를 결정한다. 같은 날짜/난이도에서는 항상 동일한 3문제가 선택되어야 하며, 세션은 localStorage에 저장된다.

### Data
`QuizQuestion`, `DailyQuizSession`, `UserProgress`

### Requirements

#### AC-1 [U][P0]: Scenario: 세션 생성 규칙(3문항 고정)
- Given localStorage에 `fvq_daily_sessions_v2`가 없거나 `byUniqueKey["<clientId>:2026-07-14:BEGINNER"]`가 없을 때
- And localStorage `fvq_user_progress_v2.id`가 `"uuid-A"`일 때
- When 사용자가 난이도 `"BEGINNER"`로 오늘의 퀴즈 시작을 탭할 때
- Then 시스템은 `questionIds.length === 3`인 `DailyQuizSession`을 생성해야 한다
- And 생성된 세션의 `id`가 빈 문자열이 아니어야 한다
- And 생성된 세션의 `sessionId`는 `id`와 동일해야 한다
- And 생성된 세션의 `clientId`는 `"uuid-A"`와 동일해야 한다(FK 일치)
- And 생성된 세션은 localStorage `fvq_daily_sessions_v2.byUniqueKey["uuid-A:2026-07-14:BEGINNER"]`에 저장되어야 한다
- And 저장된 세션은 `createdAtISO`와 `updatedAtISO`가 ISO timestamp string이어야 한다

#### AC-2 [E][P0]: Scenario: 동일 날짜/난이도 재진입 시 동일 세션 재사용(UNIQUE 보장)
- Given localStorage `fvq_daily_sessions_v2.byUniqueKey["uuid-A:2026-07-14:BEGINNER"]`가 `{ status: "IN_PROGRESS" }`로 저장되어 있을 때
- When 사용자가 `"2026-07-14"`에 다시 퀴즈 화면으로 이동할 때
- Then 시스템은 새 세션을 생성하지 않고 `fvq_daily_sessions_v2.byUniqueKey["uuid-A:2026-07-14:BEGINNER"].id`를 그대로 사용해야 한다

#### AC-3 [W][P1]: Scenario: 문제은행 부족 시 시작 차단
- Given `"ADVANCED"` 난이도 문제 수가 3개 미만일 때
- When 사용자가 난이도 `"ADVANCED"`로 오늘의 퀴즈 시작을 탭할 때
- Then 에러 메시지 `"문제가 아직 준비되지 않았어요"`가 표시되어야 한다
- And 퀴즈 화면으로 navigate되지 않아야 한다

#### AC-4 [W][P1]: Scenario: localStorage 저장 실패(QuotaExceededError) 처리
- Given 브라우저가 localStorage 쓰기에서 `QuotaExceededError`를 발생시키는 상태일 때
- When 시스템이 오늘의 세션을 `fvq_daily_sessions_v2`에 저장하려고 할 때
- Then AlertDialog에 제목 `"저장 공간이 부족해요"`와 본문 `"기기 저장 공간을 확인해주세요"`가 표시되어야 한다
- And 세션은 메모리 상태에서만 유지되고 앱 재시작 시 복원되지 않아야 한다

#### AC-5 [S][P1]: Scenario: 세션 생성 중 로딩 상태 표시
- Given 사용자가 오늘의 퀴즈 시작을 탭했을 때
- While 세션을 생성/저장 중일 때
- Then 시작 버튼은 `disabled=true`여야 한다
- And 화면에 `TDS Loader`(또는 Progress 컴포넌트)가 표시되어야 한다

---

## F2. 퀴즈 진행(4지선다) + 정답/오답 기록

### Data
`DailyQuizSession`, `WrongAnswerItem`

### Requirements

#### AC-1 [E][P0]: Scenario: 보기 선택 후 다음 문항으로 진행
- Given `DailyQuizSession.answers.length === 0`이고 1번 문항이 화면에 표시될 때
- When 사용자가 보기 인덱스 `2`를 탭할 때
- Then 시스템은 `answers`에 아래 객체를 1개 추가해야 한다
  - `{ questionId: "<currentQuestionId>", selectedIndex: 2, isCorrect: (<currentCorrectIndex> === 2) }`
- And 2번 문항 화면으로 전환되어야 한다
- And 세션의 `updatedAtISO`는 탭 이전 값과 달라야 한다

#### AC-2 [E][P0]: Scenario: 오답 저장(틀린 문제 누적, UNIQUE 보장)
- Given 사용자가 문항 `"q_0007"`에서 오답을 선택했을 때(`isCorrect=false`)
- When 시스템이 답안을 확정할 때
- Then localStorage `fvq_wrong_answers_v2.byUniqueKey["<clientId>:q_0007"]`가 존재해야 한다
- And 해당 항목의 `id`는 빈 문자열이 아니어야 한다
- And 해당 항목의 `clientId`는 localStorage `fvq_user_progress_v2.id`와 동일해야 한다
- And 해당 항목의 `wrongCount`는 1 이상이어야 한다
- And 동일한 `<clientId>:q_0007` 키로 **2개 이상**의 항목이 저장되어서는 안 된다(오직 1개)

#### AC-3 [W][P1]: Scenario: 중복 탭으로 답안 2회 기록 방지
- Given 1번 문항에서 사용자가 보기 탭을 연속으로 2회 수행할 때(200ms 이내)
- When 두 번째 탭 이벤트가 들어올 때
- Then 시스템은 `answers.length`를 1 이상으로 증가시키지 않아야 한다(정확히 1개만 기록)

#### AC-4 [W][P1]: Scenario: 세션 상태 불일치(질문ID 누락) 에러 처리
- Given 세션의 `questionIds` 중 `"q_missing"`가 문제은행에 존재하지 않을 때
- When 해당 문항을 렌더링하려고 할 때
- Then 에러 메시지 `"문제를 불러올 수 없어요"`가 표시되어야 한다
- And `"홈으로"` 버튼 탭 시 `navigate('/', { state: { recovered: true } })`가 실행되어야 한다

#### AC-5 [S][P1]: Scenario: 문항 로딩 상태
- Given 퀴즈 화면 진입 직후 질문 데이터를 매핑 중일 때
- While 현재 문항 데이터가 준비되지 않았을 때
- Then `TDS Loader`가 표시되어야 한다
- And 보기 버튼(4개)은 렌더링되지 않아야 한다

---

## F3. 오늘의 결과 요약 + 해설(보상형 광고 게이트)

### Requirements

#### AC-1 [E][P0]: Scenario: 퀴즈 완료 시 결과 화면 이동 (completedAtISO 일관성 반영)
- Given 사용자가 3번째 문항의 보기를 선택했을 때
- When 시스템이 `answers.length === 3`을 만족할 때
- Then 세션 `status`는 `"COMPLETED"`로 저장되어야 한다
- And 세션 `completedAtISO`는 ISO timestamp string으로 저장되어야 한다
- And 세션의 `updatedAtISO`는 완료 처리 직전 값과 달라야 한다
- And `navigate('/result', { state: { sessionId: "<savedSessionId>" } })`가 호출되어야 한다

#### AC-2 [E][P0]: Scenario: 해설 보기 전 보상형 광고 게이트
- Given 결과 화면에서 해설 섹션이 `<TossRewardAd>`로 감싸져 있을 때
- When 사용자가 `"해설 보기"` 버튼을 탭하고 보상형 광고 시청이 완료될 때
- Then 해설 카드 리스트(3개)가 화면에 표시되어야 한다

#### AC-3 [W][P1]: Scenario: 보상형 광고 실패/취소 시 해설 비공개
- Given 결과 화면에서 `"해설 보기"`를 탭했을 때
- When 보상형 광고가 실패하거나 사용자가 닫아 종료할 때
- Then 해설 카드 리스트는 표시되지 않아야 한다
- And 토스트 `"광고 시청 후 해설을 볼 수 있어요"`가 표시되어야 한다

#### AC-4 [W][P1]: Scenario: 잘못된 sessionId로 결과 진입 시 처리
- Given 사용자가 `navigate('/result', { state: { sessionId: "invalid_session" } })`로 진입했을 때
- When 시스템이 localStorage `fvq_daily_sessions_v2`에서 해당 `sessionId`를 역으로 찾지 못할 때
- Then 에러 메시지 `"결과를 불러올 수 없어요"`가 표시되어야 한다
- And `"홈으로"` 버튼 탭 시 `navigate('/')`가 실행되어야 한다

#### AC-5 [S][P1]: Scenario: 결과 로딩 상태
- Given 결과 화면 진입 직후 `sessionId`로 세션을 읽는 중일 때
- While 세션 데이터가 준비되지 않았을 때
- Then `TDS Loader`가 표시되어야 한다

#### AC-6 [U][P0]: Scenario: 결과 화면 레이아웃 계약(data-testid 포함)
- Given 결과 화면이 정상 렌더링될 때
- Then `data-testid="result-summary-card"`인 `TDS Card`가 정확히 1개 존재해야 한다
- And `data-testid="explanation-section"` 컨테이너가 존재해야 한다

---

## F4. 금융 IQ 누적 + 스트릭(연속 출석) 계산
- (기능 동작은 변경 없음)
- 단, `UserProgress.updatedAtISO`는 아래 이벤트마다 갱신되어야 한다:
  - 퀴즈 완료로 `iqTotal`/`streak` 변경 시
  - 닉네임 변경 시
  - 데이터 초기화/재생성 시

---

## F5. 틀린 문제 복습 모드(목록 + 재도전)
- (기능 동작은 변경 없음)
- 단, WrongAnswerItem 조회는 `fvq_wrong_answers_v2.byUniqueKey`를 사용하며,
  - 현재 `fvq_user_progress_v2.id`와 `WrongAnswerItem.clientId`가 다른 항목은 UI 구성에서 제외해야 한다

---

## F6. 주간 랭킹(익명 닉네임) + 서버 동기화 (API 계약 v2 반영)

### Requirements (변경: 캐시 키 v2 + entry 필드 v2)

#### AC-1 [E][P0]: Scenario: 랭킹 로딩 성공
- Given 사용자가 `navigate('/leaderboard')`로 진입했을 때
- When 서버가 `200`과 `{ entries: [...] }`를 반환할 때
- Then 화면에 `TDS ListRow`로 상위 100개 이내 엔트리가 렌더링되어야 한다
- And localStorage `fvq_leaderboard_cache_v2["2026-29"]`가 저장되어야 한다
- And 저장된 캐시의 각 entry는 `id`, `createdAtISO`, `updatedAtISO`를 모두 포함해야 한다

#### AC-2 [S][P1]: Scenario: 랭킹 로딩 상태
- Given 사용자가 랭킹 화면에 진입했을 때
- While `GET /leaderboard/weekly` 응답을 기다리는 동안
- Then `TDS Loader`가 표시되어야 한다

#### AC-3 [W][P1]: Scenario: 네트워크 에러 시 캐시 폴백
- Given 서버 요청이 실패하고(`fetch` reject) localStorage 캐시에 `"2026-29"` entries가 존재할 때
- When 랭킹 화면이 데이터를 구성할 때
- Then 캐시 데이터를 화면에 렌더링해야 한다
- And 상단에 텍스트 `"네트워크 오류로 캐시를 표시했어요"`가 표시되어야 한다

#### AC-4 [W][P1]: Scenario: 캐시도 없을 때 빈 상태
- Given 서버 요청이 실패하고 캐시도 없을 때
- When 랭킹 화면이 렌더링될 때
- Then `Asset.ContentIcon`과 텍스트 `"랭킹을 불러올 수 없어요"`가 표시되어야 한다
- And `"다시 시도"` 버튼 탭 시 동일 `GET /leaderboard/weekly` 요청이 1회 재시도되어야 한다

#### AC-5 [E][P0]: Scenario: 퀴즈 완료 후 주간 점수 제출
- Given 사용자가 `"2026-07-14"` 퀴즈를 완료하여 `iqDelta=25`를 획득했을 때
- When 시스템이 `POST /leaderboard/weekly/submit`에 `{ clientId, nickname, weekId: "2026-29", weeklyIqDelta: 25 }`를 전송할 때
- Then 서버가 `200`과 `{ rank: 12 }`를 반환하면 결과 화면에 텍스트 `"이번 주 랭킹 12위"`가 표시되어야 한다

#### AC-6 [W][P1]: Scenario: 닉네임 미설정 시 제출 차단
- Given `UserProgress.nickname === ""` 또는 존재하지 않을 때
- When 시스템이 랭킹 제출을 시도할 때
- Then 제출 요청이 발생하지 않아야 한다
- And BottomSheet로 `"닉네임을 설정해 주세요"`가 표시되어야 한다

#### AC-7 [U][P1]: Scenario: CORS 에러 0개(서버 계약)
- Given 클라이언트가 `GET /leaderboard/weekly`를 호출할 때
- Then 서버 응답 헤더에 `Access-Control-Allow-Origin: *`가 포함되어야 한다
- And 브라우저 콘솔에 CORS 에러가 출력되지 않아야 한다

#### AC-8 [W][P1][HTTP 401]: Scenario: Toss 로그인 세션 확인 불가 시 랭킹 접근 차단
- Given `getIsTossLoginIntegratedService()`가 `false`를 반환하는 환경일 때
- When 사용자가 `navigate('/leaderboard')`로 진입했을 때
- Then 에러 메시지 `"로그인이 필요해요"`가 표시되어야 한다
- And `"홈으로"` 버튼이 표시되어야 한다
- And `"홈으로"` 버튼 탭 시 `navigate('/')`가 실행되어야 한다
- And `GET /leaderboard/weekly` 네트워크 요청은 **0회** 발생해야 한다

---

## F7. 닉네임 설정 + 데이터 초기화 + 정책 준수 가드

#### AC-NEW-1 [W][P0][HTTP 400]: Scenario: 닉네임 길이 제약(2~10자) 위반 시 저장 차단
- Given 사용자가 닉네임 설정 화면(또는 BottomSheet)에서 `nickname` 입력을 완료했을 때
- When 사용자가 `"저장"` 버튼을 탭했는데 `nickname.trim().length < 2` 또는 `nickname.trim().length > 10`일 때
- Then AlertDialog에 제목 `"닉네임을 저장할 수 없어요"`가 표시되어야 한다
- And AlertDialog 본문은 정확히 `"닉네임은 2~10자여야 해요"`여야 한다
- And localStorage `fvq_user_progress_v2.nickname` 값은 **변경되지 않아야 한다**
- And AlertDialog 확인 버튼 탭 후에도 사용자는 동일 화면에 머물러야 한다(라우트 변경 없음)

#### AC-NEW-2 [W][P1][HTTP 400]: Scenario: localStorage 데이터 파손(JSON 파싱 실패/스키마 불일치) 시 복구
- Given localStorage `fvq_user_progress_v2` 값이 아래 중 하나인 상태일 때  
  1) JSON 파싱이 불가능한 문자열(예: `"{"`)  
  2) JSON 파싱은 되지만 `UserProgress` 스키마를 만족하지 않는 값(예: `iqTotal`이 number가 아닌 string)
- When 사용자가 앱을 실행하여 홈 화면(`/`)이 최초 렌더링을 시도할 때
- Then AlertDialog에 제목 `"저장된 데이터를 읽을 수 없어요"`가 표시되어야 한다
- And AlertDialog 본문은 정확히 `"데이터를 초기화할게요"`여야 한다
- And 사용자가 AlertDialog 확인 버튼을 탭하면 localStorage 키 `fvq_user_progress_v2`은 **삭제(removeItem)** 되어야 한다
- And 삭제 이후 `fvq_user_progress_v2`에는 **새로 생성된** `UserProgress`가 저장되어야 한다(새 `clientId` 포함)
- And 앱은 크래시 없이 홈 화면 UI를 계속 렌더링해야 한다
- And 프로덕션 동작 기준으로 `console.error` 호출은 **0회**여야 한다

> 데이터 초기화 시 캐스케이드(ON DELETE 등가):
- `fvq_user_progress_v2` 재생성 직후, `fvq_daily_sessions_v2`, `fvq_wrong_answers_v2`, `fvq_leaderboard_cache_v2`는 모두 삭제되어야 한다.

---

## F8. 광고 배치(배너) + 결과/랭킹 화면 수익화 동선
- (변경 없음)

---

# Assumptions
- 앱은 번들에 포함된 정적 문제은행을 최소 60문항(난이도별 최소 20문항) 이상 포함한다.
- 날짜 기준(`dateISO`)은 사용자 디바이스 로컬 타임존의 “오늘”을 사용한다.
- 외부 랭킹 API 서버는 Railway 등 별도 배포이며, CORS `Access-Control-Allow-Origin: *`를 제공한다.
- 주간 랭킹은 “주간 획득 IQ 합(weeklyIqDelta)” 기준 내림차순 정렬이다.

---

# Open Questions
1. “난이도별 문제 분류”에서 사용자가 **하루에 난이도 1개만 선택** vs 난이도별로 3문제씩 제공 정책 확인 필요
2. 결과 해설 게이팅: **해설 전체 1회 광고** vs 문항별 광고
3. 주간 랭킹: 상위 100 노출만으로 충분한지, 내 주변 노출 필요 여부
4. 문제은행 콘텐츠 출처/저작권 고지 필요 여부(외부 링크 없이 앱 내 텍스트만)

---

## (추가) 스키마 이슈 대응 체크리스트 — 본 v2에서의 충족 방식

- **표준 PK + timestamps**: 모든 엔터티에 `id/createdAtISO/updatedAtISO` 포함
- **FK**: `DailyQuizSession.clientId`, `WrongAnswerItem.clientId`는 `UserProgress.id(=clientId)`와 동일해야 함(런타임 검증)
- **UNIQUE**
  - DailyQuizSession: `fvq_daily_sessions_v2.byUniqueKey["clientId:dateISO:difficulty"]` 1개만 존재
  - WrongAnswerItem: `fvq_wrong_answers_v2.byUniqueKey["clientId:questionId"]` 1개만 존재
  - Server DB: UNIQUE(week_id, client_id)
- **Indexes**
  - localStorage는 DB 인덱스가 없으므로, `Record` 키를 인덱스로 사용(O(1) 조회)
  - Server DB는 week_id/client_id/정렬 인덱스 명시
- **ON DELETE**
  - localStorage는 “데이터 초기화” 시 캐스케이드 삭제로 등가 보장
  - Server DB는 FK ON DELETE CASCADE 명시

원하시면, 위 v2 스키마를 기준으로 **기존 v1 데이터(키/shape)에서 v2로 마이그레이션 규칙(자동 변환 vs 초기화)**까지 AC로 추가해 드릴까요?