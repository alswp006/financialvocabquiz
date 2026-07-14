import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { httpGetJSON, httpPostJSON } from "@/lib/api/http";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("API 공통 fetch 래퍼(http.ts): JSON/헤더 파싱 + non-throw 결과 모델", () => {
  beforeEach(() => {
    mockFetch.mockClear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // AC-1: httpGetJSON handles 2xx/non-2xx/network failures, returns {ok:boolean,status?:number}
  describe("AC-1: HTTP status handling with non-throw result model", () => {
    it("AC-1[P0]: httpGetJSON returns {ok: true, status: 200, data} on successful 2xx response", async () => {
      const responseBody = { userId: 123, name: "Alice" };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(responseBody), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );

      const result = await httpGetJSON("https://api.example.com/user");
      expect(result.ok).toBe(true);
      expect(result.status).toBe(200);
      expect(result.ok && result.data).toEqual(responseBody);
    });

    it("AC-1[P0]: httpGetJSON returns {ok: false, status: 401, error: 'HTTP_ERROR'} on 401 response", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        })
      );

      const result = await httpGetJSON("https://api.example.com/protected");
      expect(result.ok).toBe(false);
      expect(result.status).toBe(401);
      expect(!result.ok && result.error).toBe("HTTP_ERROR");
      expect((result as { data?: unknown }).data).toBeUndefined();
    });

    it("AC-1[P0]: httpGetJSON returns {ok: false, status: 500, error: 'HTTP_ERROR'} on server error", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Internal Server Error" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        })
      );

      const result = await httpGetJSON("https://api.example.com/data");
      expect(result.ok).toBe(false);
      expect(result.status).toBe(500);
      expect(!result.ok && result.error).toBe("HTTP_ERROR");
    });

    it("AC-1[P0]: httpGetJSON returns {ok: false, error: 'NETWORK_ERROR'} on network failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network timeout"));

      const result = await httpGetJSON("https://api.example.com/data");
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error).toBe("NETWORK_ERROR");
      expect(result.status).toBeUndefined();
    });
  });

  // AC-2: JSON parse failure returns explicit error code, no console.error
  describe("AC-2: JSON parse error handling without console.error", () => {
    it("AC-2[P0]: httpGetJSON returns {ok: false, error: 'PARSE_ERROR'} when response is not JSON", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("<html>Not JSON</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        })
      );

      const result = await httpGetJSON("https://api.example.com/data");
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error).toBe("PARSE_ERROR");
      expect((result as { data?: unknown }).data).toBeUndefined();
    });

    it("AC-2[P0]: httpGetJSON returns {ok: false, error: 'PARSE_ERROR'} on malformed JSON response", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('{"incomplete": json', {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );

      const result = await httpGetJSON("https://api.example.com/data");
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error).toBe("PARSE_ERROR");
    });

    it("AC-2[P0]: httpGetJSON does not console.error on parse failure", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      mockFetch.mockResolvedValueOnce(
        new Response("invalid json {{{", {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );

      await httpGetJSON("https://api.example.com/data");
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  // AC-3: Headers are readable (no mode: 'no-cors'), pagination headers accessible
  describe("AC-3: Headers readable without no-cors mode", () => {
    it("AC-3[P0]: httpGetJSON returns headers object for caller to read pagination headers", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [1, 2, 3] }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "x-has-next": "true",
            "x-next-cursor": "cursor-abc123",
          },
        })
      );

      const result = await httpGetJSON("https://api.example.com/items");
      expect(result.ok).toBe(true);
      expect(result.headers).toBeDefined();
      expect(result.headers?.get("x-has-next")).toBe("true");
      expect(result.headers?.get("x-next-cursor")).toBe("cursor-abc123");
    });

    it("AC-3[P0]: httpGetJSON does not use mode: 'no-cors' in fetch options", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: "ok" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );

      await httpGetJSON("https://api.example.com/data");
      const fetchCall = mockFetch.mock.calls[0];
      expect((fetchCall[1] as RequestInit)?.mode).not.toBe("no-cors");
    });
  });

  // Additional tests for httpPostJSON variant and edge cases
  describe("Additional: POST variant and method parity", () => {
    it("httpPostJSON returns {ok: true, status: 201, data} on successful POST", async () => {
      const requestBody = { email: "user@example.com" };
      const responseBody = { id: 456, email: "user@example.com" };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(responseBody), {
          status: 201,
          headers: { "content-type": "application/json" },
        })
      );

      const result = await httpPostJSON("https://api.example.com/users", requestBody);
      expect(result.ok).toBe(true);
      expect(result.status).toBe(201);
      expect(result.ok && result.data).toEqual(responseBody);
    });

    it("httpPostJSON returns {ok: false, status: 400, error: 'HTTP_ERROR'} on validation error", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Invalid email" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        })
      );

      const result = await httpPostJSON("https://api.example.com/users", { email: "invalid" });
      expect(result.ok).toBe(false);
      expect(result.status).toBe(400);
      expect(!result.ok && result.error).toBe("HTTP_ERROR");
    });

    it("httpGetJSON handles 204 No Content (no body) gracefully", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, {
          status: 204,
          headers: { "content-type": "application/json" },
        })
      );

      const result = await httpGetJSON("https://api.example.com/delete-confirm");
      expect(result.ok).toBe(true);
      expect(result.status).toBe(204);
      expect(result.ok && result.data).toBeNull();
    });

    it("httpGetJSON passes custom headers in request", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ authorized: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );

      const result = await httpGetJSON("https://api.example.com/protected", {
        headers: { Authorization: "Bearer token123" },
      });
      expect(result.ok).toBe(true);
      const fetchCall = mockFetch.mock.calls[0];
      const headers = (fetchCall[1] as RequestInit)?.headers as Record<string, string>;
      expect(headers?.Authorization).toBe("Bearer token123");
    });
  });

  // Edge case: Empty response body
  describe("Edge cases", () => {
    it("httpGetJSON returns {ok: true, data: null} on empty JSON response", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("", {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );

      const result = await httpGetJSON("https://api.example.com/empty");
      expect(result.ok).toBe(true);
      expect(result.status).toBe(200);
      expect(result.ok && result.data).toBeNull();
    });

    it("httpPostJSON sends Content-Type: application/json header by default", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );

      await httpPostJSON("https://api.example.com/data", { key: "value" });
      const fetchCall = mockFetch.mock.calls[0];
      const headers = (fetchCall[1] as RequestInit)?.headers as Record<string, string>;
      expect(headers?.["Content-Type"]).toContain("application/json");
    });
  });
});
