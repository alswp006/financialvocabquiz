import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

// VirtualList is a thin wrapper around react-window's FixedSizeList.
// Contract (per packet spec):
//   <VirtualList
//     itemCount={number}
//     itemSize={number}      // px height per row; enforced minimum 44 (touch target)
//     renderItem={(props: { index: number; style: React.CSSProperties }) => React.ReactNode}
//     height={number}        // px height of the scrollable viewport (required — react-window needs an explicit size)
//     width?={number | string}
//     testId?={string}
//   />
// This does NOT mock "react-window" — it renders the real package against jsdom so the
// test verifies actual virtualization behavior (only a subset of itemCount rows in the DOM).
import { VirtualList } from "@/components/VirtualList";

describe("VirtualList 공용 컴포넌트(react-window) + 50+ 목록 가상 스크롤 기반", () => {
  describe("AC-1: react-window 기반 렌더링 + 스크롤 가능한 컨테이너", () => {
    it("AC-1[P0]: itemCount, itemSize, renderItem으로 리스트를 렌더링하고 뷰포트 밖 항목은 DOM에 만들지 않는다(가상화)", () => {
      const itemCount = 100;
      render(
        React.createElement(VirtualList, {
          itemCount,
          itemSize: 50,
          height: 200,
          testId: "my-virtual-list",
          renderItem: ({ index, style }: { index: number; style: React.CSSProperties }) =>
            React.createElement(
              "div",
              { key: index, role: "listitem", style },
              `Item ${index}`,
            ),
        }),
      );

      const rendered = screen.getAllByRole("listitem");
      // Viewport is 200px tall / 50px rows => only ~4-5 rows (plus overscan) should exist,
      // never all 100 — this is the whole point of virtualization.
      expect(rendered.length).toBeGreaterThan(0);
      expect(rendered.length).toBeLessThan(itemCount);
      expect(screen.getByText("Item 0").textContent).toBe("Item 0");
    });

    it("AC-1[P0]: 최상위 컨테이너는 overflow(auto|scroll)로 스크롤 가능하다", () => {
      render(
        React.createElement(VirtualList, {
          itemCount: 100,
          itemSize: 50,
          height: 200,
          testId: "my-virtual-list",
          renderItem: ({ index, style }: { index: number; style: React.CSSProperties }) =>
            React.createElement("div", { key: index, role: "listitem", style }, `Item ${index}`),
        }),
      );

      const container = screen.getByTestId("my-virtual-list");
      const overflow = container.style.overflow || container.style.overflowY;
      expect(["auto", "scroll"]).toContain(overflow);
    });

    it("AC-1: itemCount가 0이면 크래시 없이 빈 리스트를 렌더링한다", () => {
      render(
        React.createElement(VirtualList, {
          itemCount: 0,
          itemSize: 50,
          height: 200,
          testId: "empty-virtual-list",
          renderItem: ({ index, style }: { index: number; style: React.CSSProperties }) =>
            React.createElement("div", { key: index, role: "listitem", style }, `Item ${index}`),
        }),
      );

      expect(screen.queryAllByRole("listitem").length).toBe(0);
      expect(screen.getByTestId("empty-virtual-list").tagName).toBe("DIV");
    });
  });

  describe("AC-2: itemSize 최소 44px 강제(터치 타깃)", () => {
    it("AC-2[P0]: itemSize를 지정하지 않으면 기본값이 44px 이상으로 적용된다", () => {
      render(
        React.createElement(VirtualList, {
          itemCount: 10,
          height: 200,
          testId: "default-size-list",
          renderItem: ({ index, style }: { index: number; style: React.CSSProperties }) =>
            React.createElement(
              "div",
              { key: index, role: "listitem", "data-testid": `row-${index}`, style },
              `Item ${index}`,
            ),
        }),
      );

      const row0 = screen.getByTestId("row-0");
      const heightPx = parseFloat(row0.style.height);
      expect(Number.isNaN(heightPx)).toBe(false);
      expect(heightPx).toBeGreaterThanOrEqual(44);
    });

    it("AC-2[P0]: 44px 미만의 itemSize를 전달해도 실제 렌더 높이는 44px 미만으로 내려가지 않는다(클램프)", () => {
      render(
        React.createElement(VirtualList, {
          itemCount: 10,
          itemSize: 20,
          height: 200,
          testId: "clamped-size-list",
          renderItem: ({ index, style }: { index: number; style: React.CSSProperties }) =>
            React.createElement(
              "div",
              { key: index, role: "listitem", "data-testid": `clamped-row-${index}`, style },
              `Item ${index}`,
            ),
        }),
      );

      const row0 = screen.getByTestId("clamped-row-0");
      const heightPx = parseFloat(row0.style.height);
      expect(Number.isNaN(heightPx)).toBe(false);
      expect(heightPx).toBeGreaterThanOrEqual(44);
    });
  });

  describe("AC-3: TDS 여백을 덮어쓰지 않는 최소 레이아웃 스타일", () => {
    it("AC-3[P0]: 최상위 컨테이너는 인라인 padding/margin을 추가하지 않는다(레이아웃용 height/width/overflow만 허용)", () => {
      render(
        React.createElement(VirtualList, {
          itemCount: 10,
          itemSize: 44,
          height: 200,
          testId: "no-padding-list",
          renderItem: ({ index, style }: { index: number; style: React.CSSProperties }) =>
            React.createElement("div", { key: index, role: "listitem", style }, `Item ${index}`),
        }),
      );

      const container = screen.getByTestId("no-padding-list");
      expect(container.style.padding).toBe("");
      expect(container.style.margin).toBe("");
    });

    it("AC-3: height/width props를 통해 컨테이너 크기를 명시적으로 지정할 수 있다", () => {
      render(
        React.createElement(VirtualList, {
          itemCount: 10,
          itemSize: 44,
          height: 321,
          width: 280,
          testId: "sized-list",
          renderItem: ({ index, style }: { index: number; style: React.CSSProperties }) =>
            React.createElement("div", { key: index, role: "listitem", style }, `Item ${index}`),
        }),
      );

      const container = screen.getByTestId("sized-list");
      expect(container.style.height).toBe("321px");
      expect(container.style.width).toBe("280px");
    });
  });
});
