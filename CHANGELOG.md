# Changelog

## [0.1.0] - 2026-07-14

10/16 packets completed.

### Added
- feat: v2 스키마 TypeScript 타입 + RouteState 계약 고정 (packet 0001)
- feat: 시간/ID 유틸 + 퀴즈뱅크 런타임 인덱스 + 세션 생성(결정적 3문항) (packet 0002)
- feat: localStorage v2 저장소: safeStorage + UserProgress/DailySessions/WrongAnswers/LeaderboardCache CRUD (packet 0003)
- feat: AppStore(Context): 부트스트랩/복구 감지 + 오늘 세션 시작/답안 기록/완료 처리 (packet 0004)
- feat: API 공통 fetch 래퍼(http.ts): JSON/헤더 파싱 + non-throw 결과 모델 (packet 0005)
- feat: 리더보드 API 클라이언트(leaderboard.ts): GET 주간조회 + POST 제출 (packet 0006)
- feat: VirtualList 공용 컴포넌트(react-window) + 50+ 목록 가상 스크롤 기반 (packet 0007)
- feat: 홈(/) 페이지: 난이도 선택 + 시작 로딩 + 문제 부족 차단 + 복구 다이얼로그 (packet 0008)
- feat: 퀴즈(/quiz) 페이지: 4지선다 진행 + 중복 탭 방지 + 문항 누락 에러 처리 (packet 0009)
- feat: 결과(/result) 페이지: 요약 + 보상형 광고 게이트 해설 + 랭킹 제출(닉네임 가드) (packet 0010)
