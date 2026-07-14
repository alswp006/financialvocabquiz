import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent } from "@testing-library/react";
import { mockTds, mockAppsInToss, mockTossRewardAd, mockRouter, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import type { UserProgress } from "@/lib/types";

/**
 * Packet 0008: 홈(/) 페이지 — 난이도 선택 + 시작 로딩 + 문제 부족 차단 + 복구 다이얼로그
 *
 * AC-1: 난이도 선택 후 '오늘 퀴즈 시작' 탭 → startTodaySession 호출 + navigate('/quiz', {state:{difficulty}})
 * AC-2: 선택 난이도 pool.length < 3 → 시작 버튼 disabled + 차단 안내 텍스트 노출("문제가 아직 준비되지 않았어요")
 * AC-3: needsRecoveryDialog === true → AlertDialog 자동 오픈, '닫기' 버튼 + '데이터 초기화로 복구' CTA
 *
 * Difficulty label convention used by these tests (Home.tsx MUST render these exact labels):
 *   BEGINNER -> "초급", INTERMEDIATE -> "중급", ADVANCED -> "고급"
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

// ── @/lib/quizBank/index mock (controllable pool sizes per difficulty) ──
const { quizBankState } = vi.hoisted(() => ({
  quizBankState: { byDifficulty: {} as Record<string, Array<{ id: string }>> },
}));
vi.mock("@/lib/quizBank/index", () => ({
  getQuizBankIndex: () => ({ byId: {}, byDifficulty: quizBankState.byDifficulty }),
}));

function resetQuizBankPools() {
  quizBankState.byDifficulty = {
    BEGINNER: Array.from({ length: 6 }, (_, i) => ({ id: `b${i}` })),
    INTERMEDIATE: Array.from({ length: 6 }, (_, i) => ({ id: `i${i}` })),
    ADVANCED: Array.from({ length: 6 }, (_, i) => ({ id: `a${i}` })),
  };
}

function makeUserProgress(): UserProgress {
  return {
    id: "user-1",
    clientId: "user-1",
    nickname: "게스트",
    iqTotal: 0,
    streak: { current: 0, best: 0 },
    aiDisclosureAccepted: false,
    createdAtISO: "2026-07-14T00:00:00.000Z",
    updatedAtISO: "2026-07-14T00:00:00.000Z",
  };
}

function makeStoreState(overrides: Partial<ReturnType<typeof makeStoreState>> = {}) {
  return {
    userProgress: makeUserProgress(),
    needsRecoveryDialog: false,
    currentSession: null,
    quotaExceededForSession: false,
    startTodaySession: vi.fn(),
    answerQuestion: vi.fn(),
    ...overrides,
  };
}

// Import Home AFTER mocks are registered (module not implemented yet — TDD red phase).
const Home = () => require("@/pages/Home").default;

describe("홈(/) 페이지: 난이도 선택 + 시작 로딩 + 문제 부족 차단 + 복구 다이얼로그", () => {
  beforeEach(() => {
    resetQuizBankPools();
    mockUseAppStore.mockReset();
    mockNavigate.mockReset();
  });

  // ==========================================================================
  // AC-1: 난이도 선택 -> 시작 탭 -> startTodaySession + navigate('/quiz', {state:{difficulty}})
  // ==========================================================================

  describe("AC-1: 난이도 선택 후 시작 시 startTodaySession + navigate", () => {
    it("AC-1[P0]: '중급' 선택 후 '오늘 퀴즈 시작' 탭 시 startTodaySession('INTERMEDIATE')와 navigate('/quiz', {state:{difficulty:'INTERMEDIATE'}})가 호출된다", () => {
      const state = makeStoreState();
      mockUseAppStore.mockReturnValue(state);
      const HomePage = Home();

      renderWithRouter(React.createElement(HomePage));

      fireEvent.click(screen.getByText("중급"));
      fireEvent.click(screen.getByRole("button", { name: "오늘 퀴즈 시작" }));

      expect(state.startTodaySession).toHaveBeenCalledWith("INTERMEDIATE");
      expect(mockNavigate).toHaveBeenCalledWith("/quiz", { state: { difficulty: "INTERMEDIATE" } });
    });

    it("AC-1[P0]: 난이도를 '고급'으로 바꿔 시작하면 startTodaySession('ADVANCED')와 navigate('/quiz', {state:{difficulty:'ADVANCED'}})가 호출된다", () => {
      const state = makeStoreState();
      mockUseAppStore.mockReturnValue(state);
      const HomePage = Home();

      renderWithRouter(React.createElement(HomePage));

      fireEvent.click(screen.getByText("고급"));
      fireEvent.click(screen.getByRole("button", { name: "오늘 퀴즈 시작" }));

      expect(state.startTodaySession).toHaveBeenCalledWith("ADVANCED");
      expect(mockNavigate).toHaveBeenCalledWith("/quiz", { state: { difficulty: "ADVANCED" } });
    });
  });

  // ==========================================================================
  // AC-2: 문제 풀 부족 시 시작 차단
  // ==========================================================================

  describe("AC-2: 문제 풀(pool) 길이가 3 미만이면 시작 차단", () => {
    it("AC-2[P0]: '고급' pool이 2문항뿐이면 '고급' 선택 시 시작 버튼이 disabled이고 차단 안내 텍스트가 노출된다", () => {
      quizBankState.byDifficulty.ADVANCED = [{ id: "a0" }, { id: "a1" }];
      const state = makeStoreState();
      mockUseAppStore.mockReturnValue(state);
      const HomePage = Home();

      renderWithRouter(React.createElement(HomePage));

      fireEvent.click(screen.getByText("고급"));

      const startButton = screen.getByRole("button", { name: "오늘 퀴즈 시작" });
      expect(startButton).toBeDisabled();
      expect(screen.getByText(/문제가 아직 준비되지 않았어요/)).toBeInTheDocument();

      fireEvent.click(startButton);
      expect(state.startTodaySession).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("AC-2[P0]: '고급' pool은 부족해도 '초급'(6문항)을 선택하면 시작 버튼이 활성화되고 차단 텍스트가 없다", () => {
      quizBankState.byDifficulty.ADVANCED = [{ id: "a0" }, { id: "a1" }];
      const state = makeStoreState();
      mockUseAppStore.mockReturnValue(state);
      const HomePage = Home();

      renderWithRouter(React.createElement(HomePage));

      fireEvent.click(screen.getByText("초급"));

      const startButton = screen.getByRole("button", { name: "오늘 퀴즈 시작" });
      expect(startButton).not.toBeDisabled();
      expect(screen.queryByText(/문제가 아직 준비되지 않았어요/)).not.toBeInTheDocument();

      fireEvent.click(startButton);
      expect(state.startTodaySession).toHaveBeenCalledWith("BEGINNER");
      expect(mockNavigate).toHaveBeenCalledWith("/quiz", { state: { difficulty: "BEGINNER" } });
    });
  });

  // ==========================================================================
  // AC-3: needsRecoveryDialog -> 복구 안내 AlertDialog
  // ==========================================================================

  describe("AC-3: needsRecoveryDialog=true 시 복구 안내 다이얼로그", () => {
    it("AC-3[P0]: needsRecoveryDialog=true이면 AlertDialog가 자동으로 열리고 '닫기' 버튼과 '데이터 초기화로 복구' CTA가 존재한다", () => {
      const state = makeStoreState({ needsRecoveryDialog: true, userProgress: null });
      mockUseAppStore.mockReturnValue(state);
      const HomePage = Home();

      renderWithRouter(React.createElement(HomePage));

      const dialog = screen.getByRole("alertdialog");
      expect(dialog).toBeInTheDocument();

      const closeButton = screen.getByRole("button", { name: "닫기" });
      expect(closeButton).toBeInTheDocument();

      const recoveryCta = screen.getByRole("button", { name: /데이터 초기화로 복구/ });
      expect(recoveryCta).toBeInTheDocument();
    });

    it("AC-3[P0]: needsRecoveryDialog=false이면 복구 안내 AlertDialog가 렌더되지 않는다", () => {
      const state = makeStoreState({ needsRecoveryDialog: false });
      mockUseAppStore.mockReturnValue(state);
      const HomePage = Home();

      renderWithRouter(React.createElement(HomePage));

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });
});
