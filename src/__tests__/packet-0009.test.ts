import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent } from "@testing-library/react";
import { mockTds, mockAppsInToss, mockTossRewardAd, mockRouter, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import type { DailyQuizSession, QuizQuestion } from "@/lib/types";

// NOTE: src/pages/Quiz.tsx does not exist yet (TDD red phase).
// Use require() (not a static import) so `npx tsc --noEmit` doesn't fail on the
// missing module before the Coder implements it — see packet-0004.test.ts for
// the same convention with other not-yet-implemented modules.
function getQuizComponent() {
  return require("@/pages/Quiz").default;
}

/**
 * Packet 0009: 퀴즈(/quiz) 페이지 — 4지선다 진행 + 중복 탭 방지 + 문항 누락 에러 처리
 *
 * AC-1: 각 문항에서 보기 4개가 항상 렌더링되며, 보기 1개 선택 시 answerQuestion이 1회만 호출된다
 *       (동일 문항 빠른 2회 탭에도 1회만 — UI 레벨 가드 필요, 스토어 목(mock)은 자체 가드가 없으므로
 *        이 테스트가 통과하려면 Quiz.tsx가 로컬 상태로 중복 클릭을 막아야 한다)
 * AC-2: 현재 문항 questionId가 퀴즈뱅크 byId에 없으면 에러 UI("문제를 불러오지 못했어요") +
 *       '홈으로' 버튼으로 navigate('/')
 * AC-3: 3문항 모두 기록되어 세션이 COMPLETED가 되면 navigate('/result', {state:{sessionId}})가 실행된다
 *       (리렌더가 반복돼도 navigate는 1회만 — 무한 재-네비게이션 방지)
 */

mockTds();
mockAppsInToss();
mockTossRewardAd();
mockRouter();

// ── @/store/AppStore mock (controllable per-test via mockUseAppStore.mockReturnValue) ──
const { mockUseAppStore } = vi.hoisted(() => ({ mockUseAppStore: vi.fn() }));
vi.mock("@/store/AppStore", () => ({
  useAppStore: mockUseAppStore,
  AppStoreProvider: ({ children }: any) => children,
}));

// ── @/lib/quizBank/index mock (controllable byId per test) ──
const { quizBankState } = vi.hoisted(() => ({
  quizBankState: { byId: {} as Record<string, unknown> },
}));
vi.mock("@/lib/quizBank/index", () => ({
  getQuizBankIndex: () => ({ byId: quizBankState.byId, byDifficulty: { BEGINNER: [], INTERMEDIATE: [], ADVANCED: [] } }),
}));

function makeQuestion(overrides: Partial<QuizQuestion> = {}): QuizQuestion {
  return {
    id: "q1",
    difficulty: "BEGINNER",
    term: "복리",
    prompt: "복리란 무엇인가요?",
    choices: ["원금에만 이자가 붙는 방식", "원금과 이자에 다시 이자가 붙는 방식", "이자가 없는 방식", "세금 감면 제도"],
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
    q1: makeQuestion({ id: "q1", prompt: "복리란 무엇인가요?" }),
    q2: makeQuestion({
      id: "q2",
      prompt: "인플레이션이란 무엇인가요?",
      choices: ["물가가 지속적으로 오르는 현상", "물가가 지속적으로 내리는 현상", "환율이 고정되는 현상", "이자율이 0이 되는 현상"],
      correctIndex: 0,
    }),
    q3: makeQuestion({
      id: "q3",
      prompt: "분산투자란 무엇인가요?",
      choices: ["한 종목에 집중 투자", "여러 자산에 나눠 투자", "무조건 예금만 하기", "빚을 내 투자하기"],
      correctIndex: 1,
    }),
  };
}

function makeSession(overrides: Partial<DailyQuizSession> = {}): DailyQuizSession {
  return {
    id: "session-1",
    sessionId: "session-1",
    clientId: "user-1",
    dateISO: "2026-07-14",
    difficulty: "BEGINNER",
    questionIds: ["q1", "q2", "q3"],
    status: "IN_PROGRESS",
    answers: [],
    score: { correctCount: 0, iqDelta: 0 },
    startedAtISO: "2026-07-14T00:00:00.000Z",
    completedAtISO: undefined,
    createdAtISO: "2026-07-14T00:00:00.000Z",
    updatedAtISO: "2026-07-14T00:00:00.000Z",
    ...overrides,
  } as DailyQuizSession;
}

function makeStoreState(overrides: Record<string, unknown> = {}) {
  return {
    userProgress: {
      id: "user-1",
      clientId: "user-1",
      nickname: "게스트",
      iqTotal: 0,
      streak: { current: 0, best: 0 },
      aiDisclosureAccepted: false,
      createdAtISO: "2026-07-14T00:00:00.000Z",
      updatedAtISO: "2026-07-14T00:00:00.000Z",
    },
    needsRecoveryDialog: false,
    currentSession: makeSession(),
    quotaExceededForSession: false,
    startTodaySession: vi.fn(),
    answerQuestion: vi.fn(),
    ...overrides,
  };
}

function renderQuiz() {
  const QuizComponent = getQuizComponent();
  return renderWithRouter(
    React.createElement(QuizComponent),
    { initialEntries: [{ pathname: "/quiz", state: { difficulty: "BEGINNER" } }] },
  );
}

describe("퀴즈(/quiz) 페이지: 4지선다 진행 + 중복 탭 방지 + 문항 누락 에러 처리", () => {
  beforeEach(() => {
    resetQuizBank();
    mockUseAppStore.mockReset();
    mockNavigate.mockReset();
  });

  // ==========================================================================
  // AC-1: 보기 4개 렌더링 + 선택 시 answerQuestion 1회 호출 + 중복 탭 방지
  // ==========================================================================

  describe("AC-1: 보기 4개 렌더링 + 중복 탭 방지", () => {
    it("AC-1[P0]: 첫 문항에서 보기 4개가 렌더링되고, 같은 보기를 빠르게 2번 클릭해도 answerQuestion은 1회만 호출된다", () => {
      const mockAnswerQuestion = vi.fn();
      mockUseAppStore.mockReturnValue(
        makeStoreState({ currentSession: makeSession(), answerQuestion: mockAnswerQuestion }),
      );

      renderQuiz();

      const choiceButtons = screen.getAllByTestId("quiz-choice");
      expect(choiceButtons).toHaveLength(4);

      fireEvent.click(choiceButtons[1]);
      fireEvent.click(choiceButtons[1]);

      expect(mockAnswerQuestion).toHaveBeenCalledTimes(1);
      expect(mockAnswerQuestion).toHaveBeenCalledWith("q1", 1);
    });

    it("AC-1[P0]: 스토어의 answers가 갱신되어 리렌더되면 다음 문항(q2)의 보기 4개로 전환된다", () => {
      const mockAnswerQuestion = vi.fn();
      mockUseAppStore.mockReturnValue(
        makeStoreState({ currentSession: makeSession(), answerQuestion: mockAnswerQuestion }),
      );

      const { rerender } = renderQuiz();
      expect(screen.getByText("복리란 무엇인가요?")).toBeInTheDocument();

      const answeredSession = makeSession({
        answers: [{ questionId: "q1", selectedIndex: 1, isCorrect: true }],
        score: { correctCount: 1, iqDelta: 0 },
      });
      mockUseAppStore.mockReturnValue(
        makeStoreState({ currentSession: answeredSession, answerQuestion: mockAnswerQuestion }),
      );
      rerender(React.createElement(getQuizComponent()));

      expect(screen.getByText("인플레이션이란 무엇인가요?")).toBeInTheDocument();
      expect(screen.getAllByTestId("quiz-choice")).toHaveLength(4);
    });
  });

  // ==========================================================================
  // AC-2: 문항 누락 시 에러 UI + 홈으로 이동
  // ==========================================================================

  describe("AC-2: 문항 누락 시 에러 처리", () => {
    it("AC-2[P0]: 현재 문항 questionId가 퀴즈뱅크 byId에 없으면 에러 UI가 표시되고 '홈으로' 버튼으로 navigate('/')한다", () => {
      const brokenSession = makeSession({ questionIds: ["missing-q", "q2", "q3"] });
      mockUseAppStore.mockReturnValue(makeStoreState({ currentSession: brokenSession }));

      renderQuiz();

      expect(screen.getByText(/문제를 불러오지 못했어요/)).toBeInTheDocument();
      expect(screen.queryAllByTestId("quiz-choice")).toHaveLength(0);

      const homeButton = screen.getByRole("button", { name: "홈으로" });
      fireEvent.click(homeButton);

      expect(mockNavigate).toHaveBeenCalledWith("/");
    });

    it("AC-2[P0]: 현재 문항 questionId가 퀴즈뱅크에 정상적으로 존재하면 에러 UI 없이 보기 4개가 렌더링된다", () => {
      mockUseAppStore.mockReturnValue(makeStoreState({ currentSession: makeSession() }));

      renderQuiz();

      expect(screen.queryByText(/문제를 불러오지 못했어요/)).not.toBeInTheDocument();
      expect(screen.getAllByTestId("quiz-choice")).toHaveLength(4);
    });
  });

  // ==========================================================================
  // AC-3: 세션 완료 시 결과 페이지로 이동
  // ==========================================================================

  describe("AC-3: 세션 COMPLETED 시 결과 페이지 이동", () => {
    it("AC-3[P0]: 3문항 모두 답변되어 세션이 COMPLETED이면 navigate('/result', {state:{sessionId}})가 호출된다", () => {
      const completedSession = makeSession({
        status: "COMPLETED",
        completedAtISO: "2026-07-14T00:10:00.000Z",
        answers: [
          { questionId: "q1", selectedIndex: 1, isCorrect: true },
          { questionId: "q2", selectedIndex: 0, isCorrect: true },
          { questionId: "q3", selectedIndex: 2, isCorrect: false },
        ],
        score: { correctCount: 2, iqDelta: 25 },
      });
      mockUseAppStore.mockReturnValue(makeStoreState({ currentSession: completedSession }));

      renderQuiz();

      expect(mockNavigate).toHaveBeenCalledWith("/result", { state: { sessionId: "session-1" } });
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });

    it("AC-3[P0]: COMPLETED 상태가 유지된 채 리렌더가 반복되어도 navigate('/result', ...)는 1회만 호출된다", () => {
      const completedSession = makeSession({
        status: "COMPLETED",
        completedAtISO: "2026-07-14T00:10:00.000Z",
        answers: [
          { questionId: "q1", selectedIndex: 1, isCorrect: true },
          { questionId: "q2", selectedIndex: 0, isCorrect: true },
          { questionId: "q3", selectedIndex: 2, isCorrect: false },
        ],
        score: { correctCount: 2, iqDelta: 25 },
      });
      mockUseAppStore.mockReturnValue(makeStoreState({ currentSession: completedSession }));

      const { rerender } = renderQuiz();
      mockUseAppStore.mockReturnValue(makeStoreState({ currentSession: { ...completedSession } }));
      rerender(React.createElement(getQuizComponent()));
      mockUseAppStore.mockReturnValue(makeStoreState({ currentSession: { ...completedSession } }));
      rerender(React.createElement(getQuizComponent()));

      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith("/result", { state: { sessionId: "session-1" } });
    });
  });
});
