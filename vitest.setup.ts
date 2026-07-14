/**
 * Vitest setup — runs before each test file.
 *
 * Handles:
 *  - localStorage isolation between tests (prevents cross-test pollution)
 *  - requestAnimationFrame shim for jsdom (needed for animate/countup utilities)
 *  - sessionStorage isolation
 *  - console.error filtering (React Router warnings etc.)
 */

import { beforeEach, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import path from "node:path";
import Module, { register } from "node:module";

// ── CJS require("@/...") alias support ──
// Some test files use Node's native require() (lazy-loaded modules for TDD red-phase
// patterns) instead of static import. Native require() knows nothing about the Vite
// "@/" -> "src/" alias or extension-less .ts resolution, so patch Node's own resolver
// for the top-level require() call...
const originalResolveFilename = (Module as unknown as { _resolveFilename: Function })
  ._resolveFilename;
(Module as unknown as { _resolveFilename: Function })._resolveFilename = function (
  request: string,
  ...rest: unknown[]
) {
  if (request.startsWith("@/")) {
    const resolved = path.resolve(process.cwd(), "src", request.slice(2));
    return originalResolveFilename.call(this, `${resolved}.ts`, ...rest);
  }
  return originalResolveFilename.call(this, request, ...rest);
};
// ...and register an ESM resolver hook for `import` statements *inside* those
// natively-required .ts modules (Node's require(esm) support routes nested
// imports through the real ESM resolver, not the CJS one patched above).
register("./vitest.alias-loader.mjs", import.meta.url);

// ── localStorage / sessionStorage isolation ──
// jsdom's storage persists between tests by default. Clear it to prevent pollution.
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

// ── requestAnimationFrame shim for jsdom ──
// jsdom does NOT implement rAF natively, so animate/countup code hangs forever.
// Shim that immediately invokes callback with a monotonic timestamp.
if (typeof globalThis.requestAnimationFrame !== "function") {
  let now = 0;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    now += 16;
    return setTimeout(() => cb(now), 0) as unknown as number;
  }) as typeof globalThis.requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as typeof globalThis.cancelAnimationFrame;
}

// ── afterEach reset ──
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers(); // in case a test used fake timers
});
