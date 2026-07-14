# TASK

## Epic 1. TypeScript types + interfaces
### Risk Analysis
- Complexity: **Low**
- Risk factors: 페이지 간 `navigate()/location.state` 계약 불일치로 런타임 크래시/데이터 누락
- Mitigation: **가장 먼저 `RouteState`를 단일 타입으로 고정**하고 이후 모든 페이지에서 이를 import/캐스팅하도록 강제

### Task 1.1 `src/lib/types.ts` — v2 스키마 타입 + RouteState 계약 정의
- Description:
  - SPEC v2의 모든 엔터티/스토어/유니크키/리더보드 API DTO 타입과 **RouteState**를 `src/lib/types.ts`에 정의(런타임 코드 금지).
- DoD:
  - `src/lib/types.ts`에 아래가 **모두 export** 되어야 함(이름 동일):
    - 공통: `ISODateTimeString`, `ISODateString`, `Difficulty`, `EntityBase`
    - 엔터티: `QuizQuestion`, `UserProgress`, `DailyQuizSession`, `WrongAnswerItem`, `WeeklyLeaderboardEntry`
    - 스토어/키: `DailySessionUniqueKey`, `DailyQuizSessionStoreV2`, `WrongAnswerUniqueKey`, `WrongAnswersStoreV2`, `WeeklyLeaderboardCacheV2`
    - API DTO: `GetWeeklyLeaderboardResponse`, `SubmitWeeklyLeaderboardRequest`, `SubmitWeeklyLeaderboardResponse`
    - **RouteState**(필수): 아래 키를 포함해야 함  
      ```ts
      export type RouteState = {
        "/": { recovered?: boolean } | undefined;
        "/quiz": { difficulty: Difficulty } | undefined;
        "/result": { sessionId: string };
        "/review": undefined;
        "/leaderboard": undefined;
        "/settings": undefined;
      };
      ```
  - `tsc` 타입 에러 0개
- Covers: []
- Files: [`src/lib/types.ts`]
- Depends on: none

---

## Epic 2. Data layer (storage helpers, state management)
### Risk Analysis
- Complexity: **Medium**
- Risk factors:
  - localStorage JSON 파손/스키마 불일치로 초기 렌더 크래시
  - QuotaExceededError 처리 누락 시 저장 시점 UX/데이터 유실
  - UNIQUE/FK 규칙이 분산 구현되면 무결성 깨짐
- Mitigation:
  - (1) 안전한 storage 래퍼 → (2) 엔터티별 CRUD/UNIQUE 구조 → (3) 스토어에서만 “업무 규칙” 조합 적용 순으로 분리

### Task 2.1 `src/lib/time.ts`, `src/lib/id.ts` — 날짜/주차/ID 유틸(순수함수)
- Description:
  - 로컬 기준 `dateISO`, ISO week 기반 `weekId`, `nowISO`, `createId` 유틸을 구현한다.
- DoD:
  - `getLocalDateISO(now?: Date)`가 로컬 타임존 기준 `"YYYY-MM-DD"` 반환
  - `getISOWeekId(date: Date)`가 `"YYYY-WW"`(WW 2자리) 반환
  - `nowISO()`가 ISO timestamp string 반환
  - `createId(prefix?: string)`가 빈 문자열이 아닌 id 반환
  - 어떤 코드 경로에서도 `console.error` 호출이 추가되지 않음
- Covers: [F1-AC1, F6-AC5]
- Files: [`src/lib/time.ts`, `src/lib/id.ts`]
- Depends on: Task 1.1

### Task 2.2 `src/lib/storage/safeStorage.ts` — localStorage 안전 read/write (JSON 파손/Quota 구분)
- Description:
  - localStorage get/set/remove를 감싼 안전 래퍼를 구현하고, JSON 파손과 QuotaExceeded를 호출자에게 “결과값”으로 리턴한다(throw 금지).
- DoD:
  - `safeGetJSON<T>(key)`:
    - 성공 시 `{ ok: true, value: T | null }`
    - JSON parse 실패 시 `{ ok: false, error: "CORRUPTED" }`
  - `safeSetJSON(key, value)`:
    - QuotaExceededError 시 `{ ok: false, error: "QUOTA_EXCEEDED" }`
    - 기타 예외 시 `{ ok: false, error: "UNKNOWN" }`
  - 모든 함수는 예외를 throw하지 않음
  - `console.error`를 호출하지 않음
