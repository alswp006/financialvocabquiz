import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Leaderboard API Client Tests (TDD Red Phase)
 *
 * These tests define the expected behavior for:
 * - fetchWeeklyLeaderboard(): GET /leaderboard/weekly with pagination
 * - submitWeeklyLeaderboard(): POST /leaderboard/weekly/submit
 *
 * Requirements:
 * - No throw/console.error on any failure
 * - Parse response headers (X-Has-Next, X-Next-Cursor)
 * - Return typed results with status codes
 * - DO NOT use mode:"no-cors"
 */

// Mock global fetch
global.fetch = vi.fn();

describe("Leaderboard API Client (leaderboard.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure VITE_LEADERBOARD_BASE_URL is set in test env
    import.meta.env.VITE_LEADERBOARD_BASE_URL = "https://api.example.com";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // AC-1: fetchWeeklyLeaderboard GET request and response parsing
  // ============================================================================

  describe("AC-1: fetchWeeklyLeaderboard", () => {
    it("AC-1[P0]: should GET /leaderboard/weekly with weekId, limit, cursor query params", async () => {
      // Arrange
      const mockEntries = [
        {
          id: "entry1",
          weekId: "week-001",
          clientId: "client-1",
          nickname: "Alice",
          weeklyIqDelta: 150,
          rank: 1,
          createdAtISO: "2026-07-14T10:00:00Z",
          updatedAtISO: "2026-07-14T10:00:00Z",
        },
        {
          id: "entry2",
          weekId: "week-001",
          clientId: "client-2",
          nickname: "Bob",
          weeklyIqDelta: 120,
          rank: 2,
          createdAtISO: "2026-07-14T10:01:00Z",
          updatedAtISO: "2026-07-14T10:01:00Z",
        },
      ];

      const mockResponse = new Response(JSON.stringify({ entries: mockEntries }), {
        status: 200,
        headers: {
          "X-Has-Next": "true",
          "X-Next-Cursor": "cursor-123",
          "Content-Type": "application/json",
        },
      });

      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse);

      // Act
      const { fetchWeeklyLeaderboard } = await import("@/lib/api/leaderboard");
      const result = await fetchWeeklyLeaderboard({
        weekId: "week-001",
        limit: 10,
        cursor: undefined,
      });

      // Assert
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        expect.stringContaining("https://api.example.com/leaderboard/weekly"),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({ "Content-Type": "application/json" }),
        })
      );

      // Verify query params in URL
      const callUrl = vi.mocked(global.fetch).mock.calls[0][0] as string;
      expect(callUrl).toContain("weekId=week-001");
      expect(callUrl).toContain("limit=10");

      // Verify response parsing
      expect(result.status).toBe(200);
      expect(result.data?.entries).toEqual(mockEntries);
      expect(result.data?.hasNext).toBe(true);
      expect(result.data?.nextCursor).toBe("cursor-123");
    });

    it("AC-1[P0]: should include cursor in URL when provided", async () => {
      // Arrange
      const mockResponse = new Response(
        JSON.stringify({ entries: [] }),
        { status: 200, headers: { "X-Has-Next": "false" } }
      );
      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse);

      // Act
      const { fetchWeeklyLeaderboard } = await import("@/lib/api/leaderboard");
      await fetchWeeklyLeaderboard({
        weekId: "week-002",
        limit: 20,
        cursor: "cursor-456",
      });

      // Assert
      const callUrl = vi.mocked(global.fetch).mock.calls[0][0] as string;
      expect(callUrl).toContain("cursor=cursor-456");
    });

    it("AC-1[P0]: should parse X-Has-Next and X-Next-Cursor headers on 200", async () => {
      // Arrange
      const mockResponse = new Response(JSON.stringify({ entries: [] }), {
        status: 200,
        headers: {
          "X-Has-Next": "false",
          "X-Next-Cursor": "",
          "Content-Type": "application/json",
        },
      });
      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse);

      // Act
      const { fetchWeeklyLeaderboard } = await import("@/lib/api/leaderboard");
      const result = await fetchWeeklyLeaderboard({
        weekId: "week-003",
        limit: 10,
      });

      // Assert
      expect(result.status).toBe(200);
      expect(result.data?.hasNext).toBe(false);
      expect(result.data?.nextCursor).toBe("");
    });

    it("AC-1[P0]: should return error status on network failure without throwing", async () => {
      // Arrange
      vi.mocked(global.fetch).mockRejectedValueOnce(
        new Error("Network timeout")
      );

      // Act
      const { fetchWeeklyLeaderboard } = await import("@/lib/api/leaderboard");
      const result = await fetchWeeklyLeaderboard({
        weekId: "week-004",
        limit: 10,
      });

      // Assert
      expect(result.status).toBeLessThan(200);
      expect(result.error?.code).toBe("NETWORK_ERROR");
      expect(result.data).toBeUndefined();
    });

    it("AC-1[P0]: should return error on 400 Bad Request without throwing", async () => {
      // Arrange
      const mockResponse = new Response(
        JSON.stringify({ error: { code: "INVALID_WEEK_ID", message: "Week ID format invalid" } }),
        { status: 400 }
      );
      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse);

      // Act
      const { fetchWeeklyLeaderboard } = await import("@/lib/api/leaderboard");
      const result = await fetchWeeklyLeaderboard({
        weekId: "invalid-week",
        limit: 10,
      });

      // Assert
      expect(result.status).toBe(400);
      expect(result.error?.code).toBe("INVALID_WEEK_ID");
      expect(result.data).toBeUndefined();
    });

    it("AC-1[P0]: should return error on 500 Server Error without throwing", async () => {
      // Arrange
      const mockResponse = new Response(
        JSON.stringify({ error: { code: "SERVER_ERROR", message: "Internal server error" } }),
        { status: 500 }
      );
      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse);

      // Act
      const { fetchWeeklyLeaderboard } = await import("@/lib/api/leaderboard");
      const result = await fetchWeeklyLeaderboard({
        weekId: "week-005",
        limit: 10,
      });

      // Assert
      expect(result.status).toBe(500);
      expect(result.error?.code).toBe("SERVER_ERROR");
    });
  });

  // ============================================================================
  // AC-2: submitWeeklyLeaderboard POST request and response parsing
  // ============================================================================

  describe("AC-2: submitWeeklyLeaderboard", () => {
    it("AC-2[P0]: should POST to /leaderboard/weekly/submit with request body", async () => {
      // Arrange
      const mockEntry = {
        id: "entry-new-1",
        weekId: "week-001",
        clientId: "client-3",
        nickname: "Charlie",
        weeklyIqDelta: 200,
        createdAtISO: "2026-07-14T11:00:00Z",
        updatedAtISO: "2026-07-14T11:00:00Z",
      };

      const mockResponse = new Response(
        JSON.stringify({ entry: mockEntry, rank: 1 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse);

      // Act
      const { submitWeeklyLeaderboard } = await import("@/lib/api/leaderboard");
      const result = await submitWeeklyLeaderboard({
        weekId: "week-001",
        clientId: "client-3",
        nickname: "Charlie",
        weeklyIqDelta: 200,
      });

      // Assert
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        expect.stringContaining("https://api.example.com/leaderboard/weekly/submit"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            weekId: "week-001",
            clientId: "client-3",
            nickname: "Charlie",
            weeklyIqDelta: 200,
          }),
        })
      );

      expect(result.status).toBe(200);
      expect(result.data?.entry).toEqual(mockEntry);
      expect(result.data?.rank).toBe(1);
    });

    it("AC-2[P0]: should return entry with id and ISO timestamps on 200", async () => {
      // Arrange
      const mockEntry = {
        id: "entry-new-2",
        weekId: "week-002",
        clientId: "client-4",
        nickname: "Diana",
        weeklyIqDelta: 180,
        createdAtISO: "2026-07-14T12:00:00Z",
        updatedAtISO: "2026-07-14T12:00:00Z",
      };

      const mockResponse = new Response(
        JSON.stringify({ entry: mockEntry, rank: 2 }),
        { status: 200 }
      );
      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse);

      // Act
      const { submitWeeklyLeaderboard } = await import("@/lib/api/leaderboard");
      const result = await submitWeeklyLeaderboard({
        weekId: "week-002",
        clientId: "client-4",
        nickname: "Diana",
        weeklyIqDelta: 180,
      });

      // Assert
      expect(result.data?.entry?.id).toBe("entry-new-2");
      expect(result.data?.entry?.createdAtISO).toBe("2026-07-14T12:00:00Z");
      expect(result.data?.entry?.updatedAtISO).toBe("2026-07-14T12:00:00Z");
      expect(result.data?.rank).toBe(2);
    });

    it("AC-2[P0]: should return error on 400 Bad Request without throwing", async () => {
      // Arrange
      const mockResponse = new Response(
        JSON.stringify({ error: { code: "DUPLICATE_ENTRY", message: "User already submitted this week" } }),
        { status: 400 }
      );
      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse);

      // Act
      const { submitWeeklyLeaderboard } = await import("@/lib/api/leaderboard");
      const result = await submitWeeklyLeaderboard({
        weekId: "week-001",
        clientId: "client-5",
        nickname: "Eve",
        weeklyIqDelta: 150,
      });

      // Assert
      expect(result.status).toBe(400);
      expect(result.error?.code).toBe("DUPLICATE_ENTRY");
      expect(result.data).toBeUndefined();
    });

    it("AC-2[P0]: should return error on network failure without throwing", async () => {
      // Arrange
      vi.mocked(global.fetch).mockRejectedValueOnce(
        new Error("Connection refused")
      );

      // Act
      const { submitWeeklyLeaderboard } = await import("@/lib/api/leaderboard");
      const result = await submitWeeklyLeaderboard({
        weekId: "week-001",
        clientId: "client-6",
        nickname: "Frank",
        weeklyIqDelta: 100,
      });

      // Assert
      expect(result.status).toBeLessThan(200);
      expect(result.error?.code).toBe("NETWORK_ERROR");
    });
  });

  // ============================================================================
  // AC-3: Error handling (no throw, no console.error, no mode:no-cors)
  // ============================================================================

  describe("AC-3: Error handling and fetch configuration", () => {
    it("AC-3[P0]: should NOT use mode:no-cors in fetch calls", async () => {
      // Arrange
      const mockResponse = new Response(JSON.stringify({ entries: [] }), {
        status: 200,
        headers: { "X-Has-Next": "false" },
      });
      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse);

      // Act
      const { fetchWeeklyLeaderboard } = await import("@/lib/api/leaderboard");
      await fetchWeeklyLeaderboard({ weekId: "week-001", limit: 10 });

      // Assert
      const fetchOptions = vi.mocked(global.fetch).mock.calls[0][1] as RequestInit;
      expect(fetchOptions.mode).not.toBe("no-cors");
    });

    it("AC-3[P0]: should NOT console.error on any failure", async () => {
      // Arrange
      const consoleErrorSpy = vi.spyOn(console, "error");
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error("Network error"));

      // Act
      const { fetchWeeklyLeaderboard } = await import("@/lib/api/leaderboard");
      await fetchWeeklyLeaderboard({ weekId: "week-001", limit: 10 });

      // Assert
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("AC-3[P0]: submitWeeklyLeaderboard should NOT throw on 401 Unauthorized", async () => {
      // Arrange
      const mockResponse = new Response(
        JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Invalid client" } }),
        { status: 401 }
      );
      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse);

      // Act & Assert
      const { submitWeeklyLeaderboard } = await import("@/lib/api/leaderboard");
      let didThrow = false;
      try {
        await submitWeeklyLeaderboard({
          weekId: "week-001",
          clientId: "client-invalid",
          nickname: "Grace",
          weeklyIqDelta: 100,
        });
      } catch {
        didThrow = true;
      }
      expect(didThrow).toBe(false);
    });

    it("AC-3[P0]: fetchWeeklyLeaderboard should NOT throw on malformed response", async () => {
      // Arrange
      const mockResponse = new Response("invalid json", { status: 200 });
      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse);

      // Act & Assert
      const { fetchWeeklyLeaderboard } = await import("@/lib/api/leaderboard");
      let didThrow = false;
      try {
        await fetchWeeklyLeaderboard({ weekId: "week-001", limit: 10 });
      } catch {
        didThrow = true;
      }
      expect(didThrow).toBe(false);

      // Verify error is returned, not thrown
      vi.mocked(global.fetch).mockResolvedValueOnce(new Response("invalid json", { status: 200 }));
      const result = await fetchWeeklyLeaderboard({ weekId: "week-001", limit: 10 });
      expect(result.error?.code).toBe("PARSE_ERROR");
    });
  });

  // ============================================================================
  // Additional edge cases
  // ============================================================================

  describe("Edge cases", () => {
    it("should handle empty entries list on success", async () => {
      // Arrange
      const mockResponse = new Response(JSON.stringify({ entries: [] }), {
        status: 200,
        headers: { "X-Has-Next": "false" },
      });
      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse);

      // Act
      const { fetchWeeklyLeaderboard } = await import("@/lib/api/leaderboard");
      const result = await fetchWeeklyLeaderboard({
        weekId: "week-empty",
        limit: 10,
      });

      // Assert
      expect(result.status).toBe(200);
      expect(result.data?.entries).toEqual([]);
      expect(result.data?.hasNext).toBe(false);
    });

    it("should handle missing optional cursor parameter", async () => {
      // Arrange
      const mockResponse = new Response(JSON.stringify({ entries: [] }), {
        status: 200,
        headers: { "X-Has-Next": "false" },
      });
      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse);

      // Act
      const { fetchWeeklyLeaderboard } = await import("@/lib/api/leaderboard");
      const result = await fetchWeeklyLeaderboard({
        weekId: "week-001",
        limit: 10,
      }); // cursor is optional

      // Assert
      expect(result.status).toBe(200);
      const callUrl = vi.mocked(global.fetch).mock.calls[0][0] as string;
      expect(callUrl).not.toContain("cursor=undefined");
    });
  });
});
