import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { apiClient } from "@/lib/api-client";
import Page from "../page";

jest.mock("@/lib/api-client", () => ({
  apiClient: { get: jest.fn(), delete: jest.fn() },
}));

const getMock = apiClient.get as jest.MockedFunction<typeof apiClient.get>;
const deleteMock = apiClient.delete as jest.MockedFunction<
  typeof apiClient.delete
>;

function renderPage(): ReturnType<typeof render> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Page />
    </QueryClientProvider>,
  );
}

describe("Sessions page", () => {
  beforeEach(() => {
    getMock.mockReset();
    deleteMock.mockReset();
  });

  it("renders one row per session with the current device tagged", async () => {
    getMock.mockResolvedValueOnce([
      {
        id: "s_current",
        deviceLabel: "Chrome on macOS",
        lastActiveAt: "2026-05-31T15:00:00.000Z",
        isCurrent: true,
      },
      {
        id: "s_other",
        deviceLabel: "Safari on iOS",
        lastActiveAt: "2026-05-30T10:00:00.000Z",
        isCurrent: false,
      },
    ]);

    renderPage();

    await waitFor(() =>
      expect(screen.getAllByTestId("session-item")).toHaveLength(2),
    );
    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument();
  });

  it("revokes a non-current session and refetches the list", async () => {
    getMock
      .mockResolvedValueOnce([
        {
          id: "s_current",
          deviceLabel: "Chrome on macOS",
          lastActiveAt: "2026-05-31T15:00:00.000Z",
          isCurrent: true,
        },
        {
          id: "s_other",
          deviceLabel: "Safari on iOS",
          lastActiveAt: "2026-05-30T10:00:00.000Z",
          isCurrent: false,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "s_current",
          deviceLabel: "Chrome on macOS",
          lastActiveAt: "2026-05-31T15:00:00.000Z",
          isCurrent: true,
        },
      ]);
    deleteMock.mockResolvedValueOnce(undefined);

    renderPage();

    await waitFor(() =>
      expect(screen.getAllByTestId("session-item")).toHaveLength(2),
    );

    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));

    await waitFor(() =>
      expect(deleteMock).toHaveBeenCalledWith("/api/users/me/sessions/s_other"),
    );
    await waitFor(() =>
      expect(screen.getAllByTestId("session-item")).toHaveLength(1),
    );
  });
});
