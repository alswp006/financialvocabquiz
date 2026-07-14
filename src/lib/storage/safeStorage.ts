export type SafeStorageError = "CORRUPTED" | "QUOTA_EXCEEDED" | "UNKNOWN";

export type SafeStorageResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: SafeStorageError };

export type SafeVoidResult = { ok: true } | { ok: false; error: SafeStorageError };

function isQuotaExceededError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as DOMException).code;
  return (
    err.name === "QuotaExceededError" ||
    err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    code === 22 ||
    code === 1014
  );
}

export function safeGetJSON<T = unknown>(key: string): SafeStorageResult<T | null> {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return { ok: true, data: null };
    }
    try {
      return { ok: true, data: JSON.parse(raw) as T };
    } catch {
      return { ok: false, error: "CORRUPTED" };
    }
  } catch {
    return { ok: false, error: "UNKNOWN" };
  }
}

export function safeSetJSON<T = unknown>(key: string, value: T): SafeVoidResult {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (err) {
    if (isQuotaExceededError(err)) {
      return { ok: false, error: "QUOTA_EXCEEDED" };
    }
    return { ok: false, error: "UNKNOWN" };
  }
}

export function safeRemove(key: string): SafeVoidResult {
  try {
    localStorage.removeItem(key);
    return { ok: true };
  } catch {
    return { ok: false, error: "UNKNOWN" };
  }
}
