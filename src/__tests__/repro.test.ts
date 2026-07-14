// Scratch repro file from investigating a require()/vi.mock incompatibility
// (see packet 0009 commit history). No longer needed — kept as a no-op
// because this sandbox cannot delete files.
import { describe, it, expect } from "vitest";

describe("repro (retired scratch file)", () => {
  it("no-op", () => {
    expect(true).toBe(true);
  });
});
