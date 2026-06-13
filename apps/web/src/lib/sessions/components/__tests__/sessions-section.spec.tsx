import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { sessionsApi } from "@/lib/sessions/api-client";
import { SessionsSection } from "../sessions-section";

jest.mock("@/lib/sessions/api-client", () => {
  const actual = jest.requireActual("@/lib/sessions/api-client");
  return {
    ...actual,
    sessionsApi: { list: jest.fn(), revoke: jest.fn() },
  };
});

const listMock = sessionsApi.list as jest.MockedFunction<
  typeof sessionsApi.list
>;
const revokeMock = sessionsApi.revoke as jest.MockedFunction<
  typeof sessionsApi.revoke
>;

function renderSection(): ReturnType<typeof render> {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <SessionsSection />
    </QueryClientProvider>,
  );
}

describe("SessionsSection", () => {
  beforeEach(() => {
    listMock.mockReset();
    revokeMock.mockReset();
  });

  it("shows a loading indicator while the list is in flight", () => {
    listMock.mockReturnValueOnce(new Promise(() => {}));

    renderSection();

    expect(screen.getByTestId("sessions-loading")).toBeInTheDocument();
  });

  it("shows an error state with a retry button on list failure", async () => {
    listMock.mockRejectedValueOnce(new Error("boom"));

    renderSection();

    await waitFor(() =>
      expect(screen.getByTestId("sessions-error")).toBeInTheDocument(),
    );

    listMock.mockResolvedValueOnce([
      {
        id: "s_current",
        deviceLabel: "Chrome on macOS",
        lastActiveAt: "2026-05-31T15:00:00.000Z",
        isCurrent: true,
      },
    ]);

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() =>
      expect(screen.getAllByTestId("session-item")).toHaveLength(1),
    );
  });

  it("shows an empty state when the list is empty", async () => {
    listMock.mockResolvedValueOnce([]);

    renderSection();

    await waitFor(() =>
      expect(screen.getByTestId("sessions-empty")).toBeInTheDocument(),
    );
  });

  it("renders one row per session with the current device tagged", async () => {
    listMock.mockResolvedValueOnce([
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

    renderSection();

    await waitFor(() =>
      expect(screen.getAllByTestId("session-item")).toHaveLength(2),
    );
    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument();
  });

  it("revokes a non-current session and refetches the list", async () => {
    listMock
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
    revokeMock.mockResolvedValueOnce(undefined);

    renderSection();

    await waitFor(() =>
      expect(screen.getAllByTestId("session-item")).toHaveLength(2),
    );

    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));

    await waitFor(() => expect(revokeMock).toHaveBeenCalledWith("s_other"));
    await waitFor(() =>
      expect(screen.getAllByTestId("session-item")).toHaveLength(1),
    );
  });

  it("surfaces a revoke error inline", async () => {
    listMock.mockResolvedValueOnce([
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
    revokeMock.mockRejectedValueOnce(new Error("boom"));

    renderSection();

    await waitFor(() =>
      expect(screen.getAllByTestId("session-item")).toHaveLength(2),
    );

    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));

    await waitFor(() =>
      expect(screen.getByTestId("revoke-session-error")).toBeInTheDocument(),
    );
  });
});
