// Node ESM loader hook used only under `vitest run`.
//
// Some test files load implementation modules lazily via native
// `require("@/lib/...")` (a TDD red-phase pattern) instead of static import.
// Node's own `require(esm)` support then resolves any nested `import`
// statements inside those files through Node's real ESM resolver — which
// knows nothing about Vite's "@/" -> "src/" alias or extension-less ".ts"
// specifiers. This hook teaches Node's resolver both, but only for this
// process (registered from vitest.setup.ts), so app code / production
// builds are unaffected.
import { pathToFileURL } from "node:url";

const ROOT_URL = pathToFileURL(`${process.cwd()}/`);
const CANDIDATE_EXTENSIONS = ["", ".ts", ".tsx", "/index.ts"];

async function resolveWithCandidates(baseHref, context, nextResolve) {
  let lastError;
  for (const suffix of CANDIDATE_EXTENSIONS) {
    try {
      return await nextResolve(`${baseHref}${suffix}`, context);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const target = new URL(`src/${specifier.slice(2)}`, ROOT_URL).href;
    return resolveWithCandidates(target, context, nextResolve);
  }

  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    try {
      return await nextResolve(specifier, context);
    } catch {
      const target = new URL(specifier, context.parentURL).href;
      return resolveWithCandidates(target, context, nextResolve);
    }
  }

  return nextResolve(specifier, context);
}
