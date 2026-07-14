import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent } from "@testing-library/react";
import { mockTds, mockAppsInToss, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import type { DailyQuizSession, QuizQuestion, UserProgress } from "@/lib/types";
import { saveDailySession } from "@/lib/storage/dailySessions";
import ResultComponent from "@/pages/Result";

/**
 * Packet 0010: 결과(/result) 페이지 — 요약 + 보상형 광고 게이트 해설 + 랭킹 제출(닉네임 가드)
 *
 * AC-1: RouteState로 전달된 sessionId로 세션을 찾지 못하면 에러 UI('결과를 찾지 못했어요') +
 *       '홈으로' 버튼(navigate('/'))
 * AC-2: 세션 status가 COMPLETED일 때만 결과 요약이 표시되며, 해설 영역은 TossRewardAd로 감싸져
 *       광고 완료 전에는 해설 텍스트가 렌더링되지 않는다(실패/취소 시에도 비공개 유지)
 * AC-3: '주간 랭킹에 반영하기' 탭 시 userProgress.nickname이 2~10자를 만족하지 않으면 제출을
 *       호출하지 않고 AlertDialog 안내 + '설정으로 이동' 버튼 제공
 */

mockTds();
mockAppsInToss();

// react-router-dom: useNavigate만 목킹하고 useLocation은 실제 구현을 유지한다.
// mocks.ts의 mockRouter()는 useLocation을 고정된 정적 객체로 대체해 initialEntries의
// state(sessionId)가 반영되지 않으므로, 이 패킷에서는 legacy 패턴(react-router-dom 직접 목)을 쓴다.
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

// ── @/store/AppStore mock (controllable userProgress per-test) ──
const { mockUseAppStore } = vi.hoisted(() => ({ mockUseAppStore: vi.fn() }));
vi.mock("@/store/AppStore", () => ({
  useAppStore: mockUseAppStore,
  AppStoreProvider: ({ children }: any) => children,
}));

// ── @/lib/quizBank/index mock (controllable byId per-test) ──
const { quizBankState } = vi.hoisted(() => ({
  quizBankState: { byId: {} as Record<string, unknown> },
}));
vi.mock("@/lib/quizBank/index", () => ({
  getQuizBankIndex: () => ({
    byId: quizBankState.byId,
    byDifficulty: { BEGINNER: [], INTERMEDIATE: [], ADVANCED: [] },
  }),
}));

// ── @/lib/api/leaderboard mock (spy on submitWeeklyLeaderboard) ──
const { mockSubmit } = vi.hoisted(() => ({ mockSubmit: vi.fn() }));
vi.mock("@/lib/api/leaderboard", () => ({
  submitWeeklyLeaderboard: mockSubmit,
}));

// ── @/components/TossRewardAd mock ──
// Deterministic gate: two buttons directly invoke the callbacks Result.tsx
// supplies (no real SDK timing). Result.tsx owns the "unlocked" state and
// decides what to pass as children — the mock just always renders them.
vi.mock("@/components/TossRewardAd", () => ({
  TossRewardAd: ({ children, onRewarded, onWatchFailed }: any) =>
    React.createElement(
      "div",
      { "data-testid": "toss-reward-ad-mock" },
      React.createElement(
        "button",
        { "data-testid": "watch-ad-success", onClick: () => onRewarded?.() },
        "해설 보기(성공)",
      ),
      React.createElement(
        "button",
        { "data-testid": "watch-ad-fail", onClick: () => onWatchFailed?.() },
        "해설 보기(실패)",
      ),
      children,
    ),
}));

function makeQuestion(overrides: Partial<QuizQuestion> = {}): QuizQuestion {
  return {
    id: "q1",
    difficulty: "BEGINNER",
    term: "복리",
    prompt: "복리란 무엇인가요?",
    choices: [
      "원금에만 이자가 붙는 방식",
      "원금과 이자에 다시 이자가 붙는 방식",
      "이자가 없는 방식",
      "세금 감면 제도",
    ],
    correctIndex: 1,
    explanation: "복리는 이자에 이자가 붙는 방식입니다.",
    tags: ["이자"],
    createdAtISO: "2026-07-01T00:00:00.000Z",
    updatedAtISO: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function resetQuizBank() {
  quizBankState.byId = {
    q1: makeQuestion({ id: "q1", explanation: "복리는 이자에 이자가 붙는 방식입니다." }),
    q2: makeQuestion({
      id: "q2",
      term: "인플레이션",
      prompt: "인플레이션이란 무엇인가요?",
      explanation: "인플레이션은 물가가 지속적으로 오르는 현상입니다.",
      correctIndex: 0,
    }),
    q3: makeQuestion({
      id: "q3",
      term: "분산투자",
      prompt: "분산투자란 무엇인가요?",
      explanation: "분산투자는 여러 자산에 나눠 투자하는 방식입니다.",
      correctIndex: 1,
    }),
  };
}

function makeCompletedSession(overrides: Partial<DailyQuizSession> = {}): DailyQuizSession {
  return {
    id: "session-1",
    sessionId: "session-1",
    clientId: "user-1",
    dateISO: "2026-07-14",
    difficulty: "BEGINNER",
    questionIds: ["q1", "q2", "q3"],
    status: "COMPLETED",
    answers: [
      { questionId: "q1", selectedIndex: 1, isCorrect: true },
      { questionId: "q2", selectedIndex: 0, isCorrect: true },
      { questionId: "q3", selectedIndex: 2, isCorrect: false },
    ],
    score: { correctCount: 2, iqDelta: 25 },
    startedAtISO: "2026-07-14T00:00:00.000Z",
    completedAtISO: "2026-07-14T00:10:00.000Z",
    createdAtISO: "2026-07-14T00:00:00.000Z",
    updatedAtISO: "2026-07-14T00:10:00.000Z",
    ...overrides,
  } as DailyQuizSession;
}

function makeUserProgress(overrides: Partial<UserProgress> = {}): UserProgress {
  return {
    id: "user-1",
    clientId: "user-1",
    nickname: "투자초보",
    iqTotal: 100,
    streak: { current: 1, best: 1, lastCompletedDateISO: "2026-07-14" },
    aiDisclosureAccepted: true,
    createdAtISO: "2026-07-01T00:00:00.000Z",
    updatedAtISO: "2026-07-14T00:10:00.000Z",
    ...overrides,
  };
}

function renderResult(sessionId: string) {
  return renderWithRouter(React.createElement(ResultComponent), {
    initialEntries: [{ pathname: "/result", state: { sessionId } }],
  });
}

describe("결과(/result) 페이지: 요약 + 보상형 광고 게이트 해설 + 랭킹 제출(닉네임 가드)", () => {
  beforeEach(() => {
    resetQuizBank();
    mockUseAppStore.mockReset();
    mockNavigate.mockReset();
    mockSubmit.mockReset();
    mockSubmit.mockResolvedValue({ status: 200, data: { rank: 12, entry: {} } });
    mockUseAppStore.mockReturnValue({ userProgress: makeUserProgress() });
  });

  // ==========================================================================
  // AC-1: sessionId로 세션을 찾지 못하면 에러 UI + 홈으로
  // ==========================================================================

  it("AC-1[P0]: 존재하지 않는 sessionId로 진입하면 '결과를 찾지 못했어요' 에러 UI가 표시되고 '홈으로' 버튼 탭 시 navigate('/')가 호출된다", () => {
    renderResult("session-does-not-exist");

    expect(screen.getByText(/결과를 찾지 못했어요/)).toBeInTheDocument();
    expect(screen.queryByTestId("result-summary-card")).not.toBeInTheDocument();

    const homeButton = screen.getByRole("button", { name: "홈으로" });
    fireEvent.click(homeButton);

    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("AC-1[P0]: 존재하는 sessionId로 진입하면 에러 UI 없이 결과 요약 카드가 렌더링된다", () => {
    saveDailySession(makeCompletedSession());

    renderResult("session-1");

    expect(screen.queryByText(/결과를 찾지 못했어요/)).not.toBeInTheDocument();
    expect(screen.getByTestId("result-summary-card")).toBeInTheDocument();
  });

  // ==========================================================================
  // AC-2: COMPLETED 세션 결과 요약 + 해설 광고 게이트
  // ==========================================================================

  it("AC-2[P0]: COMPLETED 세션의 정답 개수/획득 IQ가 요약 카드에 표시되고, 광고 시청 전에는 해설 텍스트가 렌더링되지 않는다", () => {
    saveDailySession(makeCompletedSession());

    renderResult("session-1");

    const summaryCard = screen.getByTestId("result-summary-card");
    expect(summaryCard.textContent).toContain("2");
    expect(summaryCard.textContent).toContain("25");

    expect(screen.getByTestId("explanation-section")).toBeInTheDocument();
    expect(screen.queryByText("복리는 이자에 이자가 붙는 방식입니다.")).not.toBeInTheDocument();
    expect(screen.queryByText("인플레이션은 물가가 지속적으로 오르는 현상입니다.")).not.toBeInTheDocument();
  });

  it("AC-2[P0]: 보상형 광고 시청을 완료하면 해설 카드 3개(문항별 해설)가 표시된다", () => {
    saveDailySession(makeCompletedSession());

    renderResult("session-1");
    fireEvent.click(screen.getByTestId("watch-ad-success"));

    expect(screen.getByText("복리는 이자에 이자가 붙는 방식입니다.")).toBeInTheDocument();
    expect(screen.getByText("인플레이션은 물가가 지속적으로 오르는 현상입니다.")).toBeInTheDocument();
    expect(screen.getByText("분산투자는 여러 자산에 나눠 투자하는 방식입니다.")).toBeInTheDocument();
  });

  it("AC-2[P1]: 보상형 광고가 실패/취소되면 해설은 계속 비공개 상태이며 안내 토스트가 표시된다", () => {
    saveDailySession(makeCompletedSession());

    renderResult("session-1");
    fireEvent.click(screen.getByTestId("watch-ad-fail"));

    expect(screen.queryByText("복리는 이자에 이자가 붙는 방식입니다.")).not.toBeInTheDocument();
    expect(screen.getByText("광고 시청 후 해설을 볼 수 있어요")).toBeInTheDocument();
  });

  // ==========================================================================
  // AC-3: 닉네임 미충족 시 랭킹 제출 차단
  // ==========================================================================

  it("AC-3[P0]: 닉네임이 미설정(빈 문자열)이면 '주간 랭킹에 반영하기' 탭 시 제출이 호출되지 않고 AlertDialog + '설정으로 이동' 버튼이 표시된다", () => {
    saveDailySession(makeCompletedSession());
    mockUseAppStore.mockReturnValue({ userProgress: makeUserProgress({ nickname: "" }) });

    renderResult("session-1");
    fireEvent.click(screen.getByRole("button", { name: "주간 랭킹에 반영하기" }));

    expect(mockSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("닉네임을 설정해 주세요")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "설정으로 이동" }));
    expect(mockNavigate).toHaveBeenCalledWith("/settings");
  });

  it("AC-3[P0]: 닉네임이 2~10자를 만족하면 '주간 랭킹에 반영하기' 탭 시 submitWeeklyLeaderboard가 정확한 payload로 1회 호출된다", () => {
    saveDailySession(makeCompletedSession());
    mockUseAppStore.mockReturnValue({ userProgress: makeUserProgress({ nickname: "투자초보" }) });

    renderResult("session-1");
    fireEvent.click(screen.getByRole("button", { name: "주간 랭킹에 반영하기" }));

    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "user-1",
        nickname: "투자초보",
        weeklyIqDelta: 25,
      }),
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
