import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { apiClient } from "@/lib/api-client";
import { AuthGuard, useAuth } from "../auth-guard";

jest.mock("@/lib/api-client", () => ({ apiClient: { get: jest.fn() } }));

const getMock = apiClient.get as jest.MockedFunction<typeof apiClient.get>;

function renderWithClient(ui: React.ReactNode): ReturnType<typeof render> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

function ChildExposingName() {
  const me = useAuth();
  return <div data-testid="name">{me.name}</div>;
}

describe("AuthGuard", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("renders a loading indicator while /api/users/me is in flight", () => {
    let resolveFetch: (value: unknown) => void = () => undefined;
    getMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    renderWithClient(
      <AuthGuard>
        <ChildExposingName />
      </AuthGuard>,
    );

    expect(screen.getByTestId("auth-guard-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("name")).not.toBeInTheDocument();

    // Clean up the pending promise so jest doesn't complain.
    resolveFetch({
      id: "u_1",
      name: "Ada",
      email: "ada@example.com",
      avatarUrl: null,
    });
  });

  it("renders children with the user available via useAuth on success", async () => {
    getMock.mockResolvedValueOnce({
      id: "u_1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      avatarUrl: null,
    });

    renderWithClient(
      <AuthGuard>
        <ChildExposingName />
      </AuthGuard>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("name")).toHaveTextContent("Ada Lovelace"),
    );
  });

  it("renders nothing when /api/users/me fails (apiClient already redirected)", async () => {
    getMock.mockRejectedValueOnce(new Error("401"));

    const { container } = renderWithClient(
      <AuthGuard>
        <ChildExposingName />
      </AuthGuard>,
    );

    await waitFor(() =>
      expect(
        screen.queryByTestId("auth-guard-loading"),
      ).not.toBeInTheDocument(),
    );
    expect(screen.queryByTestId("name")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("throws from useAuth when called outside the guard", () => {
    // Suppress React's expected error log for the thrown error.
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ChildExposingName />)).toThrow(
      /useAuth must be called inside/i,
    );
    spy.mockRestore();
  });
});
