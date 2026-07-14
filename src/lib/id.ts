/**
 * ID generation utilities
 */

let counter = 0;

function randomSegment(): string {
  return Math.random().toString(36).slice(2, 10);
}

// crypto.randomUUID requires a secure context and is absent on some Android 7 WebViews,
// so fall back to a counter+random composite id rather than assuming it always exists.
function hasRandomUUID(): boolean {
  return (
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
  );
}

export function createId(prefix = "id"): string {
  counter += 1;

  if (hasRandomUUID()) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  const timestamp = Date.now().toString(36);
  const sequence = counter.toString(36);
  const random = randomSegment();
  return `${prefix}_${timestamp}${sequence}${random}`;
}