- Covers: [F1-AC4, F7-AC-NEW-2]
- Files: [`src/lib/storage/safeStorage.ts`]
- Depends on: Task 1.1

### Task 2.3 `src/lib/storage/userProgress.ts` — UserProgress CRUD + 스키마 검증 + 캐스케이드 reset
- Description:
  - `fvq_user_progress_v2` 로드/생성/저장/닉네임 업데이트/전체 초기화(캐스케이드 삭제 후 재생성)를 구현한다.
- DoD:
  - `loadOrCreateUserProgress()`가:
    - 키 없음 → 새 `UserProgress` 생성 후 저장하고 반환
    - JSON 파손/스키마 불일치 → `{ ok:false, reason:"CORRUPTED" }` 반환(throw 금지)
  - 새 생성 시:
    - `id === clientId`
    - `createdAtISO/updatedAtISO` 포함(ISO timestamp string)
    - `iqTotal/streak` 값들이 0 이상
  - `updateUserNickname(nextNickname: string)`:
    - `trim().length`가 2~10이 아니면 저장하지 않고 `{ ok:false, reason:"INVALID_NICKNAME" }`
    - 성공 시 `updatedAtISO`가 이전 값과 달라야 함
  - `resetAllDataAndRecreateUserProgress()`가 다음 키를 **removeItem로 삭제** 후 새 UserProgress 저장:
    - `fvq_user_progress_v2`, `fvq_daily_sessions_v2`, `fvq_wrong_answers_v2`, `fvq_leaderboard_cache_v2`
- Covers: [F4, F7-AC-NEW-1, F7-AC-NEW-2]
- Files: [`src/lib/storage/userProgress.ts`]
- Depends on: Task 2.2, Task 2.1, Task 1.1

### Task 2.4 `src/lib/storage/dailySessions.ts` — DailyQuizSession store CRUD (UNIQUE key + sessionId 역조회)
- Description:
  - `fvq_daily_sessions_v2`를 `byUniqueKey` 구조로 저장/조회하며 UNIQUE를 구조적으로 강제한다.
- DoD:
  - `makeDailySessionUniqueKey(clientId, dateISO, difficulty)`가 `${clientId}:${dateISO}:${difficulty}` 반환
  - `getSessionByUniqueKey(uniqueKey)`가 해당 키 세션 또는 null 반환(O(1))
  - `upsertSessionByUniqueKey(uniqueKey, session)`이 동일 키에 **항상 1개만** 저장되도록 동작
  - `findSessionBySessionId(sessionId)`가 `byUniqueKey`를 스캔하여 최초 1개 찾으면 반환, 없으면 null
  - 저장이 QuotaExceeded이면 throw 없이 `{ ok:false, error:"QUOTA_EXCEEDED" }`로 반환
- Covers: [F1-AC1, F1-AC2, F3-AC4]
- Files: [`src/lib/storage/dailySessions.ts`]
- Depends on: Task 2.2, Task 1.1

### Task 2.5 `src/lib/storage/wrongAnswers.ts` — WrongAnswer 업서트(UNIQUE) + 200개 cap + clientId 필터
- Description:
  - `fvq_wrong_answers_v2.byUniqueKey` 기반으로 오답을 누적 기록하고(UNIQUE 보장), 200개 초과 시 오래된 항목부터 제거한다.
- DoD:
  - `makeWrongAnswerUniqueKey(clientId, questionId)` 구현
  - `recordWrongAnswer(...)`가:
    - 없으면 새 WrongAnswerItem 생성(`wrongCount=1`, id 비어있지 않음)
    - 있으면 `wrongCount+1`, `lastWrongAtISO/lastSelectedIndex` 갱신
    - 결과적으로 `byUniqueKey[clientId:questionId]`는 **항상 1개만 존재**
  - 전체 항목 수가 200 초과 시 `lastWrongAtISO`가 가장 오래된 순으로 제거하여 200 유지
  - `listWrongAnswersForClient(clientId)`가 다른 clientId 항목을 반환 배열에서 제외
