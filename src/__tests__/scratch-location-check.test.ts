import { describe, it, expect } from "vitest";

// Leftover debug probe from investigating a mocks.ts vi.mock hoisting bug
// (fixed in __helpers__/mocks.ts — mockRouter() no longer unconditionally
// overrides useLocation for every test file that imports the helper).
// Sandbox `rm` is blocked in this session, so this is neutralized in place
// instead of deleted.
describe("scratch (inert)", () => {
  it("noop", () => {
    expect(true).toBe(true);
  });
});
