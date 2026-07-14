export type HttpErrorCode = "NETWORK_ERROR" | "PARSE_ERROR" | "HTTP_ERROR";

export interface HttpSuccess<T> {
  ok: true;
  status: number;
  data: T;
  headers: Headers;
}

export interface HttpFailure {
  ok: false;
  status?: number;
  error: HttpErrorCode;
  headers?: Headers;
}

export type HttpResult<T> = HttpSuccess<T> | HttpFailure;

export interface HttpRequestOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

async function parseJsonBody<T>(
  response: Response
): Promise<{ ok: true; data: T } | { ok: false }> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    return { ok: false };
  }

  if (text.length === 0) {
    return { ok: true, data: null as T };
  }

  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return { ok: false };
  }
}

async function request<T>(url: string, init: RequestInit): Promise<HttpResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    return { ok: false, error: "NETWORK_ERROR" };
  }

  if (!response.ok) {
    return { ok: false, status: response.status, error: "HTTP_ERROR", headers: response.headers };
  }

  const parsed = await parseJsonBody<T>(response);
  if (!parsed.ok) {
    return { ok: false, status: response.status, error: "PARSE_ERROR", headers: response.headers };
  }

  return { ok: true, status: response.status, data: parsed.data, headers: response.headers };
}

export function httpGetJSON<T = unknown>(
  url: string,
  options?: HttpRequestOptions
): Promise<HttpResult<T>> {
  return request<T>(url, {
    method: "GET",
    headers: options?.headers,
    signal: options?.signal,
  });
}

export function httpPostJSON<T = unknown, B = unknown>(
  url: string,
  body: B,
  options?: HttpRequestOptions
): Promise<HttpResult<T>> {
  return request<T>(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    body: JSON.stringify(body),
    signal: options?.signal,
  });
}