- Covers: [F2-AC2, F5]
- Files: [`src/lib/storage/wrongAnswers.ts`]
- Depends on: Task 2.2, Task 1.1

### Task 2.6 `src/lib/storage/leaderboardCache.ts` — 주간 랭킹 캐시 read/write
- Description:
  - `fvq_leaderboard_cache_v2`의 weekId 단위 캐시 read/write 헬퍼를 구현한다.
- DoD:
  - `getLeaderboardCache(weekId)`가 없으면 null 반환
  - `setLeaderboardCache(weekId, entries, fetchedAtISO)`가 SPEC shape로 저장(성공/실패 결과 리턴)
- Covers: [F6-AC1, F6-AC3, F6-AC4]
- Files: [`src/lib/storage/leaderboardCache.ts`]
- Depends on: Task 2.2, Task 1.1

### Task 2.7 `src/lib/api/leaderboard.ts` — 리더보드 API 클라이언트(GET/POST)
- Description:
  - 외부 서버와 통신하는 fetch 클라이언트를 구현한다(서버 코드는 작성하지 않음).
- DoD:
  - `fetchWeeklyLeaderboard({ weekId, limit, cursor })`가:
    - `${import.meta.env.VITE_LEADERBOARD_BASE_URL}/leaderboard/weekly?...`로 GET
    - 200이면 body의 `{ entries }` 파싱 + 헤더 `X-Has-Next`, `X-Next-Cursor` 파싱해 반환
    - 실패는 throw 없이 `{ ok:false, status?, errorCode? }` 형태로 반환
  - `submitWeeklyLeaderboard(req)`가 POST `/leaderboard/weekly/submit` 호출 후 200 응답 파싱
  - `fetch`에 `mode: "no-cors"`를 사용하지 않음
  - 어떤 실패 경로에서도 `console.error` 호출 0회
- Covers: [F6-AC1, F6-AC5, F6-AC7]
- Files: [`src/lib/api/leaderboard.ts`]
- Depends on: Task 1.1

### Task 2.8 `src/lib/quizBank/index.ts` — 문제은행 런타임 인덱스(byId/byDifficulty)
- Description:
  - 번들 문제은행을 로드하고 `Record<id, QuizQuestion>`/난이도별 배열 인덱스를 생성한다.
- DoD:
  - `getQuizBankIndex()`가 `{ byId, byDifficulty }` 반환
  - `byId[id]` O(1) 조회 가능
  - `byDifficulty[difficulty].length`로 “3개 미만” 판정 가능
  - 중복 id 발견 시 throw 없이 “마지막 값 우선”으로 계속 반환(앱 크래시 금지)
- Covers: [F1-AC3, F2-AC4]
- Files: [`src/lib/quizBank/index.ts`]
- Depends on: Task 1.1

### Task 2.9 `src/lib/quiz/sessionFactory.ts` — 결정적 3문항 선택 + DailyQuizSession 생성
- Description:
  - `(clientId, dateISO, difficulty)`에 대해 항상 동일한 3문항이 선택되도록 결정적 선택 로직을 구현하고 세션 객체를 만든다.
- DoD:
  - `pickDailyQuestionIds({ clientId, dateISO, difficulty, pool })`가:
    - pool 길이 >= 3이면 길이 3 튜플 반환
    - 같은 입력이면 항상 같은 결과 반환
  - `createDailyQuizSession(...)`가:
    - `id` 빈 문자열 아님
    - `sessionId === id`
    - `clientId` 설정, `questionIds.length === 3`
    - `status: "IN_PROGRESS"`, `completedAtISO`는 undefined
    - `createdAtISO/updatedAtISO/startedAtISO` 포함
- Covers: [F1-AC1, F1-AC2]
- Files: [`src/lib/quiz/sessionFactory.ts`]
- Depends on: Task 2.1, Task 2.8, Task 1.1

### Task 2.10 `src/store/*` — AppStore(부트스트랩/복구 + 세션/오답/완료 처리)
- Description:
  - Context 기반 스토어로 다음을 제공:
    - 앱 시작 시 UserProgress 로드/파손 감지 상태 제공
    - 오늘 세션 시작(UNIQUE 재사용/생성/Quota 처리)
    - 답안 기록(중복탭 방지) + 오답 누적 + 완료 처리(COMPLETED 저장)
    - 완료 시 iqTotal/streak/userProgress.updatedAtISO 갱신
