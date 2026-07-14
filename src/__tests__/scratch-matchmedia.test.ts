import { describe, it, expect } from "vitest";

// Leftover debug probe (sandbox rm blocked this session — see scratch.test.ts for
// the same note). Confirmed jsdom has no window.matchMedia, so CountUp's
// canAnimate check safely resolves to false and renders synchronously in tests.
describe("scratch (inert)", () => {
  it("noop", () => {
    expect(true).toBe(true);
  });
});
