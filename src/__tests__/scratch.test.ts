import { describe, it, expect } from "vitest";

// Leftover debug probe: sandbox `rm`/`mv` on files under __tests__/ is blocked in this
// session so this stray file could not be deleted. Safe to delete manually later.
describe("scratch (inert)", () => {
  it("noop", () => {
    expect(true).toBe(true);
  });
});