- DoD:
  - `AppStoreProvider` + `useAppStore()` export, 앱이 컴파일됨
  - 부트스트랩 상태:
    - `userProgress` 또는 `needsRecoveryDialog: true` 제공
  - `startTodaySession(difficulty)`:
    - UNIQUE key 기존 세션 있으면 재사용(F1-AC2)
    - 없으면 생성 후 저장 시도(F1-AC1)
    - 저장 QuotaExceeded면 `quotaExceededForSession: true` 상태를 세팅하고 **세션은 메모리에서만 유지**
  - `answerCurrentQuestion(selectedIndex)`:
    - 200ms 이내 연속 호출돼도 answers가 1개만 추가(F2-AC3)
    - 추가 시 세션 `updatedAtISO`가 이전 값과 달라짐(F2-AC1)
    - 오답이면 `recordWrongAnswer` 호출로 UNIQUE 저장(F2-AC2)
    - answers.length===3이면:
      - `status: "COMPLETED"` 저장
      - `completedAtISO` 저장(ISO timestamp string)
      - 완료 직전 대비 `updatedAtISO` 변경
      - 이후 결과 화면 이동에 필요한 `savedSessionId`를 반환 가능하도록 설계(F3-AC1)
  - `console.error` 호출 0회 유지
- Covers: [F1-AC1, F1-AC2, F1-AC4, F2-AC1, F2-AC2, F2-AC3, F3-AC1, F4, F7-AC-NEW-2]
- Files: [`src/store/AppStoreProvider.tsx`, `src/store/useAppStore.ts`]
- Depends on: Task 2.3, 2.4, 2.5, 2.9, 2.2, 1.1

### Task 2.11 `react-window` 의존성 추가 + 공용 VirtualList 래퍼
- Description:
  - SPEC의 “50개 초과 시 가상 스크롤(react-window)” 준수를 위해 의존성을 추가하고, 페이지에서 재사용할 얇은 래퍼 컴포넌트를 만든다.
- DoD:
  - `package.json`에 `react-window` 추가되어 `npm run build`가 성공
  - `src/components/VirtualList.tsx`(new):
    - `FixedSizeList`를 export하거나 래핑한 컴포넌트 제공
- Covers: [F5, F6-AC1]
- Files: [`package.json`, `src/components/VirtualList.tsx`]
- Depends on: none

---

## Epic 3. Core UI pages (src/pages/) — ONE page per task
### Risk Analysis
- Complexity: **High**
- Risk factors:
  - `location.state` 누락/오타로 페이지 진입 시 크래시
  - 로딩/에러/가드 UI 누락으로 AC 미충족
  - 광고 배치 겹침(검수 리젝)
- Mitigation:
  - 모든 페이지에서 `RouteState` import + `location.state as RouteState["/path"]` 캐스팅
  - 페이지별 AC를 task 단위로 고립 구현(로딩/에러 포함)
  - 광고는 **해당 페이지 task에서** 레이아웃까지 함께 확정(후속 수정 최소화)

### Task 3.1 `HomePage` (`/`) — 난이도 선택 + 시작 로딩 + 문제 부족 차단 + 파손 복구 다이얼로그 + 배너 광고
- Description:
  - 홈에서 난이도 선택, “오늘의 퀴즈 시작”을 제공한다.
  - 문제 부족 시 에러 메시지 표시 및 `/quiz`로 navigate 금지.
  - 파손 데이터 감지 시 초기화 다이얼로그를 띄우고 복구한다.
  - 세션 저장 QuotaExceeded 시 AlertDialog를 띄운다.
  - 하단에 `<AdSlot />` 배너를 배치(겹침 금지).
