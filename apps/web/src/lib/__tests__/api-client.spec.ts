/**
 * @jest-environment node
 */

import { apiClient, CLEAR_SESSION_PATH } from "../api-client";
import { navigateTo } from "../navigate";

jest.mock("../navigate", () => ({ navigateTo: jest.fn() }));

const navigateToMock = navigateTo as jest.MockedFunction<typeof navigateTo>;
const ORIGINAL_FETCH = global.fetch;

function mockJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockEmptyResponse(status = 204): Response {
  return new Response(null, { status });
}

beforeEach(() => {
  navigateToMock.mockReset();
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
});

describe("apiClient.get", () => {
  it("returns parsed JSON on 2xx", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(mockJsonResponse({ id: "u_1", name: "Ada" }));

    const result = await apiClient.get<{ id: string; name: string }>(
      "/api/users/me",
    );

    expect(result).toEqual({ id: "u_1", name: "Ada" });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/users/me",
      expect.objectContaining({
        method: "GET",
        credentials: "same-origin",
      }),
    );
  });

  it("navigates to the clear-session route on 401 and throws", async () => {
    global.fetch = jest.fn().mockResolvedValue(mockEmptyResponse(401));

    await expect(apiClient.get("/api/users/me")).rejects.toThrow();

    expect(navigateToMock).toHaveBeenCalledWith(CLEAR_SESSION_PATH);
  });

  it("throws on other non-2xx statuses without navigating", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(mockJsonResponse({ message: "boom" }, 500));

    await expect(apiClient.get("/api/users/me")).rejects.toThrow(/500/);
    expect(navigateToMock).not.toHaveBeenCalled();
  });
});

describe("apiClient.delete", () => {
  it("issues a DELETE with credentials and resolves on 204", async () => {
    global.fetch = jest.fn().mockResolvedValue(mockEmptyResponse(204));

    await apiClient.delete("/api/users/me/sessions/s_1");

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/users/me/sessions/s_1",
      expect.objectContaining({
        method: "DELETE",
        credentials: "same-origin",
      }),
    );
  });

  it("navigates to the clear-session route on 401", async () => {
    global.fetch = jest.fn().mockResolvedValue(mockEmptyResponse(401));

    await expect(
      apiClient.delete("/api/users/me/sessions/s_1"),
    ).rejects.toThrow();

    expect(navigateToMock).toHaveBeenCalledWith(CLEAR_SESSION_PATH);
  });
});

describe("apiClient.post", () => {
  it("serializes a JSON body and forwards the Content-Type", async () => {
    global.fetch = jest.fn().mockResolvedValue(mockJsonResponse({ ok: true }));

    await apiClient.post("/api/things", { body: { name: "Ada" } });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/things",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Ada" }),
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });
});