- DoD:
  - `const routeState = location.state as RouteState["/"];` 사용
  - 시작 탭 시 “세션 생성/저장 중”:
    - 시작 버튼 `disabled=true`
    - `TDS Loader(또는 Progress)`가 화면에 표시(F1-AC5)
  - ADVANCED 등 선택 난이도 문제 수 < 3이면:
    - 텍스트 `"문제가 아직 준비되지 않았어요"` 표시
    - `navigate('/quiz', ...)`가 호출되지 않음(F1-AC3)
  - `needsRecoveryDialog === true`이면 AlertDialog:
    - 제목 `"저장된 데이터를 읽을 수 없어요"`
    - 본문 `"데이터를 초기화할게요"`
    - 확인 탭 시 reset 실행 후 홈 UI가 크래시 없이 유지(F7-AC-NEW-2)
  - 세션 저장 중 QuotaExceeded 발생 시 AlertDialog:
    - 제목 `"저장 공간이 부족해요"`
    - 본문 `"기기 저장 공간을 확인해주세요"` (F1-AC4)
  - 배너 광고:
    - `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />`가 HomePage에 **정확히 1회**
    - 광고가 콘텐츠와 겹치도록 `position: fixed/absolute`로 덮지 않음(레이아웃 분리)
- Covers: [F1-AC3, F1-AC4, F1-AC5, F7-AC-NEW-2, F8]
- Files: [`src/pages/HomePage.tsx`]
- Depends on: Task 2.8, Task 2.10, Task 1.1

### Task 3.2 `QuizPage` (`/quiz`) — 4지선다 진행 + 로딩/에러(문항 누락) 처리 + 완료 시 결과 이동
- Description:
  - 세션 3문항을 순서대로 보여주고 보기 선택 시 다음 문항으로 진행한다.
  - questionId가 문제은행에 없으면 에러 화면과 “홈으로” 복구 네비게이션을 제공한다.
- DoD:
  - `const routeState = location.state as RouteState["/quiz"];` 사용
  - 진입 직후 문항 매핑 중:
    - `TDS Loader`만 표시
    - 보기 버튼(4개)은 렌더링되지 않음(F2-AC5)
  - 보기 탭 시:
    - `answers`에 1개 추가(F2-AC1)
    - 다음 문항으로 전환(F2-AC1)
  - 200ms 내 중복 탭 시:
    - `answers.length`가 2 이상 증가하지 않음(정확히 1개만 기록)(F2-AC3)
  - 세션 questionIds 중 인덱스에 없는 id가 렌더 대상이면:
    - `"문제를 불러올 수 없어요"` 표시(F2-AC4)
    - `"홈으로"` 버튼 탭 시 `navigate('/', { state: { recovered: true } })` 실행(F2-AC4)
  - 3번째 답안 선택으로 완료되면:
    - `navigate('/result', { state: { sessionId: "<savedSessionId>" } })`가 호출됨(F3-AC1)
- Covers: [F2-AC1, F2-AC3, F2-AC4, F2-AC5, F3-AC1]
- Files: [`src/pages/QuizPage.tsx`]
- Depends on: Task 2.10, Task 2.8, Task 1.1

### Task 3.3 `ResultPage` (`/result`) — 요약 카드 + 보상형 광고 게이트 해설 + 랭킹 제출/닉네임 가드
- Description:
  - `sessionId`로 결과를 로드해 요약을 표시한다.
  - 해설 섹션은 `<TossRewardAd>`로 게이트한다.
  - 완료 IQDelta를 주간 랭킹에 제출하고 rank를 표시한다(닉네임 없으면 BottomSheet로 차단).
- DoD:
  - `const routeState = location.state as RouteState["/result"];` 사용
  - 세션 로딩 중 `TDS Loader` 표시(F3-AC5)
  - invalid sessionId로 세션을 못 찾으면:
    - `"결과를 불러올 수 없어요"` 표시
    - `"홈으로"` 버튼 탭 시 `navigate('/')` 실행(F3-AC4)
  - 정상 렌더 시:
    - `data-testid="result-summary-card"`인 `TDS Card`가 **정확히 1개**(F3-AC6)
    - `data-testid="explanation-section"` 컨테이너 존재(F3-AC6)
  - 해설 게이트:
    - `"해설 보기"` 액션을 `<TossRewardAd>`로 감싸고, 광고 시청 완료 후 해설 카드 리스트(3개) 표시(F3-AC2)
    - 광고 실패/취소 시:
      - 해설 카드 리스트가 표시되지 않음
      - 토스트 `"광고 시청 후 해설을 볼 수 있어요"` 표시(F3-AC3)
  - 랭킹 제출:
    - `UserProgress.nickname === ""`(또는 falsy)이면:
      - 제출 요청이 **0회**
      - BottomSheet로 `"닉네임을 설정해 주세요"` 표시(F6-AC6)
    - 제출 성공으로 `{ rank: 12 }`를 받으면 `"이번 주 랭킹 12위"` 텍스트가 화면에 표시(F6-AC5)
- Covers: [F3-AC2, F3-AC3, F3-AC4, F3-AC5, F3-AC6, F6-AC5, F6-AC6]
- Files: [`src/pages/ResultPage.tsx`]
- Depends on: Task 2.4, Task 2.7, Task 2.1, Task 1.1

### Task 3.4 `ReviewPage` (`/review`) — 오답 목록(clientId 필터) + 50개 초과 react-window 가상 스크롤
- Description:
  - 현재 유저의 오답만 필터링하여 리스트로 보여주고, 50개 초과 시 가상 스크롤을 적용한다.
- DoD:
  - `WrongAnswerItem.clientId !== userProgress.id` 항목은 UI에 0개(필터링 적용)(F5)
  - 오답 개수 `> 50`이면 `VirtualList(react-window 기반)`를 사용하도록 코드 분기 존재(F5)
  - 각 아이템이 `TDS ListRow`로 렌더
  - 리스트 영역이 명시적 스크롤 컨테이너(예: 페이지 본문 영역에 overflow 처리)
- Covers: [F5]
- Files: [`src/pages/ReviewPage.tsx`]
- Depends on: Task 2.5, Task 2.10, Task 2.11, Task 1.1

### Task 3.5 `LeaderboardPage` (`/leaderboard`) — 로그인 통합 가드 + 로딩/성공/캐시 폴백/빈상태/재시도 + 배너 광고 + 가상 스크롤
- Description:
  - 로그인 통합 여부 확인 후 랭킹 접근을 허용한다.
  - 서버 성공 시 리스트 렌더 및 캐시 저장.
  - 실패 시 캐시 폴백 또는 빈 상태 + 재시도 제공.
  - 하단에 배너 광고를 배치한다.
- DoD:
  - `getIsTossLoginIntegratedService()`가 false이면:
    - `"로그인이 필요해요"` 표시
    - `"홈으로"` 버튼 표시 및 탭 시 `navigate('/')`
    - `GET /leaderboard/weekly` 요청이 **0회**(가드가 fetch보다 먼저 실행)(F6-AC8)
  - true이면:
    - 요청 대기 동안 `TDS Loader` 표시(F6-AC2)
    - 200 응답 시 상위 100개 이내를 `TDS ListRow`로 렌더(F6-AC1)
    - 성공 시 `fvq_leaderboard_cache_v2[weekId]` 저장(F6-AC1)
  - fetch reject 시:
    - 캐시가 있으면 `"네트워크 오류로 캐시를 표시했어요"` 텍스트 + 캐시 렌더(F6-AC3)
    - 캐시도 없으면 `Asset.ContentIcon` + `"랭킹을 불러올 수 없어요"` + `"다시 시도"` 버튼(F6-AC4)
    - `"다시 시도"` 탭 시 동일 GET 요청이 **1회** 재시도(F6-AC4)
  - 엔트리 수 `> 50`이면 `VirtualList(react-window 기반)` 사용 분기 존재
  - 배너 광고:
    - `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />`가 LeaderboardPage에 **정확히 1회**
    - 광고가 콘텐츠와 겹치지 않도록 레이아웃 분리(overlay 금지)
- Covers: [F6-AC1, F6-AC2, F6-AC3, F6-AC4, F6-AC8, F8]
- Files: [`src/pages/LeaderboardPage.tsx`]
- Depends on: Task 2.7, Task 2.6, Task 2.1, Task 2.11, Task 1.1

### Task 3.6 `SettingsPage` (`/settings`) — 닉네임 저장 검증 + 데이터 초기화
- Description:
  - 닉네임 설정(TextField)과 데이터 초기화(캐스케이드 reset) UI를 제공한다.
- DoD:
  - `TextField`에 `maxLength={10}` 설정
  - `"저장"` 탭 시 `nickname.trim().length < 2 || > 10`이면:
    - AlertDialog 제목 `"닉네임을 저장할 수 없어요"`
    - 본문이 **정확히** `"닉네임은 2~10자여야 해요"`(F7-AC-NEW-1)
    - localStorage `fvq_user_progress_v2.nickname` 값이 변경되지 않음(F7-AC-NEW-1)
    - 다이얼로그 확인 후에도 라우트 변경 없음(F7-AC-NEW-1)
  - 정상 저장 시 `UserProgress.updatedAtISO`가 이전 값과 달라야 함(F4)
  - 데이터 초기화 버튼으로 `resetAllDataAndRecreateUserProgress()` 호출(캐스케이드 삭제 포함)(F7-AC-NEW-2)
- Covers: [F7-AC-NEW-1, F7-AC-NEW-2, F4]
- Files: [`src/pages/SettingsPage.tsx`]
- Depends on: Task 2.3, Task 2.10, Task 1.1

---

## Epic 4. Integration + polish (routing wiring, final UX)
### Risk Analysis
- Complexity: **Medium**
- Risk factors:
  - 라우팅 연결 누락/오타로 특정 경로 접근 불가
  - RouteState 계약과 다른 state 전달로 런타임 오류
- Mitigation:
  - 페이지별 구현 완료 후 마지막에 라우팅만 연결(각 페이지는 이미 RouteState 캐스팅 포함)
  - 통합 task는 **페이지 파일 수정 없이** App 라우터만 조립

### Task 4.1 Router wiring + 전역 Provider 장착(+FloatingTabBar 연결)
- Description:
  - React Router에 페이지를 연결하고, 앱 루트를 `AppStoreProvider`로 1회 감싼다.
  - 템플릿 제공 `FloatingTabBar`를 사용해 주요 탭 이동을 구성한다.
- DoD:
  - 라우트 등록:
    - `/` → HomePage
    - `/quiz` → QuizPage
    - `/result` → ResultPage
    - `/review` → ReviewPage
    - `/leaderboard` → LeaderboardPage
    - `/settings` → SettingsPage
  - 앱 최상단에서 `AppStoreProvider`가 **정확히 1회** 래핑
  - `navigate('/result', { state: { sessionId } })` 등 라우팅 state 전달이 **RouteState 정의와 컴파일 타임에 일치**
- Covers: [F3-AC1, F2-AC4]
- Files: [`src/App.tsx`, `src/main.tsx`]
- Depends on: Task 3.1, 3.2, 3.3, 3.4, 3.5, 3.6

---

## AC Coverage
- Total ACs in SPEC: **26**
- Covered by tasks: **26**
  - F1-AC1: Task 2.9, 2.4, 2.10
  - F1-AC2: Task 2.4, 2.9, 2.10
  - F1-AC3: Task 2.8, 3.1
  - F1-AC4: Task 2.2, 2.10, 3.1
  - F1-AC5: Task 3.1
  - F2-AC1: Task 2.10, 3.2
  - F2-AC2: Task 2.5, 2.10
  - F2-AC3: Task 2.10, 3.2
  - F2-AC4: Task 2.8, 3.2, 4.1
  - F2-AC5: Task 3.2
  - F3-AC1: Task 2.10, 3.2, 4.1
  - F3-AC2: Task 3.3
  - F3-AC3: Task 3.3
  - F3-AC4: Task 2.4, 3.3
  - F3-AC5: Task 3.3
  - F3-AC6: Task 3.3
  - F6-AC1: Task 2.7, 2.6, 3.5
  - F6-AC2: Task 3.5
  - F6-AC3: Task 2.6, 3.5
  - F6-AC4: Task 2.6, 3.5
  - F6-AC5: Task 2.7, 3.3
  - F6-AC6: Task 3.3
  - F6-AC7: Task 2.7
  - F6-AC8: Task 3.5
  - F7-AC-NEW-1: Task 2.3, 3.6
  - F7-AC-NEW-2: Task 2.2, 2.3, 2.10, 3.1
- Uncovered: **0**